import { describe, expect, it } from "vitest"
import { blankCount, blankMarks, passagePieces } from "./blanks"
import type { FillBlankQuestion } from "./types"

describe("passagePieces", () => {
  it("cuts a passage at each ___", () => {
    expect(passagePieces("A ___ b ___.")).toEqual([
      { kind: "text", text: "A " },
      { kind: "blank", index: 1 },
      { kind: "text", text: " b " },
      { kind: "blank", index: 2 },
      { kind: "text", text: "." },
    ])
    expect(passagePieces("___")).toEqual([{ kind: "blank", index: 1 }])
  })
})

describe("blankMarks", () => {
  const q: FillBlankQuestion = { id: "q", type: "dien-cho-trong", prompt: "___ helps ___.", answers: ["He", "her"], points: 1, skills: [] }

  it("marks each blank with the grading matcher", () => {
    expect(blankMarks(q, ["he", "him"], { isCorrect: false, pointsAwarded: 0.5 }, true)).toEqual([
      { given: "he", correct: true },
      { given: "him", correct: false, answer: "her" },
    ])
    expect(blankMarks(q, ["he", "him"], { isCorrect: false, pointsAwarded: 0.5 }, false)[1]).toEqual({ given: "him", correct: false })
  })

  it("counts an empty blank as wrong", () => {
    expect(blankMarks(q, ["He"], null, false)).toEqual([
      { given: "He", correct: true },
      { given: "", correct: false },
    ])
  })

  it("is neutral when the parent changed the grade", () => {
    expect(blankMarks(q, ["he", "him"], { isCorrect: true, pointsAwarded: 1 }, true).every((m) => m.correct === null)).toBe(true)
  })

  it("is neutral without an answer key", () => {
    expect(blankMarks({ ...q, answers: ["He", ""], answerStatus: "missing" }, ["he", "x"], null, true).map((m) => m.correct)).toEqual([null, null])
    expect(blankMarks({ ...q, answers: ["He", ""] }, ["he", "x"], null, true).map((m) => m.correct)).toEqual([true, null])
  })
})

describe("blankCount", () => {
  it("counts right blanks only when all are marked", () => {
    expect(blankCount([{ given: "a", correct: true }, { given: "b", correct: false }])).toEqual({ right: 1, total: 2 })
    expect(blankCount([{ given: "a", correct: null }])).toBeNull()
  })
})
