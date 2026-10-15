import { describe, expect, it } from "vitest"
import { localDay } from "./dates"
import { isLocked, lockUntil } from "./student-lock"

const now = new Date(2026, 9, 15, 18, 0)

describe("student lock", () => {
  it("is unlocked without lockedAt", () => {
    expect(isLocked({ lockedAt: null, lockedUntil: null }, now)).toBe(false)
  })
  it("stays locked until unlocked by hand when there is no end", () => {
    expect(isLocked({ lockedAt: new Date(2026, 9, 1), lockedUntil: null }, now)).toBe(true)
  })
  it("lifts by itself at lockedUntil", () => {
    expect(isLocked({ lockedAt: now, lockedUntil: new Date(2026, 9, 15, 19, 0) }, now)).toBe(true)
    expect(isLocked({ lockedAt: now, lockedUntil: new Date(2026, 9, 15, 18, 0) }, now)).toBe(false)
    expect(isLocked({ lockedAt: now.toISOString(), lockedUntil: new Date(2026, 9, 15, 17, 0).toISOString() }, now)).toBe(false)
  })
  it("turns choices into end times", () => {
    expect(lockUntil("1h", now)).toEqual(new Date(2026, 9, 15, 19, 0))
    expect(lockUntil("today", now)).toEqual(new Date(2026, 9, 16, 0, 0))
    expect(lockUntil("manual", now)).toBeNull()
    expect(lockUntil({ at: new Date(2026, 9, 15, 20, 0).toISOString() }, now)).toEqual(new Date(2026, 9, 15, 20, 0))
  })
  it("rejects a custom end in the past", () => {
    expect(() => lockUntil({ at: new Date(2026, 9, 15, 17, 0).toISOString() }, now)).toThrow("Giờ mở khoá phải sau bây giờ.")
  })
  it("formats local days", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05")
  })
})
