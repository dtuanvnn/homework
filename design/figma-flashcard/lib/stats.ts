import type { Assignment, Attempt, SubjectId } from './types'
import { addDays, startOfDay, startOfWeek } from './dates'

const DAY_MS = 86_400_000

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function getAssignmentsDueOn(list: Assignment[], day: Date): Assignment[] {
  return list
    .filter((a) => isSameDay(new Date(a.dueDate), day))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
}

export interface WeekSummary {
  total: number
  done: number
  awaitingGrading: number
  overdue: number
}

/** "Done" = submitted by the student (awaiting grading or graded). */
export function summarizeAssignments(list: Assignment[]): WeekSummary {
  return {
    total: list.length,
    done: list.filter((a) => a.status === 'cho-cham' || a.status === 'da-cham').length,
    awaitingGrading: list.filter((a) => a.status === 'cho-cham').length,
    overdue: list.filter((a) => a.status === 'tre-han').length,
  }
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

function inWeek(attempt: Attempt, weekStart: Date): boolean {
  const t = new Date(attempt.submittedAt).getTime()
  return t >= weekStart.getTime() && t < weekStart.getTime() + 7 * DAY_MS
}

export function weekAverage(list: Attempt[], weekStart: Date): number | null {
  return average(list.filter((a) => inWeek(a, weekStart)).map((a) => a.score))
}

export type WeeklySubjectPoint = { weekStart: Date } & Partial<Record<SubjectId, number>>

/** Average score per subject for each of the last `weeks` weeks (oldest first). */
export function weeklySubjectAverages(list: Attempt[], currentWeekStart: Date, weeks = 6): WeeklySubjectPoint[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = startOfWeek(addDays(currentWeekStart, (i - weeks + 1) * 7))
    const inThisWeek = list.filter((a) => inWeek(a, weekStart))
    const point: WeeklySubjectPoint = { weekStart }
    for (const subject of ['toan', 'tieng-viet', 'tieng-anh'] as SubjectId[]) {
      const avg = average(inThisWeek.filter((a) => a.subject === subject).map((a) => a.score))
      if (avg !== null) point[subject] = Math.round(avg * 10) / 10
    }
    return point
  })
}
