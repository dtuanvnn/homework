import { describe, expect, it } from "vitest"
import { deriveAssignmentState, type AttemptLike } from "./assignment-status"

const now = new Date("2026-10-15T15:00:00+07:00")
const assignment = {
  availableFrom: new Date("2026-10-15T06:00:00+07:00"),
  dueAt: new Date("2026-10-15T20:00:00+07:00"),
  maxAttempts: 2,
}
const graded = (attemptNo: number, score: number, retryAllowed = true): AttemptLike => ({
  attemptNo,
  submittedAt: new Date("2026-10-15T10:00:00+07:00"),
  gradedAt: new Date("2026-10-15T11:00:00+07:00"),
  score,
  retryAllowed,
})

describe("deriveAssignmentState", () => {
  it("is scheduled before it becomes available", () => {
    const s = deriveAssignmentState({ ...assignment, availableFrom: new Date("2026-10-16T06:00:00+07:00") }, [], now)
    expect(s.status).toBe("scheduled")
  })

  it("is not started with no attempts", () => {
    expect(deriveAssignmentState(assignment, [], now)).toMatchObject({ status: "not-started", overdue: false, attemptNo: 1 })
  })

  it("is overdue when the due time passed without a submission", () => {
    const late = new Date("2026-10-15T21:00:00+07:00")
    expect(deriveAssignmentState(assignment, [], late)).toMatchObject({ status: "not-started", overdue: true })
    expect(deriveAssignmentState(assignment, [{ attemptNo: 1, submittedAt: null, gradedAt: null, score: null, retryAllowed: true }], late)).toMatchObject({
      status: "in-progress",
      overdue: true,
    })
  })

  it("is in progress while a draft attempt exists", () => {
    const s = deriveAssignmentState(assignment, [{ attemptNo: 1, submittedAt: null, gradedAt: null, score: null, retryAllowed: true }], now)
    expect(s).toMatchObject({ status: "in-progress", attemptNo: 1 })
  })

  it("is submitted while waiting for the parent, never overdue", () => {
    const late = new Date("2026-10-16T09:00:00+07:00")
    const s = deriveAssignmentState(assignment, [{ attemptNo: 1, submittedAt: now, gradedAt: null, score: null, retryAllowed: true }], late)
    expect(s).toMatchObject({ status: "submitted", overdue: false })
  })

  it("offers a second attempt after grading when allowed", () => {
    const s = deriveAssignmentState(assignment, [graded(1, 6.5)], now)
    expect(s).toMatchObject({ status: "graded", canRetry: true, score: 6.5, previousScore: undefined })
  })

  it("does not offer a retry when the parent closed it or max attempts is 1", () => {
    expect(deriveAssignmentState(assignment, [graded(1, 6.5, false)], now).canRetry).toBe(false)
    expect(deriveAssignmentState({ ...assignment, maxAttempts: 1 }, [graded(1, 6.5)], now).canRetry).toBe(false)
  })

  it("reports the latest attempt and the previous score", () => {
    const s = deriveAssignmentState(assignment, [graded(2, 9), graded(1, 6.5)], now)
    expect(s).toMatchObject({ status: "graded", attemptNo: 2, score: 9, previousScore: 6.5, canRetry: false })
  })

  it("starting the retry puts it back in progress as attempt 2", () => {
    const s = deriveAssignmentState(assignment, [graded(1, 6.5), { attemptNo: 2, submittedAt: null, gradedAt: null, score: null, retryAllowed: true }], now)
    expect(s).toMatchObject({ status: "in-progress", attemptNo: 2, previousScore: 6.5 })
  })
})
