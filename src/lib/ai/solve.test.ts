import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import { applySolution, mergeSolution, solveRequestText, type SolveResponse } from "./solve"

const base = { prompt: "Chọn đáp án đúng", points: 1, skills: [] }
const empty: SolveResponse = {
  correctIndexes: null, trueFalseAnswer: null, answers: null, answer: null, pairs: null, tokens: null, rubric: null, solution: "", confidence: 0.9,
}
const res = (patch: Partial<SolveResponse>): SolveResponse => ({ ...empty, ...patch })

describe("applySolution", () => {
  it("fills the key and solution and marks it solved by AI", () => {
    const q: Question = { ...base, id: "q", type: "trac-nghiem", options: ["3", "4"], correctIndex: 0, answerStatus: "missing" }
    expect(applySolution(q, res({ correctIndexes: [1], solution: " 2 + 2 = 4 " }))).toEqual({ ...q, correctIndex: 1, answerStatus: "ai", solution: "2 + 2 = 4" })
  })

  it("flags answers the AI wasn't sure about", () => {
    const q: Question = { ...base, id: "q", type: "dung-sai", answer: true, answerStatus: "missing" }
    expect(applySolution(q, res({ trueFalseAnswer: false, confidence: 0.5 }))).toMatchObject({ answer: false, answerStatus: "ai-check" })
  })

  it("returns null when the answer doesn't fit the question", () => {
    const mc: Question = { ...base, id: "q", type: "trac-nghiem", options: ["3", "4"], correctIndex: 0, answerStatus: "missing" }
    expect(applySolution(mc, res({ correctIndexes: [4] }))).toBeNull()
    expect(applySolution(mc, res({ correctIndexes: [1, 0] }))).toMatchObject({ correctIndex: 0, correctIndexes: [0, 1] })
    const fill: Question = { ...base, id: "f", type: "dien-cho-trong", prompt: "___ + ___", answers: ["", ""], answerStatus: "missing" }
    expect(applySolution(fill, res({ answers: ["1"] }))).toBeNull()
    const short: Question = { ...base, id: "s", type: "tra-loi-ngan", answer: "", answerStatus: "missing" }
    expect(applySolution(short, res({ answer: " " }))).toBeNull()
  })

  it("keeps math answers as LaTeX without dollars, and checks them", () => {
    const short: Question = { ...base, id: "s", type: "tra-loi-ngan", answer: "", math: true, answerStatus: "missing" }
    expect(applySolution(short, res({ answer: "$\\frac{3}{4}$" }))).toMatchObject({ answer: "\\frac{3}{4}", answerStatus: "ai" })
    expect(applySolution(short, res({ answer: "ba phần tư" }))).toMatchObject({ answer: "ba phần tư", answerStatus: "ai-check" })
  })

  it("matches pairs only when they reuse the printed items", () => {
    const q: Question = { ...base, id: "n", type: "noi", pairs: [{ left: "cat", right: "chó" }, { left: "dog", right: "mèo" }], answerStatus: "missing" }
    expect(applySolution(q, res({ pairs: [{ left: "dog", right: "chó" }, { left: "cat", right: "mèo" }] }))).toMatchObject({
      pairs: [{ left: "cat", right: "mèo" }, { left: "dog", right: "chó" }],
    })
    expect(applySolution(q, res({ pairs: [{ left: "cat", right: "con mèo" }, { left: "dog", right: "chó" }] }))).toBeNull()
  })

  it("puts ordering tokens in order while the child still sees them as printed", () => {
    const q: Question = { ...base, id: "o", type: "sap-xep", tokens: ["học", "em", "đi"], shuffled: [0, 1, 2], answerStatus: "missing" }
    const solved = applySolution(q, res({ tokens: ["em", "đi", "học"] }))
    expect(solved).toMatchObject({ tokens: ["em", "đi", "học"], shuffled: [2, 0, 1] })
    expect(solved?.type === "sap-xep" && solved.shuffled.map((i) => solved.tokens[i])).toEqual(["học", "em", "đi"])
    expect(applySolution(q, res({ tokens: ["em", "đi", "học", "nhé"] }))).toBeNull()
  })

  it("writes an essay's grading guide", () => {
    const q: Question = { ...base, id: "e", type: "tu-luan", rubric: "", answerStatus: "missing" }
    expect(applySolution(q, res({ rubric: "Đáp số: 24 kg", solution: "96 : 4 = 24" }))).toMatchObject({ rubric: "Đáp số: 24 kg", solution: "96 : 4 = 24", answerStatus: "ai" })
  })
})

describe("mergeSolution", () => {
  it("adds only the answer to the câu as it is now (edits made while solving survive)", () => {
    const group = { id: "g", label: "Part 1", prompt: "Replace the bold words." }
    const before: Question = { ...base, id: "q", type: "tra-loi-ngan", prompt: "Replace the bold words.\nPandas are **kind**.", answer: "", answerStatus: "missing" }
    const solved: Question = { ...before, answer: "gentle", answerStatus: "ai", solution: "kind = gentle" }
    const now: Question = { ...before, prompt: "Pandas are **kind**.", group, points: 1 / 3 }
    expect(mergeSolution(now, solved)).toEqual({ ...now, answer: "gentle", answerStatus: "ai", solution: "kind = gentle" })
  })

  it("drops the answer when the parent changed the câu's type meanwhile", () => {
    const now: Question = { ...base, id: "q", type: "tu-luan", rubric: "" }
    const solved: Question = { ...base, id: "q", type: "tra-loi-ngan", answer: "24", answerStatus: "ai" }
    expect(mergeSolution(now, solved)).toBe(now)
  })
})

describe("solveRequestText", () => {
  it("puts the bài's shared prompt before the câu", () => {
    const group = { id: "g", label: "Part 3", prompt: "Complete the sentences with the correct pronoun." }
    const text = solveRequestText({ ...base, id: "q", type: "tu-luan", rubric: "", prompt: "David ___", group }, { subject: "tieng-anh", grade: 3 })
    expect(text).toContain("Question: Part 3\nComplete the sentences with the correct pronoun.\nDavid ___")
  })

  it("shows the question as the child sees it, with what to fill in", () => {
    const text = solveRequestText({ ...base, id: "q", type: "trac-nghiem", options: ["3", "4"], correctIndex: 0 }, { subject: "toan", grade: 3 })
    expect(text).toContain("Grade 3")
    expect(text).toContain("A. 3")
    expect(text).toContain("B. 4")
    expect(text).toContain("correctIndexes")
    const order = solveRequestText({ ...base, id: "o", type: "sap-xep", tokens: ["em", "học"], shuffled: [1, 0] }, { subject: "tieng-viet", grade: 3 })
    expect(order).toContain("học / em")
  })
})
