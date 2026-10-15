import { connection } from "next/server"
import AppFrame from "@/components/layout/AppFrame"
import { getNavCounts, getViewingStudent, listAssignments, listExerciseSets } from "@/server/queries"
import { toAssignment } from "@/server/views"
import { getContext } from "@/server/access"
import { listHouseholdStudents, toStudent } from "@/server/students"
import { isLocked } from "@/lib/student-lock"
import type { ChildOption } from "@/lib/types"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const now = new Date()
  const [student, navCounts, sets, assignments] = await Promise.all([getViewingStudent(), getNavCounts(now), listExerciseSets(), listAssignments()])
  const ctx = await getContext()
  const household: ChildOption[] =
    ctx.mode === "parent"
      ? await Promise.all(
          (await listHouseholdStudents(ctx.householdId)).map(async (r) => ({
            id: r.id,
            name: r.name,
            avatarEmoji: r.avatarEmoji,
            grade: (await toStudent(r, 0)).grade,
            locked: isLocked(r, now),
          })),
        )
      : []
  return (
    <AppFrame student={student} navCounts={navCounts} sets={sets} assignments={assignments.map((a) => toAssignment(a, now))} household={household} now={now.toISOString()}>
      {children}
    </AppFrame>
  )
}
