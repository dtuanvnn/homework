import { describe, expect, it } from "vitest"
import { answerKey, REPAIRED_CONFIDENCE, toQuestion, type AiQuestion } from "./question-format"

const blank: AiQuestion = {
  type: "tu-luan",
  prompt: "",
  points: 1,
  skills: [],
  options: null,
  correctIndex: null,
  trueFalseAnswer: null,
  answers: null,
  answer: null,
  pairs: null,
  tokens: null,
  rubric: null,
  confidence: 0.9,
  page: 1,
  note: null,
  math: null,
  simplest: null,
  figure: null,
}
const ai = (patch: Partial<AiQuestion>): AiQuestion => ({ ...blank, ...patch })

describe("toQuestion", () => {
  it("converts a complete multiple-choice question and keeps its confidence", () => {
    const r = toQuestion(ai({ type: "trac-nghiem", prompt: "7 × 8 = ?", options: ["54", "56"], correctIndex: 1, skills: ["Bảng nhân 7"] }), "q1")
    expect(r.question).toEqual({ id: "q1", type: "trac-nghiem", prompt: "7 × 8 = ?", options: ["54", "56"], correctIndex: 1, points: 1, skills: ["Bảng nhân 7"] })
    expect(r.confidence).toBe(0.9)
    expect(r.notes).toEqual([])
  })

  it("flags a multiple-choice question without a valid answer", () => {
    const r = toQuestion(ai({ type: "trac-nghiem", prompt: "?", options: ["a", "b"], correctIndex: 5 }), "q")
    expect(r.confidence).toBe(REPAIRED_CONFIDENCE)
    expect(r.notes).toContain("Chưa xác định được đáp án đúng")
  })

  it("normalizes blanks written as dots or long underscores", () => {
    const r = toQuestion(ai({ type: "dien-cho-trong", prompt: "Mùa thu trời ....... và _____ .", answers: ["xanh", "cao"] }), "q")
    expect(r.question).toMatchObject({ prompt: "Mùa thu trời ___ và ___ .", answers: ["xanh", "cao"] })
    expect(r.notes).toEqual([])
  })

  it("appends blanks when the prompt has none, without lowering confidence", () => {
    const r = toQuestion(ai({ type: "dien-cho-trong", prompt: "6 × 10 =", answers: ["60"] }), "q")
    expect(r.question.prompt).toBe("6 × 10 = ___")
    expect(r.confidence).toBe(0.9)
    expect(r.notes).toEqual([])
  })

  it("pads missing blank answers and flags them", () => {
    const r = toQuestion(ai({ type: "dien-cho-trong", prompt: "___ và ___", answers: ["a"] }), "q")
    expect(r.question).toMatchObject({ answers: ["a", ""] })
    expect(r.notes.join(" ")).toContain("Còn chỗ trống chưa có đáp án")
  })

  it("keeps the correct token order and shuffles the shown order", () => {
    const r = toQuestion(ai({ type: "sap-xep", prompt: "Sắp xếp", tokens: ["Hôm nay", "em", "đi", "học"] }), "q")
    expect(r.question.type === "sap-xep" && r.question.tokens).toEqual(["Hôm nay", "em", "đi", "học"])
    expect(r.question.type === "sap-xep" && [...r.question.shuffled].sort()).toEqual([0, 1, 2, 3])
  })

  it("defaults bad points to 1, clamps confidence and page", () => {
    const r = toQuestion(ai({ type: "tu-luan", prompt: "Viết đoạn văn", points: -2, confidence: 7, page: 0 }), "q")
    expect(r.question.points).toBe(1)
    expect(r.confidence).toBe(1)
    expect(r.page).toBe(1)
  })

  it("puts Claude's own note first", () => {
    const r = toQuestion(ai({ type: "tra-loi-ngan", prompt: "?", answer: null, note: "Đáp án bị che" }), "q")
    expect(r.notes).toEqual(["Đáp án bị che", "Chưa có đáp án"])
  })
})

describe("answerKey", () => {
  it("renders each type readably", () => {
    expect(answerKey({ id: "a", type: "trac-nghiem", prompt: "", points: 1, skills: [], options: ["x", "y"], correctIndex: 1 })).toBe("y")
    expect(answerKey({ id: "a", type: "dung-sai", prompt: "", points: 1, skills: [], answer: false })).toBe("Sai")
    expect(answerKey({ id: "a", type: "noi", prompt: "", points: 1, skills: [], pairs: [{ left: "father", right: "bố" }] })).toBe("father – bố")
  })
})

describe("math and figures", () => {
  it("keeps math answers as LaTeX without dollars and sets simplest only with math", () => {
    const r = toQuestion(ai({ type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", answer: "$\\frac{3}{4}$", math: true, simplest: true }), "id-1")
    expect(r.question).toMatchObject({ answer: "\\frac{3}{4}", math: true, simplest: true })
    const plain = toQuestion(ai({ type: "tra-loi-ngan", prompt: "Tính", answer: "24 kg", math: null, simplest: true }), "id-2")
    expect(plain.question).not.toHaveProperty("math")
    expect(plain.question).not.toHaveProperty("simplest")
  })

  it("turns math off with a note when an answer can't be evaluated", () => {
    const r = toQuestion(ai({ type: "tra-loi-ngan", prompt: "Tính", answer: "24 kg", math: true }), "id-1")
    expect(r.question).not.toHaveProperty("math")
    expect(r.notes).toContain("Đáp án dạng toán chưa đọc được – kiểm tra lại")
    expect(r.confidence).toBeLessThanOrEqual(REPAIRED_CONFIDENCE)
  })

  it("returns a repaired figure box on the question's page", () => {
    const r = toQuestion(ai({ type: "trac-nghiem", prompt: "Hình nào là hình vuông?", options: ["A", "B"], correctIndex: 0, page: 2, figure: { box: [500, 600, 100, 200] } }), "id-1")
    expect(r.figure).toEqual({ page: 2, box: [100, 200, 500, 600] })
  })

  it("drops a broken figure box with a note", () => {
    const r = toQuestion(ai({ type: "trac-nghiem", prompt: "Hình nào?", options: ["A", "B"], correctIndex: 0, figure: { box: [0, 0, 1000, 1000] } }), "id-1")
    expect(r.figure).toBeUndefined()
    expect(r.notes).toContain("Chưa xác định được vị trí hình – hãy thêm hình bằng tay")
  })
})
