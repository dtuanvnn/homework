import { notFound, redirect } from "next/navigation"
import { TAB_PATHS } from "@/components/layout/routes"
import TakeRoute from "@/components/take/TakeRoute"
import type { TakeTimer } from "@/components/take/TakeAssignment"
import { deadlineOf } from "@/lib/timer"
import { canTake, stateOf, toTakeQuestion } from "@/lib/views/student"
import { getAssignment, getQuestionsWithImages } from "@/server/queries"
import { getDraftResponses } from "@/server/student-data"

export default async function TakeAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Loading the assignment also hands in a timed attempt whose time ran out.
  const record = await getAssignment(decodeURIComponent(id))
  if (!record) notFound()
  if (record.mode !== "web" || !canTake(stateOf(record, new Date()))) redirect(TAB_PATHS.today)

  const latest = record.attempts.at(-1)
  const draft = latest && !latest.submittedAt ? latest : null
  const [questions, initialAnswers] = await Promise.all([
    getQuestionsWithImages(record.setId),
    draft ? getDraftResponses(draft.id) : {},
  ])
  if (!questions.length) redirect(TAB_PATHS.today)

  const limit = record.timeLimitMinutes
  // Timed and not started yet: null shows the "Bắt đầu" card first.
  const timer: TakeTimer | null =
    limit === null
      ? { kind: "stopwatch", initialSeconds: draft?.durationSeconds ?? 0 }
      : draft
        ? { kind: "countdown", deadline: deadlineOf(draft.startedAt, limit).toISOString(), serverNow: new Date().toISOString(), limitMinutes: limit }
        : null

  return (
    <TakeRoute
      assignmentId={record.id}
      title={record.set.title}
      subject={record.set.subject}
      questions={questions.map(toTakeQuestion)}
      initialAnswers={initialAnswers}
      initialTimer={timer}
      timeLimitMinutes={limit}
    />
  )
}
