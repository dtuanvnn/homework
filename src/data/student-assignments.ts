import { TODAY } from "@/data/mock-data"
import { addDays } from "@/lib/dates"
import type { SubjectId } from "@/lib/types"

export type MyStatus = "not-started" | "in-progress" | "submitted" | "graded"

export interface MyAssignment {
  id: string
  title: string
  subject: SubjectId
  mode: "web" | "paper"
  questions: number
  minutes: number
  due: string // ISO
  status: MyStatus
  progress?: number
  attempt: 1 | 2
  maxAttempts: 1 | 2
  score?: number
  previousScore?: number
}

const at = (day: number, h: number, m = 0) => {
  const d = addDays(TODAY, day)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

type Seed = Omit<MyAssignment, "id" | "attempt" | "maxAttempts"> & Partial<Pick<MyAssignment, "attempt" | "maxAttempts">>

const seeds: Seed[] = [
  // Cần làm
  { title: "Phép chia có dư", subject: "toan", mode: "web", questions: 12, minutes: 20, due: at(-1, 20), status: "in-progress", progress: 40 },
  { title: "Bảng nhân 8", subject: "toan", mode: "web", questions: 10, minutes: 15, due: at(0, 20), status: "not-started" },
  { title: "Tập làm văn: Tả con vật em yêu", subject: "tieng-viet", mode: "paper", questions: 1, minutes: 30, due: at(1, 19), status: "not-started", maxAttempts: 1 },
  { title: "Unit 6: My school – Listening", subject: "tieng-anh", mode: "web", questions: 12, minutes: 20, due: at(5, 20), status: "not-started" },
  // Chờ chấm
  { title: "Đọc hiểu: Cậu bé thông minh", subject: "tieng-viet", mode: "web", questions: 8, minutes: 25, due: at(-1, 20), status: "submitted" },
  { title: "Phép nhân trong phạm vi 1000", subject: "toan", mode: "paper", questions: 16, minutes: 20, due: at(0, 17), status: "submitted" },
  // Làm lại
  { title: "Bảng nhân 6, 7", subject: "toan", mode: "web", questions: 20, minutes: 15, due: at(-3, 20), status: "graded", score: 7 },
  // Đã xong
  { title: "Unit 3: At school – Vocabulary", subject: "tieng-anh", mode: "web", questions: 14, minutes: 15, due: at(-2, 20), status: "graded", score: 8.75, maxAttempts: 1 },
  { title: "Chính tả: phân biệt l/n", subject: "tieng-viet", mode: "paper", questions: 15, minutes: 15, due: at(-2, 20), status: "graded", score: 8, maxAttempts: 1 },
  { title: "Bảng nhân 6, 7 (ôn)", subject: "toan", mode: "web", questions: 20, minutes: 15, due: at(-3, 20), status: "graded", score: 8.5, attempt: 2, previousScore: 6.5 },
  { title: "Xem đồng hồ và tính thời gian", subject: "toan", mode: "web", questions: 15, minutes: 15, due: at(-8, 20), status: "graded", score: 8, maxAttempts: 1 },
  { title: "Viết đoạn văn kể về gia đình", subject: "tieng-viet", mode: "paper", questions: 1, minutes: 30, due: at(-9, 20), status: "graded", score: 7, maxAttempts: 1 },
  { title: "Unit 3: At school (ôn)", subject: "tieng-anh", mode: "web", questions: 14, minutes: 15, due: at(-8, 20), status: "graded", score: 8.5, maxAttempts: 1 },
  { title: "Chu vi hình chữ nhật, hình vuông", subject: "toan", mode: "paper", questions: 10, minutes: 25, due: at(-6, 20), status: "graded", score: 7.75, maxAttempts: 1 },
  { title: "This is / That is", subject: "tieng-anh", mode: "web", questions: 12, minutes: 20, due: at(-16, 20), status: "graded", score: 9, attempt: 2, previousScore: 7.5 },
  { title: "Colours and numbers 1–20", subject: "tieng-anh", mode: "web", questions: 20, minutes: 15, due: at(-17, 20), status: "graded", score: 7.5, maxAttempts: 1 },
  { title: "Chính tả: dấu hỏi, dấu ngã", subject: "tieng-viet", mode: "web", questions: 16, minutes: 15, due: at(-22, 20), status: "graded", score: 6.5, maxAttempts: 1 },
  { title: "Unit 2: My friends", subject: "tieng-anh", mode: "web", questions: 15, minutes: 15, due: at(-30, 20), status: "graded", score: 8, maxAttempts: 1 },
  { title: "Bài toán có lời văn (hai phép tính)", subject: "toan", mode: "web", questions: 6, minutes: 30, due: at(-29, 20), status: "graded", score: 6.5, maxAttempts: 1 },
]

export const myAssignments: MyAssignment[] = seeds.map((s, i) => ({
  attempt: 1,
  maxAttempts: 2,
  ...s,
  id: `ba-${String(i + 1).padStart(2, "0")}`,
}))
