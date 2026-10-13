import { describe, expect, it } from "vitest"
import type { Question } from "../types"
import {
  buildGradingQueue,
  correctAnswerText,
  essayDrawing,
  markedTotals,
  pointStep,
  responseText,
  stepPoints,
  type AnswerStat,
  type QueueAssignment,
  type QueueAttempt,
} from "./grading"

const set = { id: "s1", title: "Phép chia có dư", subject: "toan" as const }
const attempt = (over: Partial<QueueAttempt> & { id: string }): QueueAttempt => ({
  attemptNo: 1,
  mode: "web",
  submittedAt: new Date("2026-10-08T19:00:00+07:00"),
  gradedAt: null,
  score: null,
  feedback: null,
  retryAllowed: true,
  ...over,
})
const stats = (attemptId: string, list: [AnswerStat["type"], boolean | null][]): AnswerStat[] =>
  list.map(([type, isCorrect]) => ({ attemptId, type, isCorrect }))

describe("buildGradingQueue", () => {
  const assignments: QueueAssignment[] = [
    { id: "a1", maxAttempts: 2, set, attempts: [attempt({ id: "t1" })] },
    {
      id: "a2",
      maxAttempts: 2,
      set,
      attempts: [
        attempt({ id: "t2", submittedAt: new Date("2026-10-07T19:00:00+07:00"), gradedAt: new Date("2026-10-07T21:00:00+07:00"), score: 8.5 }),
      ],
    },
    { id: "a3", maxAttempts: 2, set, attempts: [attempt({ id: "t3", submittedAt: null })] },
    {
      id: "a4",
      maxAttempts: 2,
      set,
      attempts: [
        attempt({ id: "t4", submittedAt: new Date("2026-10-01T19:00:00+07:00"), gradedAt: new Date("2026-10-01T20:00:00+07:00"), score: 5 }),
        attempt({ id: "t5", attemptNo: 2, submittedAt: new Date("2026-10-02T19:00:00+07:00"), gradedAt: new Date("2026-10-02T20:00:00+07:00"), score: 9 }),
      ],
    },
  ]
  const answers = [
    ...stats("t1", [["trac-nghiem", true], ["dung-sai", false], ["noi", true], ["tu-luan", null]]),
    ...stats("t2", [["trac-nghiem", true], ["tu-luan", true]]),
  ]
  const queue = buildGradingQueue(assignments, answers, new Map([["t1", "https://x/scan.jpg"]]))

  it("lists submitted attempts only, newest first", () => {
    expect(queue.map((q) => q.attemptId)).toEqual(["t1", "t2", "t5", "t4"])
  })

  it("summarises auto grading of awaiting attempts", () => {
    expect(queue[0]).toMatchObject({ awaiting: true, totalQuestions: 4, autoCorrect: 2, autoWrong: 1, ungraded: 1, score: null, scanUrl: "https://x/scan.jpg" })
  })

  it("does not count parent-graded essays as auto-correct", () => {
    expect(queue[1]).toMatchObject({ awaiting: false, autoCorrect: 1, ungraded: 0, score: 8.5, retryPending: true })
  })

  it("marks retry pending only on the latest attempt with a try left", () => {
    expect(queue.find((q) => q.attemptId === "t4")?.retryPending).toBe(false)
    expect(queue.find((q) => q.attemptId === "t5")?.retryPending).toBe(false)
  })

  it("respects retryAllowed and maxAttempts", () => {
    const [noRetry] = buildGradingQueue([{ ...assignments[1], attempts: [{ ...assignments[1].attempts[0], retryAllowed: false }] }], [])
    const [single] = buildGradingQueue([{ ...assignments[1], maxAttempts: 1 }], [])
    expect(noRetry.retryPending).toBe(false)
    expect(single.retryPending).toBe(false)
  })
})

