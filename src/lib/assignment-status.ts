/**
 * Assignment state is derived, never stored: it follows from the schedule,
 * the attempts and the current time.
 */

export type AssignmentState = "scheduled" | "not-started" | "in-progress" | "submitted" | "graded"

export interface AttemptLike {
  attemptNo: number
  submittedAt: Date | null
  gradedAt: Date | null
  score: number | null
  retryAllowed: boolean
}

export interface AssignmentLike {
  availableFrom: Date
  dueAt: Date
  maxAttempts: number
}

export interface DerivedState {
  status: AssignmentState
  /** Past due without a submission. */
  overdue: boolean
  /** The attempt the student is on (or would start). */
  attemptNo: 1 | 2
  /** Graded, and a second attempt is allowed and unused. */
  canRetry: boolean
  /** Score of the latest graded attempt. */
  score?: number
  /** Score of attempt 1 when attempt 2 exists. */
  previousScore?: number
}

export function deriveAssignmentState(assignment: AssignmentLike, attempts: AttemptLike[], now: Date): DerivedState {
  const sorted = [...attempts].sort((a, b) => a.attemptNo - b.attemptNo)
  const latest = sorted.at(-1)
  const first = sorted[0]
  const previousScore = latest && latest.attemptNo > 1 ? (first.score ?? undefined) : undefined
  const attemptNo = (latest?.attemptNo ?? 1) as 1 | 2
  const pastDue = now.getTime() > assignment.dueAt.getTime()

  if (!latest) {
    if (now.getTime() < assignment.availableFrom.getTime()) return { status: "scheduled", overdue: false, attemptNo: 1, canRetry: false }
    return { status: "not-started", overdue: pastDue, attemptNo: 1, canRetry: false }
  }
  if (!latest.submittedAt) return { status: "in-progress", overdue: pastDue, attemptNo, canRetry: false, previousScore }
  if (!latest.gradedAt || latest.score === null) return { status: "submitted", overdue: false, attemptNo, canRetry: false, previousScore }

  const canRetry = latest.retryAllowed && latest.attemptNo < assignment.maxAttempts
  return { status: "graded", overdue: false, attemptNo, canRetry, score: latest.score, previousScore }
}
