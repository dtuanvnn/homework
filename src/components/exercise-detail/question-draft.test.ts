import { describe, expect, it } from "vitest"
import { changeDraftType, emptyDraft, fromDraft, toDraft } from "./question-draft"

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
