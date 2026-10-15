import { connection } from "next/server"
import ParentDashboard from "@/components/pages/ParentDashboard"
import { buildRewardSummary } from "@/lib/views/rewards"
import { loadDashboard } from "@/server/analytics"
import { loadRewards } from "@/server/rewards"

export default async function DashboardPage() {
  await connection()
  const [data, { state, facts }] = await Promise.all([loadDashboard(new Date()), loadRewards()])
  return <ParentDashboard data={data} rewards={buildRewardSummary(state, facts.redemptions)} />
}
