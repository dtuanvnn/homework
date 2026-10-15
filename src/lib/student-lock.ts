import { addDays, startOfDay } from "./dates"

/*
 * A locked child can't use the app on their device until lockedUntil (or until
 * the parent unlocks when it is null). Checked on read; nothing is scheduled.
 */

export interface LockFields {
  lockedAt: Date | string | null
  lockedUntil: Date | string | null
}

export function isLocked(s: LockFields, now: Date): boolean {
  if (!s.lockedAt) return false
  if (!s.lockedUntil) return true
  return new Date(s.lockedUntil).getTime() > now.getTime()
}

export type LockChoice = "1h" | "today" | "manual" | { at: string }

export function lockUntil(choice: LockChoice, now: Date): Date | null {
  if (choice === "manual") return null
  if (choice === "1h") return new Date(now.getTime() + 60 * 60_000)
  if (choice === "today") return addDays(startOfDay(now), 1)
  const at = new Date(choice.at)
  if (!Number.isFinite(at.getTime()) || at <= now) throw new Error("Giờ mở khoá phải sau bây giờ.")
  return at
}
