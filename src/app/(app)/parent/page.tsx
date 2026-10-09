import { connection } from "next/server"
import ParentDashboard from "@/components/pages/ParentDashboard"
import { loadDashboard } from "@/server/analytics"

export default async function DashboardPage() {
  await connection()
  return <ParentDashboard data={await loadDashboard(new Date())} />
}
