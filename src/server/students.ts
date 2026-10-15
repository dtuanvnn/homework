import "server-only"
import { and, asc, eq, isNull } from "drizzle-orm"
import { cache } from "react"
import { db, schema } from "@/db"
import { localDay } from "@/lib/dates"
import { currentEnrollment, schoolYearOf, type Enrollment } from "@/lib/school-year"
import type { PinStudent, Student } from "@/lib/types"

/*
 * Read side for children and their school years. Callers pass the household
 * from the request context (server/access.ts).
 */

const { households, students, enrollments } = schema

export type StudentRow = typeof students.$inferSelect

/** Until accounts exist there is one household: the oldest. */
export const defaultHouseholdId = cache(async (): Promise<string> => {
  const row = await db.query.households.findFirst({ orderBy: asc(households.createdAt) })
  if (!row) throw new Error("No household found. Run `pnpm db:seed`.")
  return row.id
})

/** Active (not archived) children, oldest first. */
export const listHouseholdStudents = cache(async (householdId: string): Promise<StudentRow[]> =>
  db.select().from(students).where(and(eq(students.householdId, householdId), isNull(students.archivedAt))).orderBy(asc(students.createdAt)),
)

export const listEnrollments = cache(async (studentId: string): Promise<Enrollment[]> =>
  db
    .select({ schoolYear: enrollments.schoolYear, grade: enrollments.grade, className: enrollments.className, startsOn: enrollments.startsOn })
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId))
    .orderBy(asc(enrollments.startsOn)),
)

export async function toStudent(row: StudentRow, totalStars: number): Promise<Student> {
  const today = localDay(new Date())
  const current = currentEnrollment(await listEnrollments(row.id), today)
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    grade: current?.grade ?? 1,
    className: current?.className ?? undefined,
    schoolYear: current?.schoolYear ?? schoolYearOf(today),
    avatarEmoji: row.avatarEmoji,
    totalStars,
  }
}

/** Children shown on the student PIN page. */
export async function listPinStudents(): Promise<PinStudent[]> {
  const rows = await listHouseholdStudents(await defaultHouseholdId())
  return rows.map((r) => ({ id: r.id, name: r.name, avatarEmoji: r.avatarEmoji, hasPin: Boolean(r.pinHash) }))
}
