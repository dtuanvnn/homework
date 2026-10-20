import { describe, expect, it } from "vitest"
import { gradeAttempt, gradeQuestion, scoreOutOf10, starsFor } from "./grading"
import { newInk } from "./ink"
import type { Question } from "./types"

const base = { prompt: "", points: 1, skills: [] }

const mc: Question = { ...base, id: "mc", type: "trac-nghiem", options: ["54", "56", "63"], correctIndex: 1 }
const tf: Question = { ...base, id: "tf", type: "dung-sai", answer: false }
const blanks: Question = { ...base, id: "fb", type: "dien-cho-trong", points: 2, prompt: "___ và ___", answers: ["Cao vời vợi", "468"] }
const shortNum: Question = { ...base, id: "sn", type: "tra-loi-ngan", answer: "24 kg" }
const shortText: Question = { ...base, id: "st", type: "tra-loi-ngan", answer: "Hà Nội" }
const match: Question = {
  ...base,
  id: "m",
  type: "noi",
  points: 1.5,
  pairs: [
    { left: "father", right: "bố" },
    { left: "mother", right: "mẹ" },
    { left: "sister", right: "chị" },
  ],
}
const order: Question = { ...base, id: "o", type: "sap-xep", tokens: ["Hôm nay", "em", "đến", "trường"], shuffled: [2, 0, 3, 1] }
const essay: Question = { ...base, id: "e", type: "tu-luan", points: 2, rubric: "" }

