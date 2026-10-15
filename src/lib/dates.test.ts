import { describe, expect, it } from "vitest"
import { formatLockEnd, localDay } from "./dates"

describe("formatLockEnd", () => {
  it("shows only HH:MM when lock end is today", () => {
    const today = new Date()
    today.setHours(14, 30, 0, 0)
    const result = formatLockEnd(today.toISOString())
    expect(result).toBe("14:30")
  })

  it("shows dd/MM HH:MM when lock end is another day", () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(14, 30, 0, 0)
    const result = formatLockEnd(tomorrow.toISOString())
    const [, month, day] = localDay(tomorrow).split("-")
    expect(result).toBe(`${day}/${month} 14:30`)
  })

  it("shows dd/MM HH:MM when lock end is in the past", () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(14, 30, 0, 0)
    const result = formatLockEnd(yesterday.toISOString())
    const [, month, day] = localDay(yesterday).split("-")
    expect(result).toBe(`${day}/${month} 14:30`)
  })
})
