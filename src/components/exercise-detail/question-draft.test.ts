import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import { changeDraftType, emptyDraft, fromDraft, parsePoints, patchDraft, toDraft, validateDraft } from "./question-draft"

describe("fromDraft", () => {
  it("keeps the câu's bài when it is edited", () => {
    const q: Question = { id: "q1", type: "tu-luan", prompt: "Anna ___", points: 1, skills: [], rubric: "", group: { id: "g", label: "Part 4", prompt: "Read and write." } }
    expect(fromDraft(toDraft(q), q.id, q).group).toEqual(q.group)
  })
})

describe("changeDraftType", () => {
  const wordProblem = { ...emptyDraft("tra-loi-ngan"), prompt: "Một cửa hàng bán 285 kg gạo…\nHỏi cả hai buổi bán được bao nhiêu ki-lô-gam?", points: 2, shortAnswer: "605 kg" }

  it("turns a short answer into an essay with the answer as grading hint, keeping the prompt", () => {
    const essay = fromDraft(changeDraftType(wordProblem, "tu-luan"), "q1")
    expect(essay).toMatchObject({ type: "tu-luan", rubric: "Đáp số: 605 kg", points: 2, prompt: wordProblem.prompt })
  })

  it("keeps an existing rubric", () => {
    const d = changeDraftType({ ...wordProblem, rubric: "Có lời giải và phép tính" }, "tu-luan")
    expect(d.rubric).toBe("Có lời giải và phép tính")
  })

  it("restores the short answer from the hint when switching back", () => {
    const essay = toDraft({ id: "q1", type: "tu-luan", prompt: "Tính", points: 1, skills: [], rubric: "Đáp số: 42" })
    expect(changeDraftType(essay, "tra-loi-ngan").shortAnswer).toBe("42")
  })

  it("is a no-op for the same type", () => {
    expect(changeDraftType(wordProblem, "tra-loi-ngan")).toBe(wordProblem)
  })
})

const FIG = { path: "sets/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg", width: 300, height: 200 }

