import StudentToday from "@/components/pages/StudentToday"
import { buildToday } from "@/lib/views/student"
import { getStudent, listAssignments } from "@/server/queries"
import { loadRewards } from "@/server/rewards"
import { getDraftCounts } from "@/server/student-data"

export default async function TodayPage() {
  const [student, records, rewards] = await Promise.all([getStudent(), listAssignments(), loadRewards()])
  const view = buildToday(records, await getDraftCounts(records), new Date())
  return <StudentToday studentName={student.name} stars={student.totalStars} celebrations={rewards.state.celebrations} {...view} />
}
