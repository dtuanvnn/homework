import { TODAY } from "@/data/mock-data"
import { addDays } from "@/lib/dates"

export interface Submission {
  id: string
  assignmentId: string
  exerciseSetId: string
  attempt: 1 | 2
  maxAttempts: 1 | 2
  submittedAt: string
  mode: "web" | "paper"
  /** Objective questions graded automatically. */
  autoCorrect: number
  autoTotal: number
  /** Open-ended questions waiting for the parent, with max points each. */
  essays: { id: string; prompt: string; answer: string; maxPoints: number }[]
  /** Set once graded, on a 10-point scale. */
  finalScore?: number
  feedback?: string
  /** Child will redo the set after this grade. */
  retryPending?: boolean
  /** Flashcard sets: what the child handwrote per card id (null = left blank). */
  handwriting?: Record<string, string | null>
}

const at = (dayOffset: number, h: number, m: number) => {
  const d = addDays(TODAY, dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export const submissions: Submission[] = [
  {
    id: "nb-fc", assignmentId: "gb-fc", exerciseSetId: "bt-fc-01", attempt: 1, maxAttempts: 2,
    submittedAt: at(0, 19, 20), mode: "web", autoCorrect: 0, autoTotal: 12, essays: [],
    handwriting: {
      "fc-u3-01": "habitat", "fc-u3-02": "desert", "fc-u3-03": "rainforist", "fc-u3-04": "burrow",
      "fc-u3-05": "nest", "fc-u3-06": "ocean", "fc-u3-07": "hive", "fc-u3-08": "pond",
      "fc-u3-09": "cave", "fc-u3-10": "web", "fc-u3-11": "forest", "fc-u3-12": null,
    },
  },
  {
    id: "nb-01", assignmentId: "gb-05", exerciseSetId: "bt-08", attempt: 1, maxAttempts: 2,
    submittedAt: at(-1, 19, 42), mode: "web", autoCorrect: 6, autoTotal: 7,
    essays: [{ id: "e1", prompt: "Vì sao cậu bé được vua khen là thông minh?", answer: "Vì cậu bé nghĩ ra cách để vua thấy lệnh của vua là vô lí, cậu không sợ mà rất bình tĩnh.", maxPoints: 1 }],
  },
  {
    id: "nb-02", assignmentId: "gb-06", exerciseSetId: "bt-06", attempt: 2, maxAttempts: 2,
    submittedAt: at(0, 17, 5), mode: "paper", autoCorrect: 12, autoTotal: 14,
    essays: [
      { id: "e1", prompt: "Bài 15: Mỗi thùng có 125 quyển vở. Hỏi 4 thùng có bao nhiêu quyển?", answer: "(Bài làm trên giấy – xem ảnh scan)", maxPoints: 1 },
      { id: "e2", prompt: "Bài 16: Đặt tính rồi tính 207 × 4", answer: "(Bài làm trên giấy – xem ảnh scan)", maxPoints: 1 },
    ],
  },
  {
    id: "nb-03", assignmentId: "gb-03", exerciseSetId: "bt-12", attempt: 1, maxAttempts: 2,
    submittedAt: at(-2, 19, 30), mode: "web", autoCorrect: 12, autoTotal: 14, essays: [],
    finalScore: 8.5, feedback: "Giới thiệu bạn rất tự nhiên.", retryPending: true,
  },
  {
    id: "nb-04", assignmentId: "gb-02", exerciseSetId: "bt-07", attempt: 1, maxAttempts: 1,
    submittedAt: at(-2, 20, 10), mode: "paper", autoCorrect: 12, autoTotal: 15, essays: [],
    finalScore: 8, feedback: "Viết đẹp và ít lỗi hơn hẳn.",
  },
  {
    id: "nb-05", assignmentId: "gb-01", exerciseSetId: "bt-01", attempt: 2, maxAttempts: 2,
    submittedAt: at(-3, 19, 15), mode: "web", autoCorrect: 18, autoTotal: 20, essays: [],
    finalScore: 9, feedback: "Bảng nhân 7 đã thuộc rồi, giỏi lắm!",
  },
  {
    id: "nb-06", assignmentId: "gb-04", exerciseSetId: "bt-02", attempt: 1, maxAttempts: 2,
    submittedAt: at(-2, 21, 5), mode: "web", autoCorrect: 6, autoTotal: 12, essays: [],
    finalScore: 5, feedback: "Nhớ: số dư luôn bé hơn số chia nhé.", retryPending: true,
  },
]
