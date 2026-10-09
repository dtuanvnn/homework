import { connection } from "next/server"
import { notFound } from "next/navigation"
import GradeAttempt from "@/components/grading/GradeAttempt"
import { loadGradingDetail } from "../data"

// AI grading (Server Actions on this page) can take 30–120 s.
export const maxDuration = 300

export default async function GradeAttemptPage({ params }: PageProps<"/parent/grading/[attemptId]">) {
  await connection()
  const { attemptId } = await params
  const detail = await loadGradingDetail(decodeURIComponent(attemptId))
  if (!detail) notFound()
  return <GradeAttempt key={detail.attemptId} detail={detail} now={new Date().toISOString()} />
}
