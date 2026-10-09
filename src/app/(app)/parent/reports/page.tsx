import { connection } from "next/server"
import Reports from "@/components/pages/Reports"
import { loadReportInput } from "@/server/analytics"

// The AI progress summary (a Server Action on this page) can take up to a minute or two.
export const maxDuration = 300

export default async function ReportsPage() {
  await connection()
  const now = new Date()
  return <Reports input={await loadReportInput()} now={now.toISOString()} />
}
