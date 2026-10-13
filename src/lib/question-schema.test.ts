import { describe, expect, it } from "vitest"
import { editedQuestionSchema, questionContentSchema } from "./question-schema"

const FIG = "sets/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg"

describe("question schema", () => {
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

  it("strips the read-side imageUrl", () => {
    const parsed = editedQuestionSchema.parse({
      id: "q1", type: "dung-sai", prompt: "?", points: 1, skills: [], answer: true,
      image: { path: FIG, width: 10, height: 10 }, imageUrl: "https://signed.example/x",
    })
    expect(parsed).not.toHaveProperty("imageUrl")
    expect(parsed).toHaveProperty("image")
  })
})
