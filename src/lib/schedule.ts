import { addDays, startOfWeek } from "@/lib/dates"
import { uid } from "@/lib/questions"
import type { Assignment } from "@/lib/types"

export const DAY_LABELS = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
]
export const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
export function dateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
/** Value for an `<input type="datetime-local">` (local wall clock, minutes). */
export function dateTimeInput(date: Date): string {
  return `${dateInput(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}
export function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}
export const shortDate = (date: Date) =>
  date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
export const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })

export interface ScheduleDraft {
  exerciseSetId: string
  mode: "web" | "paper"
  schedule: "day" | "week" | "later"
  date: string
  days: string[]
  start: string
  dueDate: string
  dueTime: string
  maxAttempts: 1 | 2
  /** Web work only; null = untimed. */
  timeLimitMinutes: number | null
  note: string
}

export function createAssignments(draft: ScheduleDraft): Assignment[] {
  if (!draft.exerciseSetId) throw new Error("Hãy chọn một bộ bài tập.")
  if (!draft.dueTime || !draft.date)
    throw new Error("Hãy chọn ngày và giờ đến hạn.")
  if (draft.schedule === "week" && !draft.days.length)
    throw new Error("Chọn ít nhất một ngày trong tuần.")
  const dates =
    draft.schedule === "week"
      ? draft.days.map((day) =>
          addDays(startOfWeek(localDate(draft.date)), Number(day)),
        )
      : [localDate(draft.date)]
  return dates.map((date) => {
    const assigned =
      draft.schedule === "later"
        ? new Date(draft.start)
        : new Date(`${dateInput(date)}T07:00:00`)
    const due = new Date(
      `${
        draft.schedule === "later" ? draft.dueDate : dateInput(date)
      }T${draft.dueTime}:00`,
    )
    if (!Number.isFinite(assigned.getTime()) || !Number.isFinite(due.getTime()))
      throw new Error("Ngày và giờ chưa hợp lệ.")
    if (due <= assigned)
      throw new Error(
        "Giờ đến hạn phải sau thời điểm mở bài (07:00 với lịch ngày/tuần).",
      )
    return {
      id: uid("gb"),
      exerciseSetId: draft.exerciseSetId,
      mode: draft.mode,
      maxAttempts: draft.maxAttempts,
      timeLimitMinutes: draft.mode === "web" ? (draft.timeLimitMinutes ?? undefined) : undefined,
      assignedDate: assigned.toISOString(),
      dueDate: due.toISOString(),
      status: "chua-lam",
      parentNote: draft.note.trim() || undefined,
    }
  })
}
