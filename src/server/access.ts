import "server-only"
import { and, eq } from "drizzle-orm"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { db, schema } from "@/db"
import { MODE_HEADER, PIN_COOKIE, VIEWING_COOKIE, parentPin, type PinRole } from "@/lib/pin"
import { sessionSecret, verifyToken } from "@/lib/session-token"
import { isLocked } from "@/lib/student-lock"
import { defaultHouseholdId, listHouseholdStudents } from "./students"

/*
 * Who is asking. Pages are guarded by proxy.ts; Server Actions are reachable
 * by direct POST, so each one calls assertAccess() with the mode it belongs
 * to and scopes its reads and writes by the returned context. Queries use
 * getContext(), whose mode comes from the x-hh-mode header the proxy sets.
 */

export interface Context {
  householdId: string
  mode: PinRole
  /** Student mode: the device's child. Parent mode: the viewing child; null when the household has none. */
  studentId: string | null
  /** Student mode only: the child is locked (see lib/student-lock.ts). */
  locked: boolean
}

const readSession = cache(async () => verifyToken((await cookies()).get(PIN_COOKIE)?.value, sessionSecret()))

export async function hasAccess(role: PinRole): Promise<boolean> {
  const session = await readSession()
  if (role === "student") return session?.role === "student"
  return session?.role === "parent" || !parentPin()
}

/** The mode the cookie opens; parent when there is no cookie and no parent PIN is set. */
export async function currentRole(): Promise<PinRole | null> {
  const session = await readSession()
  if (session) return session.role
  return parentPin() ? null : "parent"
}

const contextFor = cache(async (role: PinRole): Promise<Context> => {
  const session = await readSession()
  if (role === "student") {
    if (session?.role !== "student" || !session.studentId) redirect("/pin?role=student")
    const row = await db.query.students.findFirst({
      where: and(eq(schema.students.id, session.studentId), eq(schema.students.householdId, session.householdId)),
    })
    // Archived or deleted child, or a token from another household: pick again.
    if (!row || row.archivedAt) redirect("/pin?role=student")
    return { householdId: row.householdId, mode: "student", studentId: row.id, locked: isLocked(row, new Date()) }
  }
  const householdId = session?.role === "parent" ? session.householdId : await defaultHouseholdId()
  const children = await listHouseholdStudents(householdId)
  const wanted = (await cookies()).get(VIEWING_COOKIE)?.value
  const viewing = children.find((c) => c.id === wanted) ?? children[0] ?? null
  return { householdId, mode: "parent", studentId: viewing?.id ?? null, locked: false }
})

export async function getContext(): Promise<Context> {
  const mode = (await headers()).get(MODE_HEADER) === "student" ? "student" : "parent"
  return contextFor(mode)
}

export async function assertAccess(role: PinRole): Promise<Context> {
  if (!(await hasAccess(role))) throw new Error(role === "parent" ? "Cần mã PIN phụ huynh để tiếp tục." : "Cần mã PIN để tiếp tục.")
  const ctx = await contextFor(role)
  if (ctx.locked) throw new Error("Tài khoản đang tạm khoá.")
  return ctx
}
