import { TODAY } from "@/data/mock-data"
import { addDays, startOfWeek } from "@/lib/dates"
import type { SubjectId } from "@/lib/types"

export type RangeId = "4w" | "3m" | "hk" | "custom"
export const RANGE_WEEKS: Record<RangeId, number> = { "4w": 4, "3m": 13, hk: 18, custom: 8 }

/** Deterministic pseudo-random so charts are stable between renders. */
const noise = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const BASE: Record<SubjectId, number> = { toan: 7.4, "tieng-viet": 7.1, "tieng-anh": 7.9 }

export interface WeekPoint {
  week: string
  toan: number
  "tieng-viet": number
  "tieng-anh": number
}

export function weeklyScores(weeks: number): WeekPoint[] {
  const start = startOfWeek(TODAY)
  return Array.from({ length: weeks }, (_, i) => {
    const offset = weeks - 1 - i
    const d = addDays(start, -7 * offset)
    const growth = (i / Math.max(weeks - 1, 1)) * 1.1
    const point = { week: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) } as WeekPoint
    ;(Object.keys(BASE) as SubjectId[]).forEach((s, k) => {
      const v = BASE[s] + growth + (noise(offset * 3 + k) - 0.5) * 1.2
      point[s] = Math.min(10, Math.round(v * 4) / 4)
    })
    return point
  })
}

export interface Kpis {
  completed: number
  average: number
  onTime: number
  retryGain: number
  deltas: { completed: number; average: number; onTime: number; retryGain: number }
}

export const KPIS: Record<RangeId, Kpis> = {
  "4w": { completed: 42, average: 8.2, onTime: 90, retryGain: 1.4, deltas: { completed: 6, average: 0.4, onTime: 5, retryGain: 0.2 } },
  "3m": { completed: 128, average: 7.9, onTime: 87, retryGain: 1.3, deltas: { completed: 14, average: 0.6, onTime: 3, retryGain: 0.1 } },
  hk: { completed: 176, average: 7.8, onTime: 86, retryGain: 1.2, deltas: { completed: 20, average: 0.7, onTime: 4, retryGain: 0.3 } },
  custom: { completed: 81, average: 8.0, onTime: 88, retryGain: 1.3, deltas: { completed: 9, average: 0.5, onTime: 2, retryGain: 0.1 } },
}

export const SKILLS: { skill: string; subject: SubjectId; accuracy: number }[] = [
  { skill: "Bảng nhân 7, 8", subject: "toan", accuracy: 72 },
  { skill: "Toán có lời văn", subject: "toan", accuracy: 54 },
  { skill: "Đo độ dài", subject: "toan", accuracy: 83 },
  { skill: "Dấu hỏi/ngã", subject: "tieng-viet", accuracy: 58 },
  { skill: "Từ chỉ đặc điểm", subject: "tieng-viet", accuracy: 76 },
  { skill: "Vocabulary: Family", subject: "tieng-anh", accuracy: 91 },
  { skill: "Grammar: to be", subject: "tieng-anh", accuracy: 68 },
]

export const RETRIES: { title: string; subject: SubjectId; first: number; second: number }[] = [
  { title: "Phép chia có dư", subject: "toan", first: 5, second: 7.5 },
  { title: "Bảng nhân 6, 7", subject: "toan", first: 7, second: 8.5 },
  { title: "Chính tả: dấu hỏi, dấu ngã", subject: "tieng-viet", first: 6.5, second: 7.5 },
  { title: "Đọc hiểu: Cậu bé thông minh", subject: "tieng-viet", first: 7, second: 8 },
  { title: "This is / That is", subject: "tieng-anh", first: 7.5, second: 9 },
  { title: "Colours and numbers 1–20", subject: "tieng-anh", first: 7.5, second: 8.5 },
]

/** Completed assignments per day for the heatmap (last N weeks, Monday-first). */
export function activity(weeks: number) {
  const end = startOfWeek(TODAY)
  const first = addDays(end, -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d)
      const future = date > TODAY
      const r = noise(w * 7 + d + 11)
      const count = future ? -1 : d === 6 ? (r > 0.7 ? 1 : 0) : r < 0.12 ? 0 : r < 0.45 ? 1 : r < 0.85 ? 2 : 3
      return { date, count }
    }),
  )
}

export const AVG_MINUTES: Record<SubjectId, number> = { toan: 21, "tieng-viet": 19, "tieng-anh": 15 }

export const AI_SUMMARY =
  "Tuần này Minh An làm bài rất đều đặn, 5/7 ngày đều có bài hoàn thành và điểm Tiếng Anh tiếp tục dẫn đầu. Con tiến bộ rõ ở bảng nhân sau lần làm lại thứ hai. Hai điểm cần chú ý là bài toán có lời văn (con hay quên viết câu trả lời) và phân biệt dấu hỏi/ngã."

export const AI_STEPS: { text: string; detail: string; setId: string; subject: SubjectId }[] = [
  { text: "Luyện bài toán có lời văn hai bước", detail: "15 phút, nhắc con tóm tắt đề trước khi giải", setId: "bt-04", subject: "toan" },
  { text: "Ôn chính tả dấu hỏi, dấu ngã", detail: "Bài ngắn 16 câu, nên đọc to khi làm", setId: "bt-09", subject: "tieng-viet" },
  { text: "Củng cố Grammar: to be", detail: "Bài this/that giúp con quen cấu trúc câu", setId: "bt-14", subject: "tieng-anh" },
]
