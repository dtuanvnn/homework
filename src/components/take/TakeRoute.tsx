"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { toast } from "sonner"
import { TAB_PATHS, studentPaths } from "@/components/layout/routes"
import { play } from "@/hooks/useSound"
import { chooseDraft, correctedNow, type LocalDraft } from "@/lib/offline/drafts"
import { getDraft, getMeta } from "@/lib/offline/store"
import type { SubjectId } from "@/lib/types"
import type { TakeQuestion } from "@/lib/views/student"
import StartTimed from "./StartTimed"
import TakeAssignment, { type Answers, type TakeTimer } from "./TakeAssignment"
import { useWorkAdapter } from "./use-work-adapter"

interface TakeRouteProps {
  studentId: string
  assignmentId: string
  attemptNo: number
  setVersion: string
  title: string
  subject: SubjectId
  questions: TakeQuestion[]
  initialAnswers: Answers
  /** The server has an open draft for this attempt. */
  serverDraft: boolean
  /** Null: a timed assignment that hasn't started, so the start card comes first. */
  initialTimer: TakeTimer | null
  timeLimitMinutes: number | null
  /** Where to go after leaving (the offline screen has no server routes). */
  exitTo?: () => void
}

/**
 * Connects the take-assignment screen to autosave and submission. The device's
 * draft (written while offline) is read first and wins over the server's.
 */
export default function TakeRoute(props: TakeRouteProps) {
  const [device, setDevice] = useState<{ local: LocalDraft | null; offset: number } | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([getDraft(props.studentId, props.assignmentId), getMeta("clockOffsetMs")])
      .then(([local, offset]) => ({ local: local ?? null, offset: offset ?? 0 }))
      .catch(() => ({ local: null, offset: 0 }))
      .then((d) => live && setDevice(d))
    return () => { live = false }
  }, [props.studentId, props.assignmentId])
  if (!device) return null
  return <TakeRouteInner {...props} local={device.local} clockOffsetMs={device.offset} />
}

function TakeRouteInner({
  studentId,
  assignmentId,
  attemptNo,
  setVersion,
  title,
  subject,
  questions,
  initialAnswers,
  serverDraft,
  initialTimer,
  timeLimitMinutes,
  exitTo,
  local,
  clockOffsetMs,
}: TakeRouteProps & { local: LocalDraft | null; clockOffsetMs: number }) {
  const router = useRouter()
  const next = useRef<Route>(TAB_PATHS.today)
  const mine = local && local.attemptNo >= attemptNo ? local : null
  const [answers] = useState(() => chooseDraft(mine, serverDraft || Object.keys(initialAnswers).length ? { attemptNo, responses: initialAnswers } : null))
  const [timer, setTimer] = useState<TakeTimer | null>(() => {
    // Started offline: the clock runs on the device.
    if (mine?.origin === "device" && mine.timed) {
      return { kind: "countdown", deadline: new Date(mine.timed.deadlineMs).toISOString(), serverNow: new Date(correctedNow(clockOffsetMs)).toISOString(), limitMinutes: timeLimitMinutes ?? 0 }
    }
    if (initialTimer?.kind === "stopwatch" && mine) return { kind: "stopwatch", initialSeconds: Math.max(initialTimer.initialSeconds, mine.activeSeconds) }
    return initialTimer
  })
  // A countdown from the page props may come from the router cache (back/forward), so its clock offset is stale.
  const [fromProps] = useState(initialTimer?.kind === "countdown" && mine?.origin !== "device")
  const leaving = useRef(false)

  // The layout (stars, badges) is shared across routes, so refresh it after leaving.
  const leave = (path: Route) => {
    leaving.current = true
    if (exitTo) return exitTo()
    router.push(path)
    router.refresh()
  }
  // The server already has the attempt handed in (time ran out, or an earlier submit got through).
  const timeIsUp = (message = "Đã hết giờ làm bài. Bài của em đã được nộp.") => {
    if (leaving.current) return
    toast(message, { icon: "⏰" })
    leave(TAB_PATHS.today)
  }

  const work = useWorkAdapter({ studentId, assignmentId, attemptNo, setVersion, timeLimitMinutes, serverDraft, local: mine, clockOffsetMs, onExpired: timeIsUp })

  if (!timer) {
    return (
      <StartTimed
        title={title}
        subject={subject}
        questionCount={questions.length}
        limitMinutes={timeLimitMinutes ?? 0}
        onBack={() => leave(TAB_PATHS.today)}
        onStart={async () => {
          const res = await work.start()
          if ("error" in res) {
            if (res.expired) return timeIsUp(res.error)
            if (res.error === "Tài khoản đang tạm khoá.") {
              router.refresh()
              return
            }
            toast.error(res.error || "Chưa bắt đầu được. Em kiểm tra mạng rồi thử lại nhé!")
            return
          }
          play("next")
          setTimer({ kind: "countdown", deadline: res.deadline, serverNow: res.serverNow, limitMinutes: timeLimitMinutes ?? 0 })
        }}
      />
    )
  }

  return (
    <TakeAssignment
      title={title}
      subject={subject}
      questions={questions}
      initialAnswers={answers}
      timer={timer}
      onResync={
        fromProps
          ? async () => {
              const res = await work.start()
              if ("error" in res && res.expired) timeIsUp(res.error)
              return "error" in res ? null : res
            }
          : undefined
      }
      onSave={(answers, seconds) => work.save(answers, seconds)}
      onExit={() => {
        leave(TAB_PATHS.today)
        toast(timer.kind === "countdown" ? "Đã lưu bài làm. Đồng hồ vẫn chạy, em quay lại sớm nhé!" : "Đã lưu bài làm. Em làm tiếp sau nhé!")
      }}
      onSubmit={async (answers, seconds, quiet) => {
        const res = await work.submit(answers, seconds)
        if ("queued" in res) {
          next.current = TAB_PATHS.today
          return { queued: true }
        }
        if ("error" in res) {
          if (res.expired) {
            timeIsUp(res.error)
            return null
          }
          if (res.error === "Tài khoản đang tạm khoá.") {
            router.refresh()
            return null
          }
          if (!quiet) toast.error(res.error || "Chưa nộp được bài. Em kiểm tra mạng rồi thử lại nhé!")
          return null
        }
        next.current = res.graded ? studentPaths.result(res.attemptId) : TAB_PATHS.today
        return { graded: res.graded }
      }}
      onSubmitted={() => {
        if (next.current === TAB_PATHS.today && navigator.onLine) toast.success("Em đã nộp bài, giỏi quá! 🎉")
        leave(next.current)
      }}
    />
  )
}
