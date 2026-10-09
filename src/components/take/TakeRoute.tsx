"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { toast } from "sonner"
import { TAB_PATHS, studentPaths } from "@/components/layout/routes"
import type { SubjectId } from "@/lib/types"
import type { TakeQuestion } from "@/lib/views/student"
import { saveDraft, submitAttempt } from "@/server/actions/attempts"
import TakeAssignment, { type Answers } from "./TakeAssignment"

/** Connects the take-assignment screen to autosave and submission. */
export default function TakeRoute({
  assignmentId,
  title,
  subject,
  questions,
  initialAnswers,
}: {
  assignmentId: string
  title: string
  subject: SubjectId
  questions: TakeQuestion[]
  initialAnswers: Answers
}) {
  const router = useRouter()
  const next = useRef<Route>(TAB_PATHS.today)

  // The layout (stars, badges) is shared across routes, so refresh it after leaving.
  const leave = (path: Route) => {
    router.push(path)
    router.refresh()
  }

  return (
    <TakeAssignment
      title={title}
      subject={subject}
      questions={questions}
      initialAnswers={initialAnswers}
      onSave={async (answers) => (await saveDraft(assignmentId, answers)).ok}
      onExit={() => {
        leave(TAB_PATHS.today)
        toast("Đã lưu bài làm. Em làm tiếp sau nhé!")
      }}
      onSubmit={async (answers, seconds) => {
        const res = await submitAttempt(assignmentId, answers, seconds).catch(() => null)
        if (!res?.ok) {
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
    />
  )
}
