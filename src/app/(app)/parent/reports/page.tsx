import { connection } from "next/server"
import Reports from "@/components/pages/Reports"
import { loadReportInput } from "@/server/analytics"
import { getViewingStudent } from "@/server/queries"
import { listEnrollments } from "@/server/students"

// The AI progress summary (a Server Action on this page) can take up to a minute or two.
export const maxDuration = 300

export default async function ReportsPage() {
  await connection()
  const now = new Date()
  const student = await getViewingStudent()
  const [input, years] = await Promise.all([loadReportInput(), student ? listEnrollments(student.id) : Promise.resolve([])])
  return <Reports input={input} years={years} now={now.toISOString()} />
}
