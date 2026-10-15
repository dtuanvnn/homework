"use server"

import { and, eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { refresh } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { runAction, type ActionResult } from "@/lib/action-result"
import { isValidPin, studentPinHash, VIEWING_COOKIE } from "@/lib/pin"
import { schoolYearLabel, schoolYearStart } from "@/lib/school-year"
import { lockUntil } from "@/lib/student-lock"
import { assertAccess } from "../access"
import { listHouseholdStudents } from "../students"

/** Parent devices: which child parent pages show. */
export async function setViewingStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const studentId = z.uuid().parse(id)
    const children = await listHouseholdStudents(ctx.householdId)
    if (!children.some((c) => c.id === studentId)) throw new Error("Không tìm thấy học sinh.")
    ;(await cookies()).set(VIEWING_COOKIE, studentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 86_400,
    })
    refresh()
    return null
  })
}

const pinSchema = z.string().refine(isValidPin, "Mã PIN gồm 4–6 chữ số.")
const nameSchema = z.string().trim().min(1, "Hãy nhập tên.").max(40)
const emojiSchema = z.string().min(1).max(8)

const createSchema = z.object({
  name: nameSchema,
  avatarEmoji: emojiSchema,
  pin: pinSchema.optional(),
  grade: z.number().int().min(1).max(12),
  className: z.string().trim().max(20).optional(),
  schoolYear: z.number().int().min(2000).max(2100),
})

async function ownStudent(householdId: string, id: string) {
  const studentId = z.uuid().parse(id)
  const row = await db.query.students.findFirst({ where: and(eq(schema.students.id, studentId), eq(schema.students.householdId, householdId)) })
  if (!row) throw new Error("Không tìm thấy học sinh.")
  return row
}

export async function createStudent(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const data = createSchema.parse(input)
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(schema.students).values({ householdId: ctx.householdId, name: data.name, avatarEmoji: data.avatarEmoji }).returning()
      if (data.pin) await tx.update(schema.students).set({ pinHash: await studentPinHash(row.id, data.pin) }).where(eq(schema.students.id, row.id))
      await tx.insert(schema.enrollments).values({
        studentId: row.id,
        schoolYear: data.schoolYear,
        grade: data.grade,
        className: data.className || null,
        startsOn: schoolYearStart(data.schoolYear),
      })
      return row.id
    })
    refresh()
    return { id }
  })
}

export async function updateStudent(input: { id: string; name: string; avatarEmoji: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, input.id)
    await db
      .update(schema.students)
      .set({ name: nameSchema.parse(input.name), avatarEmoji: emojiSchema.parse(input.avatarEmoji) })
      .where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

/** `null` removes the PIN: the child then picks their avatar without one. */
export async function setStudentPin(id: string, pin: string | null): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    const pinHash = pin === null ? null : await studentPinHash(row.id, pinSchema.parse(pin))
    await db.update(schema.students).set({ pinHash }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

export async function archiveStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    await db.update(schema.students).set({ archivedAt: new Date() }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

export async function restoreStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    await db.update(schema.students).set({ archivedAt: null }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

const enrollmentSchema = z.object({
  schoolYear: z.number().int().min(2000).max(2100),
  grade: z.number().int().min(1).max(12),
  className: z.string().trim().max(20).nullable(),
  startsOn: z.iso.date(),
})

const pgCode = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code

/** "Lên lớp": a new school year for the child. Stars, badges and streak are untouched. */
export async function promoteStudent(input: { id: string } & z.input<typeof enrollmentSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, input.id)
    const data = enrollmentSchema.parse(input)
    try {
      await db.insert(schema.enrollments).values({ studentId: row.id, ...data, className: data.className || null })
    } catch (e) {
      if (pgCode(e) === "23505") throw new Error(`Bé đã có năm học ${schoolYearLabel(data.schoolYear)}.`)
      throw e
    }
    refresh()
    return null
  })
}

export async function updateEnrollment(input: { id: string } & z.input<typeof enrollmentSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, input.id)
    const data = enrollmentSchema.parse(input)
    const [updated] = await db
      .update(schema.enrollments)
      .set({ grade: data.grade, className: data.className || null, startsOn: data.startsOn })
      .where(and(eq(schema.enrollments.studentId, row.id), eq(schema.enrollments.schoolYear, data.schoolYear)))
      .returning({ id: schema.enrollments.id })
    if (!updated) throw new Error("Không tìm thấy năm học.")
    refresh()
    return null
  })
}

const lockSchema = z.object({
  id: z.uuid(),
  choice: z.union([z.enum(["1h", "today", "manual"]), z.object({ at: z.iso.datetime({ offset: true }) })]),
  reason: z.string().trim().max(120).optional(),
})

/** Blocks the child's device until the chosen time (or until unlocked). Assigning and grading go on. */
export async function lockStudent(input: z.input<typeof lockSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const data = lockSchema.parse(input)
    const row = await ownStudent(ctx.householdId, data.id)
    const now = new Date()
    await db
      .update(schema.students)
      .set({ lockedAt: now, lockedUntil: lockUntil(data.choice, now), lockReason: data.reason || null })
      .where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

export async function unlockStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    await db.update(schema.students).set({ lockedAt: null, lockedUntil: null, lockReason: null }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}
