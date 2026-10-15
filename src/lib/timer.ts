/*
 * Time math for assignments. A timed attempt's deadline is its server-side
 * `startedAt` plus the assignment's limit; untimed attempts accumulate the
 * seconds the take page was visible. Pure so it runs on both sides and in tests.
 */

/** Late submits within this window still count (the auto-submit request is in flight). */
export const SUBMIT_GRACE_SECONDS = 30
/** Upper bound for a stored work time. */
export const MAX_ACTIVE_SECONDS = 6 * 3600

export type WarningLevel = "none" | "warn" | "urgent" | "final"

export function deadlineOf(startedAt: Date, limitMinutes: number): Date {
  return new Date(startedAt.getTime() + limitMinutes * 60_000)
}

export function remainingSeconds(deadline: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000))
}

/** warn ≤ 5 min (or 20 % of a short limit), urgent ≤ 1 min, final ≤ 10 s. */
export function warningLevel(remaining: number, limitSeconds: number): WarningLevel {
  if (remaining <= 10) return "final"
  if (remaining <= 60) return "urgent"
  if (remaining <= Math.min(300, limitSeconds * 0.2)) return "warn"
  return "none"
}

/** Seconds a timed attempt took, capped at the limit. */
export function timedDuration(startedAt: Date, limitMinutes: number, now: Date): number {
  const seconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
  return Math.min(Math.max(seconds, 0), limitMinutes * 60)
}

/** Untimed work time: only grows, ignores garbage, capped at 6 hours. */
export function mergeActiveSeconds(stored: number | null, reported: unknown): number {
  const base = stored ?? 0
  if (typeof reported !== "number" || !Number.isFinite(reported)) return base
  return Math.max(base, Math.min(Math.max(Math.round(reported), 0), MAX_ACTIVE_SECONDS))
}

/** The deadline plus the grace window has passed: the attempt must be handed in as saved. */
export function isExpired(startedAt: Date, limitMinutes: number, now: Date): boolean {
  return now.getTime() > deadlineOf(startedAt, limitMinutes).getTime() + SUBMIT_GRACE_SECONDS * 1000
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "12:34", or "1:02:05" from one hour. */
export function clockLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
