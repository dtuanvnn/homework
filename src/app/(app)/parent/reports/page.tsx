import { connection } from "next/server"
import Reports from "@/components/pages/Reports"
import { loadReportInput } from "@/server/analytics"

export default async function ReportsPage() {
  await connection()
  const now = new Date()
  return <Reports input={await loadReportInput()} now={now.toISOString()} />
}
