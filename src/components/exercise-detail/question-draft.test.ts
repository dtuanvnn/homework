import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import { changeDraftType, emptyDraft, fromDraft, toDraft, validateDraft } from "./question-draft"

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
    const q = fromDraft({ ...d, options: ["A", "B"], correctIndex: 0 }, "q")
    expect(q).not.toHaveProperty("math")
    expect(q.image).toEqual(FIG)
  })

  it("omits simplest unless math is on", () => {
    const d = { ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Tính", points: 1, skills: [], answer: "5" }), simplest: true }
    expect(fromDraft(d, "q")).not.toHaveProperty("simplest")
  })
})
