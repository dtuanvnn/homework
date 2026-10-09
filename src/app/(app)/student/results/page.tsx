import StudentResults from "@/components/pages/StudentResults"
import { buildResults } from "@/lib/views/student"
import { listAssignments } from "@/server/queries"

export default async function ResultsPage() {
  const results = buildResults(await listAssignments(), new Date())
  return <StudentResults results={results} />
}
