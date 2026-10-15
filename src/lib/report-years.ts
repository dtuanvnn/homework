import { localDay } from "./dates"
import { yearRange, type Enrollment } from "./school-year"

function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  return localDay(new Date(y, m - 1, d - 1))
}

/** A school year as the Reports page's inclusive custom range (never past today). */
export function yearCustomRange(list: Enrollment[], schoolYear: number, today: string): { from: string; to: string } | null {
  const range = yearRange(list, schoolYear)
  if (!range) return null
  const end = range.to ? dayBefore(range.to) : today
  return { from: range.from, to: end < today ? end : today }
}
