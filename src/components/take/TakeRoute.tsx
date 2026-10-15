"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { toast } from "sonner"
import { TAB_PATHS, studentPaths } from "@/components/layout/routes"
import { play } from "@/hooks/useSound"
import type { SubjectId } from "@/lib/types"
import type { TakeQuestion } from "@/lib/views/student"
import { saveDraft, startAttempt, submitAttempt } from "@/server/actions/attempts"
import StartTimed from "./StartTimed"
import TakeAssignment, { type Answers, type TakeTimer } from "./TakeAssignment"

/** Connects the take-assignment screen to autosave and submission. */
export default function TakeRoute({
  assignmentId,
  title,
  subject,
  questions,
  initialAnswers,
  initialTimer,
  timeLimitMinutes,
}: {
  assignmentId: string
  title: string
  subject: SubjectId
  questions: TakeQuestion[]
  initialAnswers: Answers
  /** Null: a timed assignment that hasn't started, so the start card comes first. */
  initialTimer: TakeTimer | null
  timeLimitMinutes: number | null
}) {
  const router = useRouter()
  const next = useRef<Route>(TAB_PATHS.today)
  const [timer, setTimer] = useState(initialTimer)
  // A countdown from the page props may come from the router cache (back/forward), so its clock offset is stale.
  const [fromProps] = useState(initialTimer?.kind === "countdown")
  const leaving = useRef(false)

  // The layout (stars, badges) is shared across routes, so refresh it after leaving.
  const leave = (path: Route) => {
    leaving.current = true
    router.push(path)
    router.refresh()
  }
  // The server already has the attempt handed in (time ran out, or an earlier submit got through).
  const timeIsUp = (message = "Đã hết giờ làm bài. Bài của em đã được nộp.") => {
    if (leaving.current) return
    toast(message, { icon: "⏰" })
    leave(TAB_PATHS.today)
  }

  if (!timer) {
    return (
      <StartTimed
        title={title}
        subject={subject}
        questionCount={questions.length}
        limitMinutes={timeLimitMinutes ?? 0}
        onBack={() => leave(TAB_PATHS.today)}
        onStart={async () => {
          const res = await startAttempt(assignmentId).catch(() => null)
          if (!res?.ok) {
            if (res?.expired) return timeIsUp(res.error)
            toast.error(res?.error ?? "Chưa bắt đầu được. Em kiểm tra mạng rồi thử lại nhé!")
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
      initialAnswers={initialAnswers}
      timer={timer}
      onResync={
        fromProps
          ? async () => {
              const res = await startAttempt(assignmentId).catch(() => null)
              if (res && !res.ok && res.expired) timeIsUp(res.error)
              return res?.ok ? { deadline: res.deadline, serverNow: res.serverNow } : null
            }
          : undefined
      }
      onSave={async (answers, seconds) => {
        const res = await saveDraft(assignmentId, answers, seconds).catch(() => null)
        if (res && !res.ok && res.expired) timeIsUp(res.error)
        return Boolean(res?.ok)
      }}
      onExit={() => {
        leave(TAB_PATHS.today)
        toast(timer.kind === "countdown" ? "Đã lưu bài làm. Đồng hồ vẫn chạy, em quay lại sớm nhé!" : "Đã lưu bài làm. Em làm tiếp sau nhé!")
      }}
      onSubmit={async (answers, seconds, quiet) => {
        const res = await submitAttempt(assignmentId, answers, seconds).catch(() => null)
        if (!res?.ok) {
          if (res?.expired) {
            timeIsUp(res.error)
            return null
          }
          if (!quiet) toast.error(res?.error ?? "Chưa nộp được bài. Em kiểm tra mạng rồi thử lại nhé!")
          return null
        }
        next.current = res.graded ? studentPaths.result(res.attemptId) : TAB_PATHS.today
        return { graded: res.graded }
      }}
      onSubmitted={() => {
        if (next.current === TAB_PATHS.today) toast.success("Em đã nộp bài, giỏi quá! 🎉")
        leave(next.current)
      }}
    />
  )
}
