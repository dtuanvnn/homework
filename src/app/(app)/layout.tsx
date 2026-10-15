import { connection } from "next/server"
import { eq } from "drizzle-orm"
import AppFrame from "@/components/layout/AppFrame"
import LockScreen from "@/components/layout/LockScreen"
import { getNavCounts, getViewingStudent, listAssignments, listExerciseSets } from "@/server/queries"
import { toAssignment } from "@/server/views"
import { getContext } from "@/server/access"
import { listHouseholdStudents, toStudent } from "@/server/students"
import { isLocked } from "@/lib/student-lock"
import { db, schema } from "@/db"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const ctx = await getContext()
  if (ctx.mode === "student" && ctx.locked) {
    const row = (await db.query.students.findFirst({ where: eq(schema.students.id, ctx.studentId!) }))!
    return <LockScreen avatarEmoji={row.avatarEmoji} name={row.name} reason={row.lockReason} until={row.lockedUntil?.toISOString() ?? null} />
  }
  const now = new Date()
  const [student, navCounts, sets, assignments, household] = await Promise.all([
    getViewingStudent(),
    getNavCounts(now),
    listExerciseSets(),
    listAssignments(),
    ctx.mode === "parent"
      ? Promise.all(
          (await listHouseholdStudents(ctx.householdId)).map(async (r) => ({
            id: r.id,
            name: r.name,
            avatarEmoji: r.avatarEmoji,
            grade: (await toStudent(r, 0)).grade,
            locked: isLocked(r, now),
          })),
        )
      : Promise.resolve([]),
  ])
  return (
    <AppFrame student={student} navCounts={navCounts} sets={sets} assignments={assignments.map((a) => toAssignment(a, now))} household={household} now={now.toISOString()}>
      {children}
    </AppFrame>
  )
}