describe("gradeQuestion", () => {
  it("marks unanswered objective questions wrong with 0 points", () => {
    expect(gradeQuestion(mc, undefined)).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion(shortNum, "   ")).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it("grades multiple choice by option index", () => {
    expect(gradeQuestion(mc, 1)).toEqual({ isCorrect: true, pointsAwarded: 1 })
    expect(gradeQuestion(mc, 0)).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it("grades a question with several correct options all or nothing, in any order", () => {
    const multi: Question = { ...mc, points: 2, correctIndex: 0, correctIndexes: [0, 2] }
    expect(gradeQuestion(multi, [0, 2])).toEqual({ isCorrect: true, pointsAwarded: 2 })
    expect(gradeQuestion(multi, [2, 0])).toEqual({ isCorrect: true, pointsAwarded: 2 })
    expect(gradeQuestion(multi, [0])).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion(multi, [0, 1, 2])).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion(multi, 0)).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion(multi, [])).toEqual({ isCorrect: false, pointsAwarded: 0 })
    // A single-answer question still accepts the index, or a one-item list.
    expect(gradeQuestion(mc, [1])).toEqual({ isCorrect: true, pointsAwarded: 1 })
  })

  it("grades true/false", () => {
    expect(gradeQuestion(tf, false)).toEqual({ isCorrect: true, pointsAwarded: 1 })
    expect(gradeQuestion(tf, true)).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  describe("fill in the blanks", () => {
    it("ignores case, extra spaces and trailing punctuation", () => {
      expect(gradeQuestion(blanks, ["  cao   vời vợi. ", "468"])).toEqual({ isCorrect: true, pointsAwarded: 2 })
    })

    it("keeps Vietnamese tone marks significant", () => {
      expect(gradeQuestion(blanks, ["cao vơi vợi", "468"]).isCorrect).toBe(false)
    })

    it("treats NFD and NFC input as the same text", () => {
      expect(gradeQuestion(blanks, ["Cao vời vợi".normalize("NFD"), "468"]).isCorrect).toBe(true)
    })

    it("gives partial credit per blank", () => {
      expect(gradeQuestion(blanks, ["cao vời vợi", "486"])).toEqual({ isCorrect: false, pointsAwarded: 1 })
    })

    it("keeps exact points for a câu worth a third of a bài", () => {
      expect(gradeQuestion({ ...blanks, points: 1 / 3 }, ["cao vời vợi", "486"]).pointsAwarded).toBe(1 / 6)
    })
  })

  describe("short answer", () => {
    it("accepts the number alone when the expected answer has a unit", () => {
      expect(gradeQuestion(shortNum, "24").isCorrect).toBe(true)
      expect(gradeQuestion(shortNum, "24kg").isCorrect).toBe(true)
      expect(gradeQuestion(shortNum, "24 KG").isCorrect).toBe(true)
    })

    it("rejects a wrong number or a wrong unit", () => {
      expect(gradeQuestion(shortNum, "25 kg").isCorrect).toBe(false)
      expect(gradeQuestion(shortNum, "24 g").isCorrect).toBe(false)
    })

    it("accepts extra words that appear in the expected answer", () => {
      const q: Question = { ...shortNum, answer: "540 cái bút" }
      expect(gradeQuestion(q, "540 cái bút").isCorrect).toBe(true)
      expect(gradeQuestion(q, "540").isCorrect).toBe(true)
    })

    it("compares text answers case-insensitively", () => {
      expect(gradeQuestion(shortText, "hà nội").isCorrect).toBe(true)
      expect(gradeQuestion(shortText, "Hà Nam").isCorrect).toBe(false)
    })
  })

  describe("matching", () => {
    it("is correct when every left item maps to its own pair (JSON string keys)", () => {
      expect(gradeQuestion(match, { "0": 0, "1": 1, "2": 2 })).toEqual({ isCorrect: true, pointsAwarded: 1.5 })
    })

    it("gives partial credit per correct pair", () => {
      expect(gradeQuestion(match, { "0": 0, "1": 2, "2": 1 })).toEqual({ isCorrect: false, pointsAwarded: 0.5 })
    })
  })

  describe("ordering", () => {
    it("is correct when tokens are in the original order", () => {
      expect(gradeQuestion(order, [0, 1, 2, 3])).toEqual({ isCorrect: true, pointsAwarded: 1 })
      expect(gradeQuestion(order, [1, 0, 2, 3])).toEqual({ isCorrect: false, pointsAwarded: 0 })
    })

    it("compares token text, so swapping identical tokens still counts", () => {
      const q: Question = { ...order, tokens: ["a", "b", "a"], shuffled: [1, 0, 2] }
      expect(gradeQuestion(q, [2, 1, 0]).isCorrect).toBe(true)
    })

    it("is wrong when not all tokens were placed", () => {
      expect(gradeQuestion(order, [0, 1, 2]).isCorrect).toBe(false)
    })
  })

  it("leaves essays for the parent", () => {
    expect(gradeQuestion(essay, { text: "Bạn em tên là Lan." })).toEqual({ isCorrect: null, pointsAwarded: null })
  })

  it("leaves answers to questions without an answer key for the parent, but blanks are still wrong", () => {
    const missing = { ...mc, answerStatus: "missing" } as Question
    expect(gradeQuestion(missing, 0)).toEqual({ isCorrect: null, pointsAwarded: null })
    expect(gradeQuestion(missing, undefined)).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion({ ...shortNum, answer: "", answerStatus: "missing" } as Question, " ")).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion({ ...mc, answerStatus: "ai" } as Question, 1)).toEqual({ isCorrect: true, pointsAwarded: 1 })
  })
})

