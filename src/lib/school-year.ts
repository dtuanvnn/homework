/*
 * School years per child. A year is named by its start year (2026 = "2026–2027")
 * and runs from its enrollment's startsOn to the next enrollment's startsOn.
 * Days are local "yyyy-mm-dd" strings, which compare correctly as text.
 */

export interface Enrollment {
  schoolYear: number
  grade: number
  className: string | null
  startsOn: string
}

const byStart = (a: Enrollment, b: Enrollment) => a.startsOn.localeCompare(b.startsOn)

export const schoolYearStart = (year: number) => `${year}-09-05`

export const schoolYearLabel = (year: number) => `${year}–${year + 1}`

/** The school year a day falls into by the default calendar (used when no enrollment exists yet). */
export function schoolYearOf(day: string): number {
  const year = Number(day.slice(0, 4))
  return day >= schoolYearStart(year) ? year : year - 1
}

export function currentEnrollment(list: Enrollment[], today: string): Enrollment | null {
  const sorted = [...list].sort(byStart)
  return sorted.filter((e) => e.startsOn <= today).at(-1) ?? sorted[0] ?? null
}

/** Half-open [from, to) range of a year; `to` is null for the latest year. */
export function yearRange(list: Enrollment[], schoolYear: number): { from: string; to: string | null } | null {
  const sorted = [...list].sort(byStart)
  const i = sorted.findIndex((e) => e.schoolYear === schoolYear)
  if (i < 0) return null
  return { from: sorted[i].startsOn, to: sorted[i + 1]?.startsOn ?? null }
}

export function yearOf(list: Enrollment[], day: string): number | null {
  let found: number | null = null
  for (const e of [...list].sort(byStart)) if (e.startsOn <= day) found = e.schoolYear
  return found
}

export function suggestPromotion(current: Enrollment): Enrollment {
  const schoolYear = current.schoolYear + 1
  return { schoolYear, grade: Math.min(12, current.grade + 1), className: null, startsOn: schoolYearStart(schoolYear) }
}
