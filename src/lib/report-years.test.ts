import { describe, expect, it } from "vitest"
import { yearCustomRange } from "./report-years"

const years = [
  { schoolYear: 2025, grade: 2, className: null, startsOn: "2025-09-05" },
  { schoolYear: 2026, grade: 3, className: null, startsOn: "2026-09-05" },
]

describe("report year ranges", () => {
  it("covers a past year up to the day before the next start", () => {
    expect(yearCustomRange(years, 2025, "2026-10-15")).toEqual({ from: "2025-09-05", to: "2026-09-04" })
  })
  it("ends the current year today", () => {
    expect(yearCustomRange(years, 2026, "2026-10-15")).toEqual({ from: "2026-09-05", to: "2026-10-15" })
  })
  it("returns null for an unknown year", () => {
    expect(yearCustomRange(years, 2020, "2026-10-15")).toBeNull()
  })
})
