import { notFound, redirect } from "next/navigation"
import { TAB_PATHS } from "@/components/layout/routes"
import PaperRoute from "@/components/paper/PaperRoute"
import { canTake, stateOf } from "@/lib/views/student"
import { getAssignment } from "@/server/queries"

export default async function PaperSubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getAssignment(decodeURIComponent(id))
  if (!record) notFound()
  if (record.mode !== "paper" || !canTake(stateOf(record, new Date()))) redirect(TAB_PATHS.today)
  return <PaperRoute assignmentId={record.id} title={record.set.title} subject={record.set.subject} />
}
