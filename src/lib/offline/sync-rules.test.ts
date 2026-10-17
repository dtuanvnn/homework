import { describe, expect, it } from "vitest"
import { decideSync, resolveOfflineTimes, type OfflineTimesInput, type SyncAttemptView } from "./sync-rules"

const at = (hm: string) => new Date(`2026-10-17T${hm}+07:00`)
const ms = (hm: string) => at(hm).getTime()

const base: OfflineTimesInput = {
  now: at("12:00:00"),
  availableFrom: at("08:00:00"),
  existingStartedAt: null,
  startedAtClient: null,
  submittedAtClient: ms("10:00:00"),
  timeLimitMinutes: null,
  timed: null,
  existingDurationSeconds: null,
  activeSeconds: 0,
}

describe("resolveOfflineTimes", () => {
  it("clamps hand-in into [startedAt, now]", () => {
    const future = resolveOfflineTimes({ ...base, existingStartedAt: at("09:00:00"), submittedAtClient: ms("15:00:00") })
    expect(future.submittedAt).toEqual(at("12:00:00"))
    const early = resolveOfflineTimes({ ...base, existingStartedAt: at("09:00:00"), submittedAtClient: ms("08:30:00") })
    expect(early.submittedAt).toEqual(at("09:00:00"))
  })

  it("new attempt starts no earlier than availableFrom", () => {
    const r = resolveOfflineTimes({ ...base, startedAtClient: at("08:00:00").getTime() - 864e5 })
    expect(r.startedAt).toEqual(at("08:00:00"))
    const noStart = resolveOfflineTimes(base)
    expect(noStart.startedAt).toEqual(noStart.submittedAt)
  })

  it("device-timed caps at the limit", () => {
    const timed = { ...base, timeLimitMinutes: 20, startedAtClient: ms("10:00:00"), timed: { deadlineMs: ms("10:20:00"), source: "device" as const } }
    const late = resolveOfflineTimes({ ...timed, submittedAtClient: ms("10:25:00") })
    expect(late).toEqual({ startedAt: at("10:00:00"), submittedAt: at("10:20:00"), durationSeconds: 1200, late: true })
    const grace = resolveOfflineTimes({ ...timed, submittedAtClient: ms("10:20:20") })
    expect(grace).toEqual({ startedAt: at("10:00:00"), submittedAt: at("10:20:00"), durationSeconds: 1200, late: false })
    const early = resolveOfflineTimes({ ...timed, submittedAtClient: ms("10:12:00") })
    expect(early.submittedAt).toEqual(at("10:12:00"))
    expect(early.durationSeconds).toBe(720)
  })

  it("server-timed keeps the server deadline", () => {
    const timed = { ...base, timeLimitMinutes: 20, existingStartedAt: at("10:00:00"), timed: { deadlineMs: ms("10:20:00"), source: "server" as const } }
    const ok = resolveOfflineTimes({ ...timed, submittedAtClient: ms("10:19:00") })
    expect(ok.submittedAt).toEqual(at("10:19:00"))
    expect(ok.durationSeconds).toBe(1140)
    const late = resolveOfflineTimes({ ...timed, submittedAtClient: ms("10:30:00") })
    expect(late.submittedAt).toEqual(at("10:20:00"))
    expect(late.late).toBe(true)
  })

  it("untimed merges active seconds", () => {
    expect(resolveOfflineTimes({ ...base, existingDurationSeconds: 100, activeSeconds: 90 }).durationSeconds).toBe(100)
    expect(resolveOfflineTimes({ ...base, existingDurationSeconds: 100, activeSeconds: 400 }).durationSeconds).toBe(400)
  })
})

const attempt = (over: Partial<SyncAttemptView>): SyncAttemptView => ({
  id: "a1",
  attemptNo: 1,
  startedAt: at("10:00:00"),
  submittedAt: null,
  gradedBy: null,
  autoSettled: false,
  offlineId: null,
  ...over,
})
const input = { clientId: "c1", attemptNo: 1, attempts: [] as SyncAttemptView[], maxAttempts: 2, canTakeNow: true, timeLimitMinutes: null as number | null }

describe("decideSync", () => {
  it("already-synced by clientId", () => {
    const attempts = [attempt({ submittedAt: at("10:10:00"), offlineId: "c1", gradedBy: "auto" })]
    expect(decideSync({ ...input, attempts })).toEqual({ kind: "already-synced", attemptId: "a1" })
  })

  it("uses the open draft", () => {
    expect(decideSync({ ...input, attempts: [attempt({})] })).toEqual({ kind: "use-draft", attemptId: "a1" })
  })

  it("replaces an auto-settled attempt, even when the hand-in was late", () => {
    const attempts = [attempt({ submittedAt: at("10:20:00"), autoSettled: true, gradedBy: "auto" })]
    expect(decideSync({ ...input, timeLimitMinutes: 20, attempts })).toEqual({ kind: "replace-auto-settled", attemptId: "a1" })
    const ungraded = [attempt({ submittedAt: at("10:20:00"), autoSettled: true, gradedBy: null })]
    expect(decideSync({ ...input, timeLimitMinutes: 20, attempts: ungraded }).kind).toBe("replace-auto-settled")
  })

  it("refuses when the parent already graded the auto-settled attempt", () => {
    for (const gradedBy of ["parent", "ai"] as const) {
      const attempts = [attempt({ submittedAt: at("10:20:00"), autoSettled: true, gradedBy })]
      expect(decideSync({ ...input, timeLimitMinutes: 20, attempts })).toEqual({ kind: "refuse", reason: "graded-by-parent" })
    }
  })

  it("creates the next attempt when nothing is open", () => {
    expect(decideSync(input)).toEqual({ kind: "create", attemptNo: 1 })
    const graded = [attempt({ submittedAt: at("10:20:00"), gradedBy: "parent" })]
    expect(decideSync({ ...input, attemptNo: 2, attempts: graded })).toEqual({ kind: "create", attemptNo: 2 })
  })

  it("refuses closed otherwise", () => {
    expect(decideSync({ ...input, canTakeNow: false })).toEqual({ kind: "refuse", reason: "closed" })
    const used = [attempt({ submittedAt: at("10:20:00"), gradedBy: "auto" })]
    expect(decideSync({ ...input, maxAttempts: 1, attempts: used })).toEqual({ kind: "refuse", reason: "closed" })
    expect(decideSync({ ...input, attempts: used, canTakeNow: false })).toEqual({ kind: "refuse", reason: "closed" })
  })
})
