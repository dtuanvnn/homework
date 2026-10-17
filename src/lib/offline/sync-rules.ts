import { SUBMIT_GRACE_SECONDS, deadlineOf, mergeActiveSeconds } from "@/lib/timer"

/*
 * Rules for handing in work that was done offline (see
 * docs/superpowers/specs/2026-10-17-pwa-offline-design.md). The device's clock
 * decides the hand-in time, clamped by the server; pure so both sides and the
 * tests share it.
 */

/** A timed attempt's deadline and who started its clock (the server, or the iPad while offline). */
export type OfflineTimed = { deadlineMs: number; source: "server" | "device" } | null

export interface OfflineTimesInput {
  now: Date
  availableFrom: Date
  /** The server row's start, when the attempt already exists. */
  existingStartedAt: Date | null
  /** Device times in ms, already corrected by the last known server clock offset. */
  startedAtClient: number | null
  submittedAtClient: number
  timeLimitMinutes: number | null
  timed: OfflineTimed
  existingDurationSeconds: number | null
  activeSeconds: number
}

export interface OfflineTimes {
  startedAt: Date
  submittedAt: Date
  durationSeconds: number
  /** Handed in after deadline + grace; the hand-in is pinned to the deadline. */
  late: boolean
}

export function clampDate(ms: number, min: Date, max: Date): Date {
  return new Date(Math.min(Math.max(ms, min.getTime()), max.getTime()))
}

export function resolveOfflineTimes(i: OfflineTimesInput): OfflineTimes {
  const startedAt = i.existingStartedAt ?? clampDate(i.startedAtClient ?? i.submittedAtClient, i.availableFrom, i.now)
  const clamped = clampDate(i.submittedAtClient, startedAt, i.now)
  const limit = i.timeLimitMinutes
  if (limit === null) {
    return { startedAt, submittedAt: clamped, durationSeconds: mergeActiveSeconds(i.existingDurationSeconds, i.activeSeconds), late: false }
  }
  const deadline = i.timed?.source === "server" ? i.timed.deadlineMs : deadlineOf(startedAt, limit).getTime()
  const late = clamped.getTime() > deadline + SUBMIT_GRACE_SECONDS * 1000
  const submittedAt = new Date(Math.max(Math.min(clamped.getTime(), deadline), startedAt.getTime()))
  const durationSeconds = Math.min(Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000), limit * 60)
  return { startedAt, submittedAt, durationSeconds, late }
}

export type SyncTarget =
  | { kind: "already-synced"; attemptId: string }
  | { kind: "use-draft"; attemptId: string }
  | { kind: "replace-auto-settled"; attemptId: string }
  | { kind: "create"; attemptNo: number }
  | { kind: "refuse"; reason: "closed" | "graded-by-parent" }

export interface SyncAttemptView {
  id: string
  attemptNo: number
  startedAt: Date
  submittedAt: Date | null
  gradedBy: "auto" | "ai" | "parent" | null
  autoSettled: boolean
  offlineId: string | null
}

/** Where an offline hand-in goes. `attempts` sorted by attempt number. */
export function decideSync(i: {
  clientId: string
  attemptNo: number
  attempts: SyncAttemptView[]
  maxAttempts: number
  canTakeNow: boolean
  timeLimitMinutes: number | null
}): SyncTarget {
  const synced = i.attempts.find((a) => a.offlineId === i.clientId)
  if (synced) return { kind: "already-synced", attemptId: synced.id }
  const latest = i.attempts.at(-1)
  if (latest && !latest.submittedAt) return { kind: "use-draft", attemptId: latest.id }
  // The timer handed this attempt in with the answers the server had while the iPad was offline.
  if (latest && latest.autoSettled && latest.attemptNo === i.attemptNo) {
    return latest.gradedBy === null || latest.gradedBy === "auto"
      ? { kind: "replace-auto-settled", attemptId: latest.id }
      : { kind: "refuse", reason: "graded-by-parent" }
  }
  const attemptNo = (latest?.attemptNo ?? 0) + 1
  if (i.canTakeNow && attemptNo <= i.maxAttempts) return { kind: "create", attemptNo }
  return { kind: "refuse", reason: "closed" }
}
