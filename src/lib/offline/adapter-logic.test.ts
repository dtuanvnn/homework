import { describe, expect, it } from "vitest"
import { classify, submitRoute } from "./adapter-logic"

describe("submitRoute", () => {
  it("queues device-started work even when online", () => {
    expect(submitRoute("device", true)).toBe("outbox")
  })

  it("queues when offline, sends when online", () => {
    expect(submitRoute("server", false)).toBe("outbox")
    expect(submitRoute("server", true)).toBe("server")
  })
})

describe("classify", () => {
  it("submit falls back to outbox on network error", () => {
    // A server action that threw (no reply) is a network failure, not a refusal.
    expect(classify(null).kind).toBe("network")
  })

  it("keeps server refusals and successes apart", () => {
    expect(classify({ ok: false, error: "x" })).toEqual({ kind: "server", error: "x", expired: undefined })
    expect(classify({ ok: false, error: "y", expired: true })).toEqual({ kind: "server", error: "y", expired: true })
    expect(classify({ ok: true })).toEqual({ kind: "ok", value: { ok: true } })
  })
})
