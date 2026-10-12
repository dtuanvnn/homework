/*
 * PIN gate (not authentication). Each mode has its own PIN: APP_PIN for the
 * student, PARENT_PIN for the parent. The cookie holds a hash of the last PIN
 * entered and so grants one mode at a time: switching modes asks for the
 * other mode's PIN. A mode without a PIN configured is open.
 */

/** Cookie holding a hash of the PIN entered for the current mode (see proxy.ts). */
export const PIN_COOKIE = "hh_pin"

export type PinRole = "parent" | "student"

export type Pins = Partial<Record<PinRole, string>>

export function pinsFromEnv(env: Record<string, string | undefined> = process.env): Pins {
  return { student: env.APP_PIN || undefined, parent: env.PARENT_PIN || env.APP_PIN || undefined }
}

export async function pinToken(role: PinRole, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`homework-hub:${role}:${pin}`)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Whether the cookie value opens `role`'s mode. */
export async function grants(token: string | undefined, pins: Pins, role: PinRole): Promise<boolean> {
  const pin = pins[role]
  if (!pin) return true
  return token === (await pinToken(role, pin))
}

/** The mode a path belongs to; null for shared paths (/, /pin). */
export function roleForPath(pathname: string): PinRole | null {
  if (pathname === "/parent" || pathname.startsWith("/parent/")) return "parent"
  if (pathname === "/student" || pathname.startsWith("/student/")) return "student"
  return null
}
