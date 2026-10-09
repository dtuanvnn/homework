import { connection } from "next/server"
import AppFrame from "@/components/layout/AppFrame"
import { getNavCounts, getStudent, listAssignments, listExerciseSets } from "@/server/queries"
import { toAssignment } from "@/server/views"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const now = new Date()
  const [student, navCounts, sets, assignments] = await Promise.all([getStudent(), getNavCounts(now), listExerciseSets(), listAssignments()])
  return (
    <AppFrame student={student} navCounts={navCounts} sets={sets} assignments={assignments.map((a) => toAssignment(a, now))}>
      {children}
    </AppFrame>
  )
}
