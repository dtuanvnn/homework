import type { SubjectId } from "@/lib/types"

export interface ReviewItem {
  id: string
  prompt: string
  answer: string
  correct: boolean
  correctAnswer?: string
  comment?: string
}

export interface StudentResult {
  id: string
  title: string
  subject: SubjectId
  gradedAt: string // ISO
  score: number
  attempt: 1 | 2
  maxAttempts: 1 | 2
  previousScore?: number
  stars: 1 | 2 | 3
  parentComment: string
  review: ReviewItem[]
  /** Vocabulary sets: words to practise again (correct spelling). */
  practiceWords?: { word: string; definition: string; written?: string | null; comment?: string }[]
}

const math: ReviewItem[] = [
  { id: "q1", prompt: "7 × 8 = ?", answer: "56", correct: true },
  { id: "q2", prompt: "125 × 4 = ?", answer: "500", correct: true, comment: "Tính nhẩm nhanh lắm!" },
  { id: "q3", prompt: "Số 450 đọc là: Bốn trăm năm mươi.", answer: "Đúng", correct: true },
  { id: "q4", prompt: "234 × 2 = ___ ; 312 × 3 = ___", answer: "468 ; 936", correct: true },
  { id: "q5", prompt: "Một cửa hàng có 96 kg gạo, đã bán 1/4 số gạo. Hỏi đã bán bao nhiêu ki-lô-gam?", answer: "24", correct: false, correctAnswer: "24 kg", comment: "Đúng số rồi, con nhớ ghi đơn vị kg nhé." },
  { id: "q6", prompt: "Mỗi hộp có 108 cái bút. Hỏi 5 hộp có bao nhiêu cái bút?", answer: "540 cái bút", correct: true },
  { id: "q7", prompt: "207 × 4 = ?", answer: "818", correct: false, correctAnswer: "828", comment: "Con quên nhớ 2 sang hàng chục rồi." },
  { id: "q8", prompt: "Sắp xếp: 4 × 9 và 9 × 4 có bằng nhau không?", answer: "Có", correct: true },
  { id: "q9", prompt: "Điền số: 3 × ___ = 27", answer: "9", correct: true },
  { id: "q10", prompt: "Giải thích cách em tính 152 × 3.", answer: "Em nhân 3 với từng hàng từ phải sang trái và nhớ sang hàng bên.", correct: true, comment: "Giải thích rất rõ ràng 👍" },
]

export const results: StudentResult[] = [
  {
    id: "kq-01", title: "Bảng nhân 6, 7", subject: "toan", gradedAt: "2026-10-14T20:30:00", score: 8.5, attempt: 2, maxAttempts: 2, previousScore: 6.5, stars: 3,
    parentComment: "Giỏi lắm! Lần này con cẩn thận hơn nhiều. Chỉ cần nhớ ghi đơn vị và kiểm tra lại phép nhớ là được 10 điểm đó!",
    review: math,
  },
  {
    id: "kq-02", title: "Unit 3: At school – Vocabulary", subject: "tieng-anh", gradedAt: "2026-10-13T21:00:00", score: 8.75, attempt: 1, maxAttempts: 2, stars: 2,
    parentComment: "Con nhớ từ vựng rất tốt. Luyện thêm phần nghe nhé!",
    review: [
      { id: "e1", prompt: "pencil = ?", answer: "bút chì", correct: true },
      { id: "e2", prompt: "Nối: ruler – thước kẻ", answer: "thước kẻ", correct: true },
      { id: "e3", prompt: "This is my ___ (cặp sách).", answer: "bag", correct: false, correctAnswer: "school bag", comment: "Gần đúng rồi!" },
      { id: "e4", prompt: "eraser = ?", answer: "cục tẩy", correct: true },
    ],
  },
  {
    id: "kq-03", title: "Chính tả: phân biệt l/n", subject: "tieng-viet", gradedAt: "2026-10-13T20:10:00", score: 8, attempt: 1, maxAttempts: 1, stars: 2,
    parentComment: "Chữ viết đẹp và ít lỗi hơn hẳn. Mẹ rất vui!",
    review: [
      { id: "v1", prompt: "Điền l hoặc n: ___o lắng", answer: "lo lắng", correct: true },
      { id: "v2", prompt: "Điền l hoặc n: ___ăm học", answer: "lăm học", correct: false, correctAnswer: "năm học", comment: "Đọc to lên con sẽ nghe ra nhé." },
      { id: "v3", prompt: "Điền l hoặc n: quả ___a", answer: "quả na", correct: true },
    ],
  },
  {
    id: "kq-04", title: "Phép chia có dư", subject: "toan", gradedAt: "2026-10-12T21:05:00", score: 5, attempt: 1, maxAttempts: 2, stars: 1,
    parentComment: "Con cố lên nhé! Nhớ: số dư luôn bé hơn số chia.",
    review: [
      { id: "c1", prompt: "17 : 5 = ? dư ?", answer: "3 dư 2", correct: true },
      { id: "c2", prompt: "29 : 4 = ? dư ?", answer: "6 dư 5", correct: false, correctAnswer: "7 dư 1", comment: "Số dư 5 lớn hơn số chia 4 rồi." },
    ],
  },
  {
    id: "kq-05", title: "This is / That is", subject: "tieng-anh", gradedAt: "2026-09-29T20:40:00", score: 9, attempt: 2, maxAttempts: 2, previousScore: 7.5, stars: 3,
    parentComment: "Rất tốt! Gần như đúng hết rồi.",
    review: [{ id: "t1", prompt: "___ is my pen (gần).", answer: "This", correct: true }],
  },
]

/** Called by the parent grading screen so the child's result reflects the latest grade (mock, in-memory). */
export function publishResult(r: StudentResult) {
  const i = results.findIndex((x) => x.title === r.title)
  if (i >= 0) results[i] = r
  else results.unshift(r)
}

export const resultForTitle = (title: string) => results.find((r) => r.title === title) ?? results[0]
