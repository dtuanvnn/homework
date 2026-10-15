import { describe, expect, it } from "vitest"
import { clockLabel, deadlineOf, isExpired, mergeActiveSeconds, remainingSeconds, timedDuration, warningLevel } from "./timer"

const start = new Date("2026-10-15T10:00:00Z")
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000)

describe("deadlineOf", () => {
  it("adds the limit in minutes", () => {
    expect(deadlineOf(start, 20).toISOString()).toBe("2026-10-15T10:20:00.000Z")
  })
})

describe("remainingSeconds", () => {
  const deadline = deadlineOf(start, 1)
  it("rounds partial seconds up", () => {
    expect(remainingSeconds(deadline, new Date(start.getTime() + 500))).toBe(60)
  })
  it("never goes below zero", () => {
    expect(remainingSeconds(deadline, at(600))).toBe(0)
  })
})

describe("warningLevel", () => {
  it("uses 5 minutes for long limits", () => {
    const limit = 30 * 60
    expect(warningLevel(301, limit)).toBe("none")
    expect(warningLevel(300, limit)).toBe("warn")
    expect(warningLevel(61, limit)).toBe("warn")
    expect(warningLevel(60, limit)).toBe("urgent")
    expect(warningLevel(11, limit)).toBe("urgent")
    expect(warningLevel(10, limit)).toBe("final")
    expect(warningLevel(0, limit)).toBe("final")
  })
  it("uses 20% of the limit for short limits", () => {
    expect(warningLevel(121, 600)).toBe("none")
    expect(warningLevel(120, 600)).toBe("warn")
    expect(warningLevel(241, 1200)).toBe("none")
    expect(warningLevel(240, 1200)).toBe("warn")
  })
  it("still has an urgent level for a 2-minute limit", () => {
    expect(warningLevel(100, 120)).toBe("none")
    expect(warningLevel(60, 120)).toBe("urgent")
  })
})

describe("timedDuration", () => {
  it("is the time since the start", () => {
    expect(timedDuration(start, 20, at(754.4))).toBe(754)
  })
  it("caps at the limit", () => {
    expect(timedDuration(start, 20, at(5000))).toBe(1200)
  })
  it("is never negative", () => {
    expect(timedDuration(start, 20, at(-30))).toBe(0)
  })
})

describe("mergeActiveSeconds", () => {
  it("keeps the larger value", () => {
    expect(mergeActiveSeconds(300, 120)).toBe(300)
    expect(mergeActiveSeconds(300, 420)).toBe(420)
    expect(mergeActiveSeconds(null, 42.6)).toBe(43)
  })
  it("clamps to 6 hours", () => {
    expect(mergeActiveSeconds(null, 99_999)).toBe(6 * 3600)
  })
  it("ignores values that are not numbers", () => {
    expect(mergeActiveSeconds(90, Number.NaN)).toBe(90)
    expect(mergeActiveSeconds(90, "600")).toBe(90)
    expect(mergeActiveSeconds(null, undefined)).toBe(0)
    expect(mergeActiveSeconds(null, -5)).toBe(0)
  })
})

describe("isExpired", () => {
  it("allows 30 seconds of grace after the deadline", () => {
    expect(isExpired(start, 1, at(90))).toBe(false)
    expect(isExpired(start, 1, at(91))).toBe(true)
  })
})

describe("clockLabel", () => {
  it("formats minutes and seconds", () => {
    expect(clockLabel(0)).toBe("00:00")
    expect(clockLabel(754)).toBe("12:34")
    expect(clockLabel(3725)).toBe("1:02:05")
  })
})
