"use server"

import { and, eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { refresh } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { runAction, type ActionResult } from "@/lib/action-result"
import { isValidPin, studentPinHash, VIEWING_COOKIE } from "@/lib/pin"
import { schoolYearStart } from "@/lib/school-year"
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
