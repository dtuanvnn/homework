import { describe, expect, it } from "vitest"
import { SESSION_MAX_AGE, sessionSecret, signToken, verifyToken, type SessionPayload } from "./session-token"

const secret = "test-secret"
const nowMs = Date.UTC(2026, 9, 15)
const student: SessionPayload = { v: 1, role: "student", householdId: "h1", studentId: "s1", iat: nowMs / 1000 }

describe("session token", () => {
  it("round-trips a payload", async () => {
    const token = await signToken(student, secret)
    expect(await verifyToken(token, secret, nowMs)).toEqual(student)
  })

  it("rejects a wrong secret, a tampered body and garbage", async () => {
    const token = await signToken(student, secret)
    expect(await verifyToken(token, "other", nowMs)).toBeNull()
    const [, sig] = token.split(".")
    const forged = `${Buffer.from(JSON.stringify({ ...student, studentId: "s2" })).toString("base64url")}.${sig}`
    expect(await verifyToken(forged, secret, nowMs)).toBeNull()
    expect(await verifyToken("abc", secret, nowMs)).toBeNull()
    expect(await verifyToken(undefined, secret, nowMs)).toBeNull()
    // The old cookie format (a bare hash) must fail cleanly.
    expect(await verifyToken("Zm9vYmFy", secret, nowMs)).toBeNull()
  })

  it("expires per role", async () => {
    const token = await signToken(student, secret)
    expect(await verifyToken(token, secret, nowMs + (SESSION_MAX_AGE.student + 1) * 1000)).toBeNull()
    const parent = await signToken({ v: 1, role: "parent", householdId: "h1", iat: nowMs / 1000 }, secret)
    expect(await verifyToken(parent, secret, nowMs + (SESSION_MAX_AGE.parent + 1) * 1000)).toBeNull()
  })

  it("requires a child in student tokens", async () => {
    const token = await signToken({ v: 1, role: "student", householdId: "h1", iat: nowMs / 1000 }, secret)
    expect(await verifyToken(token, secret, nowMs)).toBeNull()
  })

  it("needs SESSION_SECRET in production only", () => {
    expect(sessionSecret({ SESSION_SECRET: "x" })).toBe("x")
    expect(sessionSecret({ NODE_ENV: "development" })).toBe("homework-hub-dev-secret")
    expect(() => sessionSecret({ NODE_ENV: "production" })).toThrow("SESSION_SECRET")
  })
})
