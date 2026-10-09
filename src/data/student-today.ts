import type { Question } from "@/lib/types"
import { sampleQuestions } from "@/data/mock-data"
import type { SubjectId } from "@/lib/types"

export type TodayStatus = "not-started" | "in-progress" | "submitted" | "graded"

export interface TodayItem {
  id: string
  title: string
  subject: SubjectId
  questions: number
  minutes: number
  mode: "web" | "paper"
  status: TodayStatus
  progress?: number
  note?: string
  score?: number
  attempt: 1 | 2
  maxAttempts: 1 | 2
  due: string
}

export const todayItems: TodayItem[] = [
  { id: "t1", title: "Phép nhân trong phạm vi 1000", subject: "toan", questions: 16, minutes: 20, mode: "web", status: "in-progress", progress: 60, note: "Con nhớ đặt tính thẳng hàng nhé!", attempt: 1, maxAttempts: 2, due: "17:00" },
  { id: "t2", title: "Chính tả: Mùa thu của em", subject: "tieng-viet", questions: 10, minutes: 15, mode: "paper", status: "not-started", note: "Con làm cẩn thận nhé!", attempt: 1, maxAttempts: 1, due: "19:00" },
  { id: "t3", title: "Unit 5: My family", subject: "tieng-anh", questions: 15, minutes: 20, mode: "web", status: "not-started", attempt: 1, maxAttempts: 2, due: "20:00" },
  { id: "t4", title: "Đọc hiểu: Cậu bé thông minh", subject: "tieng-viet", questions: 8, minutes: 25, mode: "web", status: "submitted", attempt: 1, maxAttempts: 2, due: "20:00" },
  { id: "t5", title: "Bảng nhân 6, 7", subject: "toan", questions: 20, minutes: 15, mode: "web", status: "graded", score: 7, note: "Giỏi lắm! Thử lại để được 3 sao nhé.", attempt: 1, maxAttempts: 2, due: "20:00" },
]

export const upcoming: { day: string; date: string; title: string; subject: SubjectId; minutes: number }[] = [
  { day: "Thứ Sáu", date: "16/10", title: "Chu vi hình chữ nhật, hình vuông", subject: "toan", minutes: 25 },
  { day: "Thứ Sáu", date: "16/10", title: "This is / That is", subject: "tieng-anh", minutes: 20 },
  { day: "Thứ Bảy", date: "17/10", title: "Chính tả: phân biệt l/n", subject: "tieng-viet", minutes: 15 },
  { day: "Thứ Hai", date: "19/10", title: "Bài toán có lời văn", subject: "toan", minutes: 30 },
]

/** 10-question demo set covering every question type. */
export const takeQuestions: Question[] = [
  sampleQuestions[0],
  { id: "tq-02", type: "trac-nghiem", prompt: "125 × 4 = ?", points: 1, skills: ["Phép nhân"], options: ["400", "500", "450", "520"], correctIndex: 1 },
  sampleQuestions[1],
  { id: "tq-04", type: "dien-cho-trong", prompt: "234 × 2 = ___ ; 312 × 3 = ___", points: 1, skills: ["Phép nhân"], answers: ["468", "936"] },
  { ...sampleQuestions[3], id: "tq-05" },
  { id: "tq-06", type: "tra-loi-ngan", prompt: "Mỗi hộp có 108 cái bút. Hỏi 5 hộp có bao nhiêu cái bút?", points: 1, skills: ["Toán có lời văn"], answer: "540" },
  sampleQuestions[4],
  sampleQuestions[5],
  sampleQuestions[2],
  sampleQuestions[6],
]
