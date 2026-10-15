import { redirect } from "next/navigation"
import StudentToday from "@/components/pages/StudentToday"
import { buildToday } from "@/lib/views/student"
import { getViewingStudent, listAssignments } from "@/server/queries"
import { loadRewards } from "@/server/rewards"
import { getDraftCounts } from "@/server/student-data"

export default async function TodayPage() {
  const [student, records, rewards] = await Promise.all([getViewingStudent(), listAssignments(), loadRewards()])
  if (!student) redirect("/pin?role=student")
  const view = buildToday(records, await getDraftCounts(records), new Date())
  return <StudentToday studentName={student.name} stars={student.totalStars} celebrations={rewards.state.celebrations} {...view} />
}