describe("math questions", () => {
  const sa = (patch: Partial<Extract<Question, { type: "tra-loi-ngan" }>> = {}): Question => ({
    id: "m1", type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", points: 1, skills: [], answer: "\\frac{3}{4}", math: true, ...patch,
  })

  it("accepts any answer with the same value", () => {
    expect(gradeQuestion(sa(), "\\frac{6}{8}").isCorrect).toBe(true)
    expect(gradeQuestion(sa(), "0,75").isCorrect).toBe(true)
    expect(gradeQuestion(sa(), "3/4").isCorrect).toBe(true)
    expect(gradeQuestion(sa(), "\\frac{2}{3}").isCorrect).toBe(false)
  })

  it("requires lowest terms when simplest is set", () => {
    expect(gradeQuestion(sa({ simplest: true }), "\\frac{6}{8}").isCorrect).toBe(false)
    expect(gradeQuestion(sa({ simplest: true }), "\\frac{3}{4}").isCorrect).toBe(true)
  })

  it("falls back to text comparison when the key can't be evaluated", () => {
    expect(gradeQuestion(sa({ answer: "ba phần tư" }), "Ba phần tư").isCorrect).toBe(true)
  })

  it("grades math blanks by value", () => {
    const q: Question = { id: "m2", type: "dien-cho-trong", prompt: "$\\frac{1}{2}$ = ___ ; 1 = ___", points: 2, skills: [], answers: ["\\frac{2}{4}", "\\frac{4}{4}"], math: true }
    expect(gradeQuestion(q, ["\\frac{1}{2}", "1"])).toEqual({ isCorrect: true, pointsAwarded: 2 })
    expect(gradeQuestion(q, ["\\frac{1}{3}", "1"])).toEqual({ isCorrect: false, pointsAwarded: 1 })
  })

  it("leaves non-math questions unchanged", () => {
    expect(gradeQuestion(sa({ math: undefined, answer: "3/4" }), "6/8").isCorrect).toBe(false)
  })
})

describe("scoreOutOf10", () => {
  it("gives exactly 10 when every câu of a split bài is right", () => {
    expect(scoreOutOf10(1 / 3 + 1 / 3 + 1 / 3 + 9, 10)).toBe(10)
    expect(scoreOutOf10(0.1 + 0.2, 0.3)).toBe(10)
  })

  it("rounds to the nearest quarter point", () => {
    expect(scoreOutOf10(7, 9)).toBe(7.75)
    expect(scoreOutOf10(10, 10)).toBe(10)
    expect(scoreOutOf10(0, 10)).toBe(0)
  })

  it("returns 0 for an empty set", () => {
    expect(scoreOutOf10(0, 0)).toBe(0)
  })
})

describe("starsFor", () => {
  it.each([
    [10, 3],
    [9, 3],
    [8.75, 2],
    [7, 2],
    [5, 1],
    [4.75, 0],
  ])("score %s → %s stars", (score, stars) => {
    expect(starsFor(score)).toBe(stars)
  })
})

describe("gradeAttempt", () => {
  it("scores a fully objective attempt", () => {
    const result = gradeAttempt([mc, tf], { mc: 1, tf: true })
    expect(result.needsReview).toBe(false)
    expect(result.autoPoints).toBe(1)
    expect(result.totalPoints).toBe(2)
    expect(result.score).toBe(5)
    expect(result.grades.map((g) => g.questionId)).toEqual(["mc", "tf"])
  })

  it("waits for the parent when an essay is present", () => {
    const result = gradeAttempt([mc, essay], { mc: 1, e: { text: "..." } })
    expect(result.needsReview).toBe(true)
    expect(result.score).toBeNull()
    expect(result.autoPoints).toBe(1)
    expect(result.totalPoints).toBe(3)
  })
})

describe("tu-vung (handwritten word)", () => {
  const vocab: Question = { id: "v", type: "tu-vung", word: "nest", prompt: "A bird's home made of twigs.", points: 1, skills: [] }
  const strip = newInk("o-li", "strip")

  it("is wrong when nothing was written", () => {
    expect(gradeQuestion(vocab, undefined)).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion(vocab, { text: "", ink: strip })).toEqual({ isCorrect: false, pointsAwarded: 0 })
    expect(gradeQuestion(vocab, { text: "" })).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it("waits for the parent when there is handwriting", () => {
    const ink = { ...strip, pages: [{ strokes: [[100, 100, 5, 120, 110, 5]] }] }
    expect(gradeQuestion(vocab, { text: "", ink })).toEqual({ isCorrect: null, pointsAwarded: null })
  })
})
