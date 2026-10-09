import { notFound } from "next/navigation"
import ResultRoute from "@/components/results/ResultRoute"
import { buildResultDetail } from "@/lib/views/student"
import { getAttemptDetail } from "@/server/queries"

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const detail = await getAttemptDetail(decodeURIComponent(attemptId))
  // Only graded attempts have a result to show.
  const result = detail && buildResultDetail(detail, new Date())
  if (!result) notFound()
  return <ResultRoute result={result} />
}
