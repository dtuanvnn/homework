import { describe, expect, it } from "vitest"
import type { LocalDraft } from "./drafts"
import { planPackUpdate, staleDrafts, type PackEntry, type PackResponse } from "./pack"

type Incoming = PackResponse["entries"][number]

const incoming = (assignmentId: string, version = "v1"): Incoming => ({
  assignmentId,
  version,
  setVersion: "s1",
  title: "Bài",
  subject: "toan",
  dueAt: "2026-10-17T13:00:00.000Z",
  availableFrom: "2026-10-16T01:00:00.000Z",
  timeLimitMinutes: null,
  attemptNo: 1,
  questions: [],
  draft: null,
})
const stored = (assignmentId: string, version = "v1", complete = true): PackEntry => ({ ...incoming(assignmentId, version), studentId: "st", complete })

describe("planPackUpdate", () => {
  it("keeps entries with local work", () => {
    const plan = planPackUpdate([stored("a"), stored("b")], [incoming("b", "v2")], new Set(["a", "b"]))
    expect(plan.remove).toEqual([])
    expect(plan.put).toEqual([])
  })

  it("skips unchanged complete entries and re-downloads incomplete ones", () => {
    expect(planPackUpdate([stored("a")], [incoming("a")], new Set()).put).toEqual([])
    expect(planPackUpdate([stored("a", "v1", false)], [incoming("a")], new Set()).put.map((e) => e.assignmentId)).toEqual(["a"])
  })

  it("adds new and changed entries, removes stale ones", () => {
    const plan = planPackUpdate([stored("a"), stored("old")], [incoming("a", "v2"), incoming("new")], new Set())
    expect(plan.put.map((e) => e.assignmentId)).toEqual(["a", "new"])
    expect(plan.remove).toEqual(["old"])
  })
})

const draft = (assignmentId: string, attemptNo: number, origin: "server" | "device" = "server"): LocalDraft => ({
  studentId: "st", assignmentId, attemptNo, origin, responses: {}, activeSeconds: 0, startedAtClient: null, timed: null, setVersion: "s1", updatedAt: 1,
})

describe("staleDrafts", () => {
  it("drops drafts of an attempt the server has moved past", () => {
    expect(staleDrafts([draft("a", 1)], [{ ...incoming("a"), attemptNo: 2 }], new Set())).toEqual(["a"])
    expect(staleDrafts([draft("a", 1)], [incoming("a")], new Set())).toEqual([])
  })

  it("drops server-owned drafts of work no longer open, keeps device work and queued hand-ins", () => {
    expect(staleDrafts([draft("gone", 1)], [], new Set())).toEqual(["gone"])
    expect(staleDrafts([draft("mine", 1, "device")], [], new Set())).toEqual([])
    expect(staleDrafts([draft("queued", 1)], [], new Set(["queued"]))).toEqual([])
  })
})
