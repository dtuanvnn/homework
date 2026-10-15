import "server-only"
import { and, asc, eq, isNull } from "drizzle-orm"
import { cache } from "react"
import { db, schema } from "@/db"
import { loadRewardFacts } from "@/db/reward-facts"
import { localDay } from "@/lib/dates"
import { isUuid } from "@/lib/ids"
import { currentEnrollment, schoolYearOf, type Enrollment } from "@/lib/school-year"
import { isLocked } from "@/lib/student-lock"
import { computeRewards } from "@/lib/views/rewards"
import type { PinStudent, Student, StudentCard, StudentDetailData } from "@/lib/types"
import { settleExpiredAttempts } from "./attempt-finalize"

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

/** Star balance of any child (the Students page shows every child, not just the viewing one). */
export async function starBalance(studentId: string): Promise<number> {
  const { facts, seen } = await loadRewardFacts(db, { studentId })
  return computeRewards(facts, seen, new Date()).ledger.balance
}

export async function toCard(row: StudentRow, stars: number, now: Date): Promise<StudentCard> {
  const s = await toStudent(row, stars)
  const locked = isLocked(row, now)
  return {
    id: row.id,
    name: row.name,
    avatarEmoji: row.avatarEmoji,
    grade: s.grade,
    className: s.className ?? null,
    schoolYear: s.schoolYear,
    stars,
    hasPin: Boolean(row.pinHash),
    locked,
    lockedUntil: locked ? (row.lockedUntil?.toISOString() ?? null) : null,
    archived: Boolean(row.archivedAt),
  }
}

/** Every child of the household, archived ones included. */
export async function listStudentCards(householdId: string): Promise<StudentCard[]> {
  await settleExpiredAttempts()
  const rows = await db.select().from(students).where(eq(students.householdId, householdId)).orderBy(asc(students.createdAt))
  const now = new Date()
  return Promise.all(rows.map(async (r) => toCard(r, await starBalance(r.id), now)))
}

export async function getStudentDetail(householdId: string, id: string): Promise<StudentDetailData | null> {
  if (!isUuid(id)) return null
  const row = await db.query.students.findFirst({ where: and(eq(students.id, id), eq(students.householdId, householdId)) })
  if (!row) return null
  await settleExpiredAttempts()
  const now = new Date()
  const [years, { facts, seen }] = await Promise.all([listEnrollments(row.id), loadRewardFacts(db, { studentId: row.id })])
  const rewards = computeRewards(facts, seen, now)
  const current = currentEnrollment(years, localDay(now))
  return {
    card: await toCard(row, rewards.ledger.balance, now),
    years: [...years].reverse().map((y) => ({ ...y, current: y.schoolYear === current?.schoolYear })),
    streak: rewards.streak.current,
    badges: rewards.badges.filter((b) => b.earnedAt).length,
    lockReason: isLocked(row, now) ? row.lockReason : null,
  }
}
