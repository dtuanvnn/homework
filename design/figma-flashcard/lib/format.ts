const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

const pad = (n: number) => String(n).padStart(2, '0')

export function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value
}

/** "12/10/2026" */
export function formatShortDate(value: string | Date): string {
  const d = toDate(value)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** "Thứ Hai" */
export function formatWeekday(value: string | Date): string {
  return WEEKDAYS[toDate(value).getDay()]
}

/** "Thứ Hai, 12/10/2026" */
export function formatVietnameseDate(value: string | Date): string {
  return `${formatWeekday(value)}, ${formatShortDate(value)}`
}

/** "8,5" */
export function formatScoreValue(score: number): string {
  return score.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

/** "8,5/10" */
export function formatScore(score: number, max = 10): string {
  return `${formatScoreValue(score)}/${max}`
}

/** "85%" */
export function formatPercent(score: number, max = 10): string {
  return `${Math.round((score / max) * 100)}%`
}

/** "17:00" */
export function formatTime(value: string | Date): string {
  const d = toDate(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "07/09" */
export function formatDayMonth(value: string | Date): string {
  const d = toDate(value)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

/** Signed delta with Vietnamese decimal comma: "+0,6" / "−0,3" */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±'
  return `${sign}${formatScoreValue(Math.abs(rounded))}`
}

/** Time-of-day greeting. */
export function getGreeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 11) return 'Chào buổi sáng!'
  if (h < 13) return 'Chào buổi trưa!'
  if (h < 18) return 'Chào buổi chiều!'
  return 'Chào buổi tối!'
}
