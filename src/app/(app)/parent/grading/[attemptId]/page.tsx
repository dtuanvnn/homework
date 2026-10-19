import { connection } from "next/server"
import { notFound } from "next/navigation"
import FlashcardGrading from "@/components/grading/FlashcardGrading"
import GradeAttempt from "@/components/grading/GradeAttempt"
import { isFlashcardSet } from "@/lib/flashcard"
import { loadGradingDetail } from "../data"

// AI grading (Server Actions on this page) can take 30–120 s.
export const maxDuration = 300

export default async function GradeAttemptPage({ params }: PageProps<"/parent/grading/[attemptId]">) {
  await connection()
  const { attemptId } = await params
  const detail = await loadGradingDetail(decodeURIComponent(attemptId))
  if (!detail) notFound()
  const now = new Date().toISOString()
  // A handwritten word list is marked word by word with one tap each.
  if (isFlashcardSet(detail.answers.map((a) => a.question))) return <FlashcardGrading key={detail.attemptId} detail={detail} now={now} />
  return <GradeAttempt key={detail.attemptId} detail={detail} now={now} />
}
