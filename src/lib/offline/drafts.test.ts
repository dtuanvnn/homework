import { describe, expect, it } from "vitest"
import { chooseDraft, correctedNow, offsetFrom, type LocalDraft } from "./drafts"

const local = (attemptNo: number): LocalDraft => ({
  studentId: "s1",
  assignmentId: "a1",
  attemptNo,
  origin: "device",
  responses: { q1: "local" },
  activeSeconds: 30,
  startedAtClient: null,
  timed: null,
  setVersion: "v",
  updatedAt: 1,
})

describe("chooseDraft", () => {
  it("prefers the device copy of the same attempt", () => {
    expect(chooseDraft(local(1), { attemptNo: 1, responses: { q1: "server" } })).toEqual({ q1: "local" })
    expect(chooseDraft(local(2), { attemptNo: 1, responses: { q1: "server" } })).toEqual({ q1: "local" })
  })

  it("uses the server copy when the device has none or an older attempt", () => {
    expect(chooseDraft(null, { attemptNo: 1, responses: { q1: "server" } })).toEqual({ q1: "server" })
    expect(chooseDraft(local(1), { attemptNo: 2, responses: { q1: "server" } })).toEqual({ q1: "server" })
  })

  it("starts empty with neither", () => {
    expect(chooseDraft(null, null)).toEqual({})
  })
})

describe("clock offset", () => {
  it("assumes the server answered halfway through the round trip", () => {
    const midpoint = Date.parse("2026-10-17T03:00:00.000Z")
    expect(offsetFrom("2026-10-17T03:00:10.000Z", midpoint - 1000, midpoint + 1000)).toBe(10_000)
  })

  it("corrects device time", () => {
    expect(correctedNow(5000, 1000)).toBe(6000)
  })
})
