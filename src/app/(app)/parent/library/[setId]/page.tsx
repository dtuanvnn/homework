import { notFound } from "next/navigation"
import { getExerciseSetDetail } from "@/server/queries"
import FlashcardScreen from "../flashcard/FlashcardScreen"
import ExerciseSetScreen from "./ExerciseSetScreen"

// "Giải đáp án" calls the AI through a Server Action, which inherits this limit (one question per call).
export const maxDuration = 300

export default async function ExerciseSetPage({ params }: PageProps<"/parent/library/[setId]">) {
  const { setId } = await params
  const detail = await getExerciseSetDetail(decodeURIComponent(setId))
  if (!detail) notFound()
  if (detail.set.format === "flashcard") return <FlashcardScreen key={detail.set.id} set={detail.set} questions={detail.questions} />
  return <ExerciseSetScreen key={detail.set.id} set={detail.set} questions={detail.questions} attachments={detail.attachments} />
}
