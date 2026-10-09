import "server-only"
import { cookies } from "next/headers"

/*
 * Optional PIN gate (not authentication): when APP_PIN is set, the app and
 * every Server Action require a cookie holding a hash of the PIN. Server
 * Actions are reachable by direct POST, so each one calls assertAccess().
 */

export const PIN_COOKIE = "hh_pin"

export async function pinToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`homework-hub:${pin}`)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Buffer.from(digest).toString("base64url")
}

export async function hasAccess(): Promise<boolean> {
  const pin = process.env.APP_PIN
  if (!pin) return true
  const token = (await cookies()).get(PIN_COOKIE)?.value
  return token === (await pinToken(pin))
}

export async function assertAccess() {
  if (!(await hasAccess())) throw new Error("Cần nhập mã PIN để tiếp tục.")
}