describe("question drafts with math and figures", () => {
  it("round-trips math flags and the figure", () => {
    const q: Question = { id: "q1", type: "tra-loi-ngan", prompt: "$\\frac12+\\frac14$", points: 1, skills: [], answer: "\\frac{3}{4}", math: true, simplest: true, image: FIG, imageUrl: "blob:x" }
    expect(fromDraft(toDraft(q), "q1")).toEqual(q)
  })

  it("rejects math keys that can't be evaluated", () => {
    const d = { ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Tính", points: 1, skills: [], answer: "3 phần 4" }), math: true }
    expect(validateDraft(d)).toContain("Đáp án dạng toán chưa đúng (VD: 3/4, 2\\frac{1}{3}, 0,75)")
  })

  it("drops math flags for types without math answers and keeps the figure", () => {
    const d = changeDraftType({ ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Hình?", points: 1, skills: [], answer: "\\frac{1}{2}", math: true, image: FIG }) }, "trac-nghiem")
    const q = fromDraft({ ...d, options: ["A", "B"], correctIndexes: [0] }, "q")
    expect(q).not.toHaveProperty("math")
    expect(q.image).toEqual(FIG)
  })

  it("omits simplest unless math is on", () => {
    const d = { ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Tính", points: 1, skills: [], answer: "5" }), simplest: true }
    expect(fromDraft(d, "q")).not.toHaveProperty("simplest")
  })
})

describe("answer status and solution", () => {
  const keyless: Question = { id: "q", type: "trac-nghiem", prompt: "7 × 8 = ?", points: 1, skills: [], options: ["54", "56"], correctIndex: 0, answerStatus: "missing" }

  it("opens a question without a key with no option chosen, and saves it still without a key", () => {
    const d = toDraft(keyless)
    expect(d.correctIndexes).toEqual([])
    expect(validateDraft(d)).toEqual([])
    expect(fromDraft(d, "q")).toMatchObject({ correctIndex: 0, answerStatus: "missing" })
    const short = toDraft({ id: "s", type: "tra-loi-ngan", prompt: "6 × 7 = ?", points: 1, skills: [], answer: "", answerStatus: "missing" })
    expect(validateDraft(short)).toEqual([])
    expect(fromDraft(short, "s")).toMatchObject({ answer: "", answerStatus: "missing" })
    const fill = toDraft({ id: "f", type: "dien-cho-trong", prompt: "___ + ___ = 5", points: 1, skills: [], answers: ["", ""], answerStatus: "missing" })
    expect(fromDraft(fill, "f")).toMatchObject({ answers: ["", ""], answerStatus: "missing" })
  })

  it("becomes the parent's own key once they set an answer", () => {
    const d = patchDraft(toDraft(keyless), { correctIndexes: [1] })
    expect(d.answerStatus).toBeUndefined()
    expect(fromDraft(d, "q")).toMatchObject({ correctIndex: 1 })
    expect(fromDraft(d, "q")).not.toHaveProperty("answerStatus")
    const ai = toDraft({ ...keyless, correctIndex: 1, answerStatus: "ai-check" })
    expect(patchDraft(ai, { prompt: "7 × 8 bằng mấy?" }).answerStatus).toBe("ai-check")
    expect(patchDraft(ai, { correctIndexes: [0] }).answerStatus).toBeUndefined()
    // Removing an option resends the unchanged correctIndexes: still no key.
    expect(patchDraft(toDraft(keyless), { options: ["54"], correctIndexes: [] }).answerStatus).toBe("missing")
  })

  it("keeps the solution, dropping an empty one", () => {
    const d = toDraft({ ...keyless, answerStatus: undefined, correctIndex: 1, solution: "7 × 8 = 56" })
    expect(d.solution).toBe("7 × 8 = 56")
    expect(fromDraft(d, "q")).toMatchObject({ solution: "7 × 8 = 56" })
    expect(fromDraft({ ...d, solution: "  " }, "q")).not.toHaveProperty("solution")
  })
})

describe("multiple correct options", () => {
  const mc: Question = { id: "q", type: "trac-nghiem", prompt: "Số nào chia hết cho 2?", points: 1, skills: [], options: ["3", "4", "", "8"], correctIndex: 1, correctIndexes: [1, 3] }

  it("round-trips several correct options, keeping them on the same text when empty options are dropped", () => {
    const d = toDraft(mc)
    expect(d.correctIndexes).toEqual([1, 3])
    expect(fromDraft(d, "q")).toMatchObject({ options: ["3", "4", "8"], correctIndex: 1, correctIndexes: [1, 2] })
  })

  it("saves a single correct option without correctIndexes", () => {
    const q = fromDraft({ ...toDraft(mc), correctIndexes: [3] }, "q")
    expect(q).toMatchObject({ correctIndex: 2 })
    expect(q).not.toHaveProperty("correctIndexes")
  })

  it("needs at least one correct option, each with text", () => {
    expect(validateDraft({ ...toDraft(mc), correctIndexes: [] })).toContain("Chọn đáp án đúng có nội dung")
    expect(validateDraft({ ...toDraft(mc), correctIndexes: [1, 2] })).toContain("Chọn đáp án đúng có nội dung")
    expect(validateDraft(toDraft(mc))).toEqual([])
  })
})

describe("parsePoints", () => {
  it("reads exam points above the presets, with a comma or a dot, in quarter points", () => {
    expect(parsePoints("4")).toBe(4)
    expect(parsePoints("2,5")).toBe(2.5)
    expect(parsePoints(" 0.25 ")).toBe(0.25)
    expect(parsePoints("1,3")).toBe(1.25)
  })
  it("rejects empty, zero and out-of-range values", () => {
    for (const bad of ["", "0", "-1", "101", "abc"]) expect(parsePoints(bad)).toBeNull()
  })
})
