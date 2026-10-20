import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import {
  essayQuestionText,
  isPassing,
  LOW_CONFIDENCE,
  mapEssayGrades,
  mapPaperGrades,
  paperQuestionList,
  paperQuestionText,
  parseImageDataUrl,
  roundToStep,
  type PaperGrades,
} from "./grading"

const essay: Question = { id: "q1", type: "tu-luan", prompt: "Kể về con vật em yêu", points: 2, skills: [], rubric: "Có tên con vật, 2 đặc điểm" }
const mc: Question = { id: "q2", type: "trac-nghiem", prompt: "7 × 8 = ?", points: 1, skills: [], options: ["54", "56", "58"], correctIndex: 1 }
const short: Question = { id: "q3", type: "tra-loi-ngan", prompt: "Bao nhiêu kg?", points: 3, skills: [], answer: "24 kg" }

describe("roundToStep", () => {
  it("rounds to quarter points up to 2 points and half points above", () => {
    expect(roundToStep(1.3, 2)).toBe(1.25)
    expect(roundToStep(1.4, 2)).toBe(1.5)
    expect(roundToStep(2.2, 3)).toBe(2)
    expect(roundToStep(2.3, 3)).toBe(2.5)
  })
  it("rounds a split-bài câu to halves of its exact points", () => {
    expect(roundToStep(0.3, 1 / 3)).toBe(1 / 3)
    expect(roundToStep(0.15, 1 / 3)).toBe(1 / 6)
  })
  it("clamps to 0 … max and survives junk", () => {
    expect(roundToStep(5, 2)).toBe(2)
    expect(roundToStep(-1, 2)).toBe(0)
    expect(roundToStep(Number.NaN, 2)).toBe(0)
  })
})

it("isPassing needs half the points", () => {
  expect(isPassing(1, 2)).toBe(true)
  expect(isPassing(0.75, 2)).toBe(false)
})

describe("prompt builders", () => {
  it("essay text has prompt, rubric, points and typed answer", () => {
    const text = essayQuestionText(essay, 4, "Con mèo nhà em")
    expect(text).toContain("Câu 4 (tự luận, tối đa 2 điểm)")
    expect(text).toContain("Gợi ý chấm: Có tên con vật")
    expect(text).toContain("Con mèo nhà em")
    expect(essayQuestionText({ ...essay, rubric: "" }, 1, "")).toContain("(không có")
  })
  it("paper list numbers questions and shows lettered options and keys", () => {
    expect(paperQuestionText(mc, 2)).toContain("A. 54 | B. 56 | C. 58")
    expect(paperQuestionText(mc, 2)).toContain("Đáp án: B. 56")
    const list = paperQuestionList([{ question: mc }, { question: short }])
    expect(list).toContain("(2 câu)")
    expect(list).toContain("Câu 2 (trả lời ngắn, tối đa 3 điểm)")
    expect(list).toContain("Đáp án: 24 kg")
  })
})

describe("mapEssayGrades", () => {
  it("maps by question number and rounds points", () => {
    const marks = mapEssayGrades(
      [
        { id: "a", number: 3, question: essay },
        { id: "b", number: 5, question: { ...essay, points: 4 } },
      ],
      { grades: [{ questionNumber: 5, points: 1.2, comment: "Con viết  hay." }, { questionNumber: 3, points: 1.9, comment: "Tốt" }] },
    )
    expect(marks.a).toEqual({ isCorrect: true, pointsAwarded: 2, comment: "Tốt" })
    expect(marks.b).toEqual({ isCorrect: false, pointsAwarded: 1, comment: "Con viết hay." })
  })
  it("accepts a single grade with a wrong number for a single question", () => {
    const marks = mapEssayGrades([{ id: "a", number: 3, question: essay }], { grades: [{ questionNumber: 1, points: 1, comment: "" }] })
    expect(marks.a.pointsAwarded).toBe(1)
  })
  it("leaves out questions Claude skipped", () => {
    expect(mapEssayGrades([{ id: "a", number: 1, question: essay }, { id: "b", number: 2, question: essay }], { grades: [{ questionNumber: 2, points: 2, comment: "" }] })).not.toHaveProperty("a")
  })
})

describe("mapPaperGrades", () => {
  const answers = [
    { id: "a1", question: mc },
    { id: "a2", question: short },
    { id: "a3", question: essay },
  ]
  const g = (n: number, extra: Partial<PaperGrades["questions"][number]> = {}) => ({
    questionNumber: n,
    studentAnswer: "B",
    isCorrect: true,
    points: 1,
    comment: null,
    note: null,
    confidence: 0.9,
    ...extra,
  })

  it("maps by question number to answer rows in position order", () => {
    const res = mapPaperGrades(answers, {
      questions: [g(2, { studentAnswer: "24", points: 3 }), g(1), g(3, { studentAnswer: "Con mèo", points: 0.6, comment: "Viết thêm nhé", confidence: 0.5 })],
      overallFeedback: " Con làm tốt! ",
    })
    expect(res.feedback).toBe("Con làm tốt!")
    expect(res.marks.a1).toMatchObject({ isCorrect: true, pointsAwarded: 1, studentAnswer: "B" })
    expect(res.marks.a2).toMatchObject({ isCorrect: true, pointsAwarded: 3, studentAnswer: "24" })
    expect(res.marks.a3).toMatchObject({ isCorrect: false, pointsAwarded: 0.5, comment: "Viết thêm nhé" })
    expect(res.marks.a3.confidence).toBeLessThan(LOW_CONFIDENCE)
  })

  it("marks missing questions wrong with a note and zero confidence; ignores duplicates and unknown numbers", () => {
    const res = mapPaperGrades(answers, { questions: [g(1), g(1, { points: 0, studentAnswer: "A" }), g(9)], overallFeedback: "" })
    expect(res.marks.a1.studentAnswer).toBe("B")
    expect(res.marks.a2).toMatchObject({ isCorrect: false, pointsAwarded: 0, studentAnswer: "", confidence: 0 })
    expect(res.marks.a2.note).toContain("không tìm thấy")
    expect(Object.keys(res.marks)).toEqual(["a1", "a2", "a3"])
  })

  it("an unreadable answer gets 0 points and low confidence even if Claude gave points", () => {
    const res = mapPaperGrades([{ id: "a1", question: mc }], { questions: [g(1, { studentAnswer: "  ", points: 1, confidence: 0.95 })], overallFeedback: "" })
    expect(res.marks.a1).toMatchObject({ isCorrect: false, pointsAwarded: 0 })
    expect(res.marks.a1.confidence).toBeLessThanOrEqual(0.3)
    expect(res.marks.a1.note).toBeTruthy()
  })

  it("clamps points over the max", () => {
    const res = mapPaperGrades([{ id: "a1", question: mc }], { questions: [g(1, { points: 5 })], overallFeedback: "" })
    expect(res.marks.a1.pointsAwarded).toBe(1)
  })
})

it("parseImageDataUrl reads PNG/JPEG/WebP data URLs only", () => {
  expect(parseImageDataUrl("data:image/png;base64,iVBORw0KGgo=")).toEqual({ mediaType: "image/png", data: "iVBORw0KGgo=" })
  expect(parseImageDataUrl("data:image/svg+xml;base64,AAAA")).toBeNull()
  expect(parseImageDataUrl("https://example.com/a.png")).toBeNull()
})
