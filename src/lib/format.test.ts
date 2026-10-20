import { describe, expect, it } from "vitest"
import { formatPoints } from "./format"

describe("formatPoints", () => {
  it("shows exact values as is and marks rounded ones with ≈", () => {
    expect(formatPoints(1.5)).toBe("1,5")
    expect(formatPoints(1 / 3 + 1 / 3 + 1 / 3)).toBe("1")
    expect(formatPoints(2 / 3)).toBe("≈0,67")
  })
})
