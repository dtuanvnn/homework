import type { OfflineTimed } from "./sync-rules"

/** The answers on the device for one assignment, written before any network call. */
export interface LocalDraft {
  studentId: string
  assignmentId: string
  attemptNo: number
  /** "device": started offline (its clock runs on the iPad until it is handed in). */
  origin: "server" | "device"
  responses: Record<string, unknown>
  activeSeconds: number
  startedAtClient: number | null
  timed: OfflineTimed
  setVersion: string
  updatedAt: number
}

/** One child, one device: the device's copy of the same (or a later) attempt is the newest. */
export function chooseDraft(
  local: LocalDraft | null,
  server: { attemptNo: number; responses: Record<string, unknown> } | null,
): Record<string, unknown> {
  if (local && (!server || local.attemptNo >= server.attemptNo)) return local.responses
  return server?.responses ?? {}
}

/** Server clock minus device clock, assuming the server answered halfway through the round trip. */
export function offsetFrom(serverNowIso: string, sentAt: number, receivedAt: number): number {
  return Date.parse(serverNowIso) - (sentAt + receivedAt) / 2
}

/** Device time corrected to the server's clock. */
export function correctedNow(offsetMs: number, deviceNow: number = Date.now()): number {
  return deviceNow + offsetMs
}
