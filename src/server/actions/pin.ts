"use server"

import { and, eq, isNull } from "drizzle-orm"
import { cookies } from "next/headers"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { db, schema } from "@/db"
import { PIN_COOKIE, parentPin, studentPinHash, type PinRole } from "@/lib/pin"
import { SESSION_MAX_AGE, sessionSecret, signToken } from "@/lib/session-token"
import { defaultHouseholdId } from "../students"

export interface PinState {
  error?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Only paths of the mode just opened, never an external URL. */
function target(next: FormDataEntryValue | null, role: PinRole): Route {
  const value = String(next ?? "")
  return ((value === `/${role}` || value.startsWith(`/${role}/`)) ? value : `/${role}`) as Route
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function setSession(role: PinRole, householdId: string, studentId?: string) {
  const token = await signToken({ v: 1, role, householdId, studentId, iat: Math.floor(Date.now() / 1000) }, sessionSecret())
  ;(await cookies()).set(PIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE[role],
  })
}

export async function verifyParentPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const pin = parentPin()
  const entered = String(formData.get("pin") ?? "").trim()
  if (pin && !safeEqual(entered, pin)) {
    await sleep(800) // slow down guessing
    return { error: "Mã PIN chưa đúng. Thử lại nhé!" }
  }
  await setSession("parent", await defaultHouseholdId())
  redirect(target(formData.get("next"), "parent"))
}

export async function pickStudent(_prev: PinState, formData: FormData): Promise<PinState> {
  const studentId = String(formData.get("studentId") ?? "")
  const householdId = await defaultHouseholdId()
  const row = /^[0-9a-f-]{36}$/i.test(studentId)
    ? await db.query.students.findFirst({
        where: and(eq(schema.students.id, studentId), eq(schema.students.householdId, householdId), isNull(schema.students.archivedAt)),
      })
    : undefined
  if (!row) return { error: "Không tìm thấy học sinh." }
  if (row.pinHash) {
    const entered = String(formData.get("pin") ?? "").trim()
    if (!safeEqual(await studentPinHash(row.id, entered), row.pinHash)) {
      await sleep(800)
      return { error: "Mã PIN chưa đúng. Thử lại nhé!" }
    }
  }
  await setSession("student", householdId, row.id)
  redirect(target(formData.get("next"), "student"))
}
