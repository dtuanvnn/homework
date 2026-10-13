import { notFound, redirect } from "next/navigation"
import { TAB_PATHS } from "@/components/layout/routes"
import TakeRoute from "@/components/take/TakeRoute"
import { canTake, stateOf, toTakeQuestion } from "@/lib/views/student"
import { getAssignment, getQuestionsWithImages } from "@/server/queries"
import { getDraftResponses } from "@/server/student-data"

export default async function TakeAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getAssignment(decodeURIComponent(id))
  if (!record) notFound()
  if (record.mode !== "web" || !canTake(stateOf(record, new Date()))) redirect(TAB_PATHS.today)

  const latest = record.attempts.at(-1)
  const [questions, initialAnswers] = await Promise.all([
    getQuestionsWithImages(record.setId),
    latest && !latest.submittedAt ? getDraftResponses(latest.id) : {},
  ])
  if (!questions.length) redirect(TAB_PATHS.today)

  return (
    <TakeRoute
      assignmentId={record.id}
      title={record.set.title}
      subject={record.set.subject}
      questions={questions.map(toTakeQuestion)}
      initialAnswers={initialAnswers}
    />
  )
}
