import { describe, expect, it } from "vitest"
import { currentEnrollment, schoolYearLabel, schoolYearOf, schoolYearStart, suggestPromotion, yearOf, yearRange, type Enrollment } from "./school-year"

const y2025: Enrollment = { schoolYear: 2025, grade: 2, className: "2A", startsOn: "2025-09-05" }
const y2026: Enrollment = { schoolYear: 2026, grade: 3, className: "3C1", startsOn: "2026-09-05" }

describe("school year", () => {
  it("names and starts years on 5 September", () => {
    expect(schoolYearStart(2026)).toBe("2026-09-05")
    expect(schoolYearLabel(2026)).toBe("2026–2027")
    expect(schoolYearOf("2026-09-04")).toBe(2025)
    expect(schoolYearOf("2026-09-05")).toBe(2026)
    expect(schoolYearOf("2027-01-10")).toBe(2026)
  })

  it("picks the latest enrollment that has started", () => {
    expect(currentEnrollment([y2026, y2025], "2026-10-15")).toEqual(y2026)
    expect(currentEnrollment([y2025, y2026], "2026-08-01")).toEqual(y2025)
    expect(currentEnrollment([], "2026-10-15")).toBeNull()
  })

  it("falls back to the earliest when every enrollment is in the future", () => {
    expect(currentEnrollment([y2026], "2026-01-01")).toEqual(y2026)
  })

  it("gives half-open ranges between consecutive starts", () => {
    expect(yearRange([y2026, y2025], 2025)).toEqual({ from: "2025-09-05", to: "2026-09-05" })
    expect(yearRange([y2026, y2025], 2026)).toEqual({ from: "2026-09-05", to: null })
    expect(yearRange([y2026], 2024)).toBeNull()
  })

  it("places a day in its year, the next start belonging to the next year", () => {
    expect(yearOf([y2025, y2026], "2026-09-04")).toBe(2025)
    expect(yearOf([y2025, y2026], "2026-09-05")).toBe(2026)
    expect(yearOf([y2025, y2026], "2025-01-01")).toBeNull()
  })

  it("suggests the next grade and year", () => {
    expect(suggestPromotion(y2026)).toEqual({ schoolYear: 2027, grade: 4, className: null, startsOn: "2027-09-05" })
    expect(suggestPromotion({ ...y2026, grade: 12 }).grade).toBe(12)
  })
})
