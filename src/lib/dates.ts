export function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  return addDays(day, -((day.getDay() + 6) % 7))
}

/** Local calendar day as "yyyy-mm-dd". */
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Format lock end time: HH:MM when today, dd/MM HH:MM otherwise. */
export function formatLockEnd(until: string): string {
  const end = new Date(until)
  const today = localDay(new Date())
  const endDay = localDay(end)
  const time = end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  if (endDay === today) return time
  const [, month, day] = endDay.split("-")
  return `${day}/${month} ${time}`
}
