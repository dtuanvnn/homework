import "server-only"
import { deriveAssignmentState, type DerivedState } from "@/lib/assignment-status"
import type { Assignment, AssignmentStatus } from "@/lib/types"
import type { AssignmentRecord } from "./queries"

/** Maps derived state onto the parent-facing status used across the Figma screens. */
export function parentStatus(state: DerivedState): AssignmentStatus {
  switch (state.status) {
    case "graded":
      return "da-cham"
    case "submitted":
      return "cho-cham"
    case "in-progress":
      return state.overdue ? "tre-han" : "dang-lam"
    default:
      return state.overdue ? "tre-han" : "chua-lam"
  }
}

export function stateOf(record: AssignmentRecord, now: Date): DerivedState {
  return deriveAssignmentState(record, record.attempts, now)
}

export function toAssignment(record: AssignmentRecord, now: Date): Assignment {
  return {
    id: record.id,
    exerciseSetId: record.setId,
    assignedDate: record.availableFrom.toISOString(),
    dueDate: record.dueAt.toISOString(),
    status: parentStatus(stateOf(record, now)),
    parentNote: record.parentNote ?? undefined,
    mode: record.mode,
    maxAttempts: record.maxAttempts,
    timeLimitMinutes: record.timeLimitMinutes ?? undefined,
    attemptCount: record.attempts.length,
  }
}
