import StudentAssignments from "@/components/pages/StudentAssignments"
import { buildAssignments } from "@/lib/views/student"
import { listAssignments } from "@/server/queries"
import { getDraftCounts } from "@/server/student-data"

export default async function AssignmentsPage() {
  const records = await listAssignments()
  const view = buildAssignments(records, await getDraftCounts(records), new Date())
  return <StudentAssignments items={view.items} week={view.week} />
}
