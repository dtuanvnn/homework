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
  const leaving = useRef(false)

  // The layout (stars, badges) is shared across routes, so refresh it after leaving.
  const leave = (path: Route) => {
    leaving.current = true
    router.push(path)
    router.refresh()
  }
  // The server handed the attempt in because time ran out.
  const timeIsUp = () => {
    if (leaving.current) return
    toast("Đã hết giờ làm bài. Bài của em đã được nộp.", { icon: "⏰" })
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
            if (res?.expired) return timeIsUp()
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
      onSave={async (answers, seconds) => {
        const res = await saveDraft(assignmentId, answers, seconds).catch(() => null)
        if (res && !res.ok && res.expired) timeIsUp()
        return Boolean(res?.ok)
      }}
      onExit={() => {
        leave(TAB_PATHS.today)
        toast(timer.kind === "countdown" ? "Đã lưu bài làm. Đồng hồ vẫn chạy, em quay lại sớm nhé!" : "Đã lưu bài làm. Em làm tiếp sau nhé!")
      }}
      onSubmit={async (answers, seconds) => {
        const res = await submitAttempt(assignmentId, answers, seconds).catch(() => null)
        if (!res?.ok) {
          if (res?.expired) {
            timeIsUp()
            return null
          }
          toast.error(res?.error ?? "Chưa nộp được bài. Em kiểm tra mạng rồi thử lại nhé!")
          return null
        }
        next.current = res.graded ? studentPaths.result(res.attemptId) : TAB_PATHS.today
        return { graded: res.graded }
      }}
      onSubmitted={() => {
        if (next.current === TAB_PATHS.today) toast.success("Em đã nộp bài, giỏi quá! 🎉")
        leave(next.current)
      }}
      onGiveUp={() => {
        // Time ran out and the hand-in never got through; the server hands it in on the next visit.
        toast("Hết giờ rồi! Bài sẽ được nộp với những câu em đã lưu.", { icon: "⏰" })
        leave(TAB_PATHS.today)
      }}
    />
  )
}
