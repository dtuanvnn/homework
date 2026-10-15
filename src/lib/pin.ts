/*
 * PIN gate (not authentication). The hh_pin cookie holds a signed token
 * (lib/session-token.ts) naming the mode, household and — in student mode —
 * the child. The parent PIN comes from env (PARENT_PIN, falling back to
 * APP_PIN); each child has their own PIN in students.pin_hash.
 */

/** Cookie holding a hash of the PIN entered for the current mode (see proxy.ts). */
export const PIN_COOKIE = "hh_pin"

export type PinRole = "parent" | "student"

/** The mode a path belongs to; null for shared paths (/, /pin). */
export function roleForPath(pathname: string): PinRole | null {
  if (pathname === "/parent" || pathname.startsWith("/parent/")) return "parent"
  if (pathname === "/student" || pathname.startsWith("/student/")) return "student"
  return null
}

/** Request header the proxy sets to the mode of the path ("parent" | "student"). */
export const MODE_HEADER = "x-hh-mode"

/** Parent devices: the child whose data parent pages show. */
export const VIEWING_COOKIE = "hh_student"

export function parentPin(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.PARENT_PIN || env.APP_PIN || undefined
}

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin)

export async function studentPinHash(studentId: string, pin: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`homework-hub:student:${studentId}:${pin}`)))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
