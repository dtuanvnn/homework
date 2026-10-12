import "server-only"
import { cookies } from "next/headers"
import { grants, PIN_COOKIE, pinsFromEnv, type PinRole } from "@/lib/pin"

/*
 * PIN gate per mode (see lib/pin.ts). Pages are guarded by proxy.ts; Server
 * Actions are reachable by direct POST, so each one calls assertAccess() with
 * the mode it belongs to.
 */

async function cookieToken() {
  return (await cookies()).get(PIN_COOKIE)?.value
}

export async function hasAccess(role: PinRole): Promise<boolean> {
  return grants(await cookieToken(), pinsFromEnv(), role)
}

/** The mode the current PIN opens (parent first when both are open); null when none. */
export async function currentRole(): Promise<PinRole | null> {
  const token = await cookieToken()
  const pins = pinsFromEnv()
  if (await grants(token, pins, "parent")) return "parent"
  if (await grants(token, pins, "student")) return "student"
  return null
}

export async function assertAccess(role: PinRole) {
  if (!(await hasAccess(role))) throw new Error(role === "parent" ? "Cần mã PIN phụ huynh để tiếp tục." : "Cần mã PIN để tiếp tục.")
}
