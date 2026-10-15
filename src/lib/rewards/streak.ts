import { startOfDay } from "@/lib/dates"

/*
 * Streak: consecutive "due days" on which every assignment due that day had
 * its first attempt submitted on time. Days with nothing due are skipped, so
 * weekends without homework never break it. Today counts once everything due
 * is in, breaks once something is past due, and is neutral until then.
 */

export interface StreakAssignment {
  availableFrom: Date
  dueAt: Date
  attempts: { attemptNo: number; submittedAt: Date | null }[]
}

export interface StreakMilestone {
  days: number
  /** Start of the (Vietnam) day the run reached `days`. */
  reachedOn: Date
  bonus: number
}

export interface StreakSummary {
  current: number
  longest: number
  /** Every milestone reached, oldest first; a new run after a break earns them again. */
  milestones: StreakMilestone[]
}

const BONUSES: Record<number, number> = { 3: 5, 7: 10, 14: 20, 30: 50 }

/** Stars for reaching a run of `days`: 3/7/14/30 days, then every further 30. */
export function milestoneBonus(days: number): number | null {
  if (BONUSES[days]) return BONUSES[days]
  return days > 30 && days % 30 === 0 ? 50 : null
}

/** The next milestone above `current`, for "Còn 2 ngày nữa đến mốc 7 ngày". */
export function nextMilestone(current: number): { days: number; bonus: number } {
  let days = current + 1
  while (milestoneBonus(days) === null) days++
  return { days, bonus: milestoneBonus(days)! }
}

const onTime = (a: StreakAssignment) => {
  const first = a.attempts.find((t) => t.attemptNo === 1)
  return !!first?.submittedAt && first.submittedAt.getTime() <= a.dueAt.getTime()
}

export function streakRuns(assignments: StreakAssignment[], now: Date): StreakSummary {
  const today = startOfDay(now).getTime()
  const byDay = Map.groupBy(
    assignments.filter((a) => a.availableFrom.getTime() <= a.dueAt.getTime() && startOfDay(a.dueAt).getTime() <= today),
    (a) => startOfDay(a.dueAt).getTime(),
  )
  let run = 0
  let longest = 0
  const milestones: StreakMilestone[] = []
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const due = byDay.get(day)!
    if (!due.every(onTime)) {
      // Today stays open until something is actually late.
      const late = day < today || due.some((a) => !onTime(a) && a.dueAt.getTime() <= now.getTime())
      if (late) run = 0
      continue
    }
    run++
    longest = Math.max(longest, run)
    const bonus = milestoneBonus(run)
    if (bonus) milestones.push({ days: run, reachedOn: new Date(day), bonus })
  }
  return { current: run, longest, milestones }
}
