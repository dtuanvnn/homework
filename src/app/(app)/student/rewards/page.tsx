import StudentRewards from "@/components/pages/StudentRewards"
import { buildStudentRewards } from "@/lib/views/rewards"
import { listRewards, loadRewards } from "@/server/rewards"

export default async function StudentRewardsPage() {
  const [{ state, facts }, rows] = await Promise.all([loadRewards(), listRewards()])
  return <StudentRewards view={buildStudentRewards(state, rows, facts.redemptions)} />
}
