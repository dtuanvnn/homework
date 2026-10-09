"use server"

import { cookies } from "next/headers"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { PIN_COOKIE, pinToken } from "@/lib/pin"

export interface PinState {
  error?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function verifyPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const pin = process.env.APP_PIN
  const next = String(formData.get("next") ?? "/")
  // Only same-app paths, never an external URL.
  const target = (next.startsWith("/") && !next.startsWith("//") ? next : "/") as Route
  if (!pin) redirect(target)

  if (String(formData.get("pin") ?? "").trim() !== pin) {
    await sleep(800) // slow down guessing
    return { error: "Mã PIN chưa đúng. Thử lại nhé!" }
  }
  ;(await cookies()).set(PIN_COOKIE, await pinToken(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  })
  redirect(target)
}
