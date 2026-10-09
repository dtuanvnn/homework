import { addDays } from "@/lib/dates"
import { dateInput, timeLabel } from "@/lib/schedule"

export const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })

/** "Nộp lúc 19:42, hôm qua", relative to the server's `now`. */
export function submittedLabel(iso: string, now: string) {
  const d = new Date(iso)
  const today = new Date(now)
  const key = dateInput(d)
  const day =
    key === dateInput(today)
      ? "hôm nay"
      : key === dateInput(addDays(today, -1))
        ? "hôm qua"
        : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
  return `Nộp lúc ${timeLabel(iso)}, ${day}`
}

export function scoreTone(score: number) {
  if (score >= 8) return { label: "Giỏi", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600" }
  if (score >= 6.5) return { label: "Khá", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", text: "text-indigo-600" }
  if (score >= 5) return { label: "Đạt", cls: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600" }
  return { label: "Cần cố gắng", cls: "bg-red-50 text-red-700 border-red-200", text: "text-red-600" }
}
