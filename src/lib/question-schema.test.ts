import { describe, expect, it } from "vitest"
import { editedQuestionSchema, questionContentSchema } from "./question-schema"

const FIG = "sets/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg"

describe("question schema", () => {
  it("accepts several distinct, in-range correct options", () => {
    const mc = (correctIndexes: number[]) =>
      questionContentSchema.safeParse({ type: "trac-nghiem", prompt: "?", points: 1, skills: [], options: ["a", "b", "c"], correctIndex: 0, correctIndexes }).success
    expect(mc([0, 2])).toBe(true)
    expect(mc([0, 3])).toBe(false)
    expect(mc([1, 1])).toBe(false)
    expect(mc([1])).toBe(false)
  })

  it("keeps a figure and math flags", () => {
    const parsed = questionContentSchema.parse({
      type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", points: 1, skills: [],
      answer: "\\frac{3}{4}", math: true, simplest: true, image: { path: FIG, width: 400, height: 300 },
    })
    expect(parsed).toMatchObject({ math: true, simplest: true, image: { path: FIG } })
  })

  it("rejects image paths outside a set's figure objects", () => {
    const ok = (path: string) =>
      questionContentSchema.safeParse({ type: "dung-sai", prompt: "?", points: 1, skills: [], answer: true, image: { path, width: 1, height: 1 } }).success
    expect(ok(FIG)).toBe(true)
    expect(ok("attempts/x/y-figure.jpg")).toBe(false)
    expect(ok("https://evil.example/x.jpg")).toBe(false)
  })

  it("strips the read-side picture URLs", () => {
    const parsed = editedQuestionSchema.parse({
      id: "q1", type: "dung-sai", prompt: "?", points: 1, skills: [], answer: true,
      image: { path: FIG, width: 10, height: 10 }, imageUrl: "https://signed.example/x",
      solutionImage: { path: FIG, width: 10, height: 10 }, solutionImageUrl: "https://signed.example/y",
    })
    expect(parsed).not.toHaveProperty("imageUrl")
    expect(parsed).not.toHaveProperty("solutionImageUrl")
    expect(parsed).toHaveProperty("image")
    expect(parsed).toHaveProperty("solutionImage")
  })

  it("checks the solution picture's path like the figure's", () => {
    const ok = (path: string) =>
      questionContentSchema.safeParse({ type: "dung-sai", prompt: "?", points: 1, skills: [], answer: true, solutionImage: { path, width: 1, height: 1 } }).success
    expect(ok(FIG)).toBe(true)
    expect(ok("https://evil.example/x.jpg")).toBe(false)
  })

  it("accepts a short answer without a key only while it is marked missing, and keeps the solution", () => {
    const q = { type: "tra-loi-ngan", prompt: "Tính 6 × 7", points: 1, skills: [], answer: "" }
    expect(questionContentSchema.safeParse(q).success).toBe(false)
    expect(questionContentSchema.safeParse({ ...q, answerStatus: "missing" }).success).toBe(true)
    expect(questionContentSchema.parse({ ...q, answer: "42", answerStatus: "ai", solution: "6 × 7 = 42" })).toMatchObject({ answerStatus: "ai", solution: "6 × 7 = 42" })
  })

  it("keeps a bài group and drops its signed URL", () => {
    const q = { id: "q1", type: "tra-loi-ngan", prompt: "David ___", points: 1, skills: [], answer: "He" }
    const parsed = editedQuestionSchema.parse({ ...q, group: { id: "g1", label: " Part 3 ", prompt: "Complete.", image: { path: FIG, width: 4, height: 3 }, imageUrl: "https://x/y" } })
    expect(parsed.group).toEqual({ id: "g1", label: "Part 3", prompt: "Complete.", image: { path: FIG, width: 4, height: 3 } })
    expect(questionContentSchema.parse({ ...q, group: { id: "g1", label: "", prompt: "" } }).group).toEqual({ id: "g1", prompt: "" })
    expect(questionContentSchema.safeParse({ ...q, group: { id: "g1", label: "x".repeat(41), prompt: "" } }).success).toBe(false)
    expect(questionContentSchema.parse({ ...q, group: { id: "g1", prompt: "# T", layout: "doan-van" } }).group).toEqual({ id: "g1", prompt: "# T", layout: "doan-van" })
    expect(questionContentSchema.safeParse({ ...q, group: { id: "g1", prompt: "", layout: "x" } }).success).toBe(false)
  })

  it("keeps blank on a short answer and refuses blank 0", () => {
    const sa = (blank: number) => questionContentSchema.safeParse({ type: "tra-loi-ngan", prompt: "", answer: "calm", points: 1, skills: [], blank, group: { id: "g", prompt: "___ ___" } })
    const ok = sa(2)
    expect(ok.success && "blank" in ok.data ? ok.data.blank : undefined).toBe(2)
    expect(sa(0).success).toBe(false)
    // Only a blank câu may have no text of its own.
    expect(questionContentSchema.safeParse({ type: "tra-loi-ngan", prompt: " ", answer: "calm", points: 1, skills: [] }).success).toBe(false)
  })
})
