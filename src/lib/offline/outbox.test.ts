import { describe, expect, it } from "vitest"
import { outboxPayloadSchema, toPayload, type OutboxItem } from "./outbox"

const item: OutboxItem = {
  clientId: "6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b",
  studentId: "s1",
  assignmentId: "e54e73a4-3a4a-43ae-97fa-d5a81739fa03",
  attemptNo: 1,
  setVersion: "2026-10-17T03:00:00.000Z",
  responses: { q1: 2 },
  activeSeconds: 120,
  startedAtClient: null,
  submittedAtClient: 1_792_000_000_000,
  timed: null,
  status: "pending",
}

describe("outboxPayloadSchema", () => {
  it("accepts a valid payload", () => {
    expect(outboxPayloadSchema.safeParse(toPayload(item)).success).toBe(true)
    const timed = { ...toPayload(item), timed: { deadlineMs: 1_792_000_600_000, source: "device" } }
    expect(outboxPayloadSchema.safeParse(timed).success).toBe(true)
  })

  it("strips device-only fields", () => {
    expect(toPayload({ ...item, status: "refused", refusal: "x" })).not.toHaveProperty("status")
    expect(toPayload(item)).not.toHaveProperty("studentId")
  })

  it("rejects bad ids, times and attempt numbers", () => {
    const p = toPayload(item)
    expect(outboxPayloadSchema.safeParse({ ...p, clientId: "nope" }).success).toBe(false)
    expect(outboxPayloadSchema.safeParse({ ...p, submittedAtClient: Number.NaN }).success).toBe(false)
    expect(outboxPayloadSchema.safeParse({ ...p, timed: { deadlineMs: 1, source: "phone" } }).success).toBe(false)
    expect(outboxPayloadSchema.safeParse({ ...p, attemptNo: 3 }).success).toBe(false)
  })
})