describe("points", () => {
  it("uses quarter steps for small questions and half steps otherwise", () => {
    expect(pointStep(1)).toBe(0.25)
    expect(pointStep(4)).toBe(0.5)
  })

  it("steps within 0 … max and snaps odd values to the grid", () => {
    expect(stepPoints(null, 1, 1)).toBe(0.25)
    expect(stepPoints(1, 1, 1)).toBe(1)
    expect(stepPoints(0, 1, -1)).toBe(0)
    expect(stepPoints(1.33, 2, 1)).toBe(1.5)
    expect(stepPoints(1.33, 2, -1)).toBe(1.25)
    expect(stepPoints(2, 3, 1)).toBe(2.5)
  })

  it("totals marks and counts what is left", () => {
    const qs = [{ question: { points: 1 } as Question }, { question: { points: 2 } as Question }]
    expect(markedTotals(qs, [{ isCorrect: true, pointsAwarded: 1 }, { isCorrect: null, pointsAwarded: null }])).toEqual({ total: 3, awarded: 1, remaining: 1 })
  })
})

describe("readable answers", () => {
  const base = { id: "q", prompt: "?", points: 1, skills: [] }
  const mc: Question = { ...base, type: "trac-nghiem", options: ["3", "4", "5"], correctIndex: 1 }
  const fill: Question = { ...base, type: "dien-cho-trong", answers: ["a", "b"] }
  const match: Question = { ...base, type: "noi", pairs: [{ left: "1", right: "một" }, { left: "2", right: "hai" }] }
  const order: Question = { ...base, type: "sap-xep", tokens: ["Em", "đi", "học"], shuffled: [2, 0, 1] }
  const essay: Question = { ...base, type: "tu-luan", rubric: "" }

  it("formats the correct answer per type", () => {
    expect(correctAnswerText(mc)).toBe("B. 4")
    expect(correctAnswerText({ ...base, type: "dung-sai", answer: false })).toBe("Sai")
    expect(correctAnswerText(fill)).toBe("a · b")
    expect(correctAnswerText(match)).toBe("1 → một · 2 → hai")
    expect(correctAnswerText(order)).toBe("Em đi học")
    expect(correctAnswerText(essay)).toBe("Phụ huynh tự đánh giá")
  })

  it("formats the child's answer per type", () => {
    expect(responseText(mc, 2)).toBe("C. 5")
    expect(responseText(fill, ["a"])).toBe("a · (trống)")
    expect(responseText(match, { "0": 1, "1": 0 })).toBe("1 → hai · 2 → một")
    expect(responseText(order, [1, 0, 2])).toBe("đi Em học")
    expect(responseText({ ...base, type: "tra-loi-ngan", answer: "24" }, " 24 kg ")).toBe("24 kg")
    expect(responseText(essay, { text: "Vì cậu bé thông minh." })).toBe("Vì cậu bé thông minh.")
    expect(responseText(essay, { text: "", drawing: "data:image/png;base64,AAA" })).toBe("")
    expect(responseText(mc, null)).toBe("(Chưa trả lời)")
  })

  it("wraps math answers as formulas, one blank at a time", () => {
    const mathShort: Question = { ...base, type: "tra-loi-ngan", answer: "\\frac{3}{4}", math: true }
    const mathFill: Question = { ...base, type: "dien-cho-trong", answers: ["\\frac{1}{2}", "2"], math: true }
    expect(correctAnswerText(mathShort)).toBe("$\\frac{3}{4}$")
    expect(responseText(mathShort, " 3/4 ")).toBe("$3/4$")
    expect(responseText(mathShort, "  ")).toBe("(Chưa trả lời)")
    expect(correctAnswerText(mathFill)).toBe("$\\frac{1}{2}$ · $2$")
    expect(responseText(mathFill, ["\\frac{1}{2}"])).toBe("$\\frac{1}{2}$ · (trống)")
  })

  it("only exposes inline image drawings", () => {
    expect(essayDrawing({ text: "", drawing: "data:image/png;base64,AAA" })).toBe("data:image/png;base64,AAA")
    expect(essayDrawing({ text: "", drawing: "javascript:alert(1)" })).toBeUndefined()
    expect(essayDrawing(3)).toBeUndefined()
  })
})
