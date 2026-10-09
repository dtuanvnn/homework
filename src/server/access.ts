import "server-only"
import { cookies } from "next/headers"
import { PIN_COOKIE, pinToken } from "@/lib/pin"

/*
 * Optional PIN gate (not authentication): when APP_PIN is set, the app and
 * every Server Action require a cookie holding a hash of the PIN. Pages are
 * guarded by proxy.ts; Server Actions are reachable by direct POST, so each
 * one calls assertAccess().
 */

export async function hasAccess(): Promise<boolean> {
  const pin = process.env.APP_PIN
  if (!pin) return true
  const token = (await cookies()).get(PIN_COOKIE)?.value
  return token === (await pinToken(pin))
}

export async function assertAccess() {
  if (!(await hasAccess())) throw new Error("Cần nhập mã PIN để tiếp tục.")
}
