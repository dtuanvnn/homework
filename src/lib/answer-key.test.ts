import { describe, expect, it } from "vitest"
import { withLaterAnswerKey } from "./answer-key"
import type { Question } from "./types"

const base = { prompt: "Chọn đáp án đúng", points: 1, skills: [] }
const snapshot: Question = { ...base, id: "q1", type: "trac-nghiem", options: ["3", "4"], correctIndex: 0, answerStatus: "missing" }

describe("withLaterAnswerKey", () => {
  it("takes the key and solution solved after the child submitted", () => {
    const current: Question = { ...base, id: "q1", prompt: "Đề đã sửa", type: "trac-nghiem", options: ["3", "4"], correctIndex: 1, answerStatus: "ai", solution: "Vì 2 + 2 = 4" }
    expect(withLaterAnswerKey(snapshot, current)).toEqual({ ...snapshot, correctIndex: 1, answerStatus: "ai", solution: "Vì 2 + 2 = 4" })
    const picture = { path: "sets/x/y-figure.jpg", width: 10, height: 10 }
    expect(withLaterAnswerKey(snapshot, { ...current, solutionImage: picture })).toMatchObject({ solutionImage: picture })
    expect(withLaterAnswerKey(snapshot, { ...current, correctIndex: 0, correctIndexes: [0, 1] })).toMatchObject({ correctIndex: 0, correctIndexes: [0, 1] })
  })

  it("keeps the snapshot when it had a key, or the set's question can't supply one", () => {
    const keyed = { ...snapshot, answerStatus: undefined }
    const current: Question = { ...snapshot, correctIndex: 1, answerStatus: undefined }
    expect(withLaterAnswerKey(keyed, current)).toBe(keyed)
    expect(withLaterAnswerKey(snapshot, undefined)).toBe(snapshot)
    expect(withLaterAnswerKey(snapshot, { ...current, answerStatus: "missing" })).toBe(snapshot)
    expect(withLaterAnswerKey(snapshot, { ...base, id: "q1", type: "dung-sai", answer: true })).toBe(snapshot)
    // Options changed since: index 1 may point at another option.
    expect(withLaterAnswerKey(snapshot, { ...current, options: ["4", "3", "5"] })).toBe(snapshot)
  })

  it("copies each type's key fields", () => {
    const short: Question = { ...base, id: "s", type: "tra-loi-ngan", answer: "", answerStatus: "missing" }
    expect(withLaterAnswerKey(short, { ...short, answer: "\frac{3}{4}", math: true, answerStatus: "ai-check" })).toMatchObject({ answer: "\frac{3}{4}", math: true, answerStatus: "ai-check" })
    const fill: Question = { ...base, id: "f", type: "dien-cho-trong", prompt: "___ + ___", answers: ["", ""], answerStatus: "missing" }
    expect(withLaterAnswerKey(fill, { ...fill, answers: ["1", "2"], answerStatus: undefined })).toMatchObject({ answers: ["1", "2"] })
    expect(withLaterAnswerKey(fill, { ...fill, answers: ["1"], answerStatus: undefined })).toBe(fill)
    const order: Question = { ...base, id: "o", type: "sap-xep", tokens: ["em", "đi học"], shuffled: [1, 0], answerStatus: "missing" }
    expect(withLaterAnswerKey(order, { ...order, tokens: ["đi học", "em"], answerStatus: "ai" })).toBe(order)
  })
})
