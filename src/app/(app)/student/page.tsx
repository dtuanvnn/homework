import StudentToday from "@/components/pages/StudentToday"
import { buildToday } from "@/lib/views/student"
import { getStudent, listAssignments } from "@/server/queries"
import { getDraftCounts } from "@/server/student-data"

export default async function TodayPage() {
  const [student, records] = await Promise.all([getStudent(), listAssignments()])
  const view = buildToday(records, await getDraftCounts(records), new Date())
  return <StudentToday studentName={student.name} stars={student.totalStars} {...view} />
}
