"use server"

import { cookies } from "next/headers"
import { refresh } from "next/cache"
import { z } from "zod"
import { runAction, type ActionResult } from "@/lib/action-result"
import { VIEWING_COOKIE } from "@/lib/pin"
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
