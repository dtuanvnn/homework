import { notFound } from "next/navigation"
import { getExerciseSetDetail } from "@/server/queries"
import ExerciseSetScreen from "./ExerciseSetScreen"

export default async function ExerciseSetPage({ params }: PageProps<"/parent/library/[setId]">) {
  const { setId } = await params
  const detail = await getExerciseSetDetail(decodeURIComponent(setId))
  if (!detail) notFound()
  return <ExerciseSetScreen key={detail.set.id} set={detail.set} questions={detail.questions} attachments={detail.attachments} />
}
