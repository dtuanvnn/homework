import { connection } from "next/server"
import ParentRewards from "@/components/pages/ParentRewards"
import { buildParentRewards } from "@/lib/views/rewards"
import { listRewards, loadRewards } from "@/server/rewards"

export default async function ParentRewardsPage() {
  await connection()
  const [{ state, facts }, rows] = await Promise.all([loadRewards(), listRewards()])
  return <ParentRewards view={buildParentRewards(state, rows, facts.redemptions)} />
}
