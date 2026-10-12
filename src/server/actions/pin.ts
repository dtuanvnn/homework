"use server"

import { cookies } from "next/headers"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { PIN_COOKIE, pinsFromEnv, pinToken, type PinRole } from "@/lib/pin"

export interface PinState {
  error?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Unlocks one mode: the one asked for (`role`), or from the home page the
 * mode whose PIN was entered. Replaces any previously unlocked mode.
 */
export async function verifyPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const pins = pinsFromEnv()
  const next = String(formData.get("next") ?? "/")
  // Only same-app paths, never an external URL.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/"
  const asked = formData.get("role")
  const entered = String(formData.get("pin") ?? "").trim()

  const role: PinRole | null =
    asked === "parent" || asked === "student" ? asked : entered && entered === pins.parent ? "parent" : entered && entered === pins.student ? "student" : null
  const pin = role ? pins[role] : undefined
  if (!role || (pin && entered !== pin)) {
    await sleep(800) // slow down guessing
    return { error: "Mã PIN chưa đúng. Thử lại nhé!" }
  }
  if (pin) {
    ;(await cookies()).set(PIN_COOKIE, await pinToken(role, pin), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    })
  }
  redirect((target === "/" ? `/${role}` : target) as Route)
}
