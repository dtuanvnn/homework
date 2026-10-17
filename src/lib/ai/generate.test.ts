import { describe, expect, it } from "vitest"
import type { AiQuestion } from "./question-format"
import {
  buildGeneratePrompt,
  GENERATE_SYSTEM_PROMPT,
  generateInputSchema,
  mapGeneratedSet,
  MAX_REFERENCE_QUESTIONS,
  typeMix,
  type GeneratedSet,
  type ParsedGenerateInput,
} from "./generate"
import type { Question } from "@/lib/types"

const input = (patch: Partial<ParsedGenerateInput> = {}): ParsedGenerateInput => ({
  subject: "toan",
  grade: 3,
  kind: "luyen-tap",
  topics: ["Bảng nhân 7"],
  count: 10,
  difficulty: 2,
  types: ["trac-nghiem", "tra-loi-ngan"],
  referenceSetIds: [],
  note: "",
  variation: 0,
  ...patch,
})

const blank: AiQuestion = {
  type: "tra-loi-ngan",
  prompt: "7 × 8 = ?",
  points: 1,
  skills: ["Bảng nhân 7"],
  options: null,
  correctIndexes: null,
  trueFalseAnswer: null,
  answers: null,
  answer: "56",
  pairs: null,
  tokens: null,
  rubric: null,
  confidence: 0.9,
  page: 1,
  note: null,
  math: null,
  simplest: null,
  figure: null,
  solution: null,
}
const ai = (patch: Partial<AiQuestion> = {}): AiQuestion => ({ ...blank, ...patch })
const output = (questions: AiQuestion[], patch: Partial<GeneratedSet> = {}): GeneratedSet => ({
  title: " Luyện tập Bảng nhân 7 ",
  description: "Ôn bảng nhân 7.",
  estimatedMinutes: 15,
  questions,
  ...patch,
})
const ids = () => {
  let n = 0
  return () => `q${++n}`
}

describe("typeMix", () => {
  it("splits evenly and gives the remainder to the first types", () => {
    expect(typeMix(["trac-nghiem", "dien-cho-trong", "tra-loi-ngan"], 10)).toEqual([
      { type: "trac-nghiem", count: 4 },
      { type: "dien-cho-trong", count: 3 },
      { type: "tra-loi-ngan", count: 3 },
    ])
  })

  it("drops types that get no question and ignores duplicates", () => {
    expect(typeMix(["noi", "noi", "sap-xep", "tu-luan"], 2)).toEqual([
      { type: "noi", count: 1 },
      { type: "sap-xep", count: 1 },
    ])
    expect(typeMix([], 5)).toEqual([])
  })
})

describe("generateInputSchema", () => {
  const valid = { ...input(), variation: undefined }

  it("accepts a valid form and defaults variation to 0", () => {
    expect(generateInputSchema.parse(valid).variation).toBe(0)
  })

  it("rejects out-of-range or malformed input", () => {
    expect(generateInputSchema.safeParse({ ...valid, count: 31 }).success).toBe(false)
    expect(generateInputSchema.safeParse({ ...valid, count: 4 }).success).toBe(false)
    expect(generateInputSchema.safeParse({ ...valid, topics: [] }).success).toBe(false)
    expect(generateInputSchema.safeParse({ ...valid, types: [] }).success).toBe(false)
    expect(generateInputSchema.safeParse({ ...valid, types: ["essay"] }).success).toBe(false)
    expect(generateInputSchema.safeParse({ ...valid, referenceSetIds: ["not-a-uuid"] }).success).toBe(false)
    const uuid = "6f1c2a1e-1d7b-4c5e-9a3f-2b8d4e6f7a90"
    expect(generateInputSchema.safeParse({ ...valid, referenceSetIds: [uuid, uuid, uuid, uuid] }).success).toBe(false)
    expect(generateInputSchema.safeParse({ ...valid, note: "x".repeat(501) }).success).toBe(false)
  })
})

describe("buildGeneratePrompt", () => {
  it("states subject, grade, topics, difficulty and the exact type mix", () => {
    const prompt = buildGeneratePrompt(input({ types: ["trac-nghiem", "dien-cho-trong", "tu-luan"], count: 7, difficulty: 4 }))
    expect(prompt).toContain("Subject: Toán")
    expect(prompt).toContain("Grade: 3")
    expect(prompt).toContain("Topics: Bảng nhân 7")
    expect(prompt).toContain("Difficulty: 4/5")
    expect(prompt).toContain("exactly 7")
    expect(prompt).toContain("- 3 × trac-nghiem (trắc nghiệm)")
    expect(prompt).toContain("- 2 × dien-cho-trong (điền vào chỗ trống)")
    expect(prompt).toContain("- 2 × tu-luan (tự luận)")
    expect(prompt).not.toContain("Reference")
    expect(prompt).not.toContain("Variation")
    expect(prompt).not.toContain("extra request")
  })

  it("formats reference questions compactly as type, prompt and answer key", () => {
    const refs: { title: string; questions: Question[] }[] = [
      {
        title: "Ôn tập  bảng nhân",
        questions: [
          { id: "a", type: "trac-nghiem", prompt: "6 × 7 = ?", options: ["42", "48"], correctIndex: 0, points: 1, skills: [] },
          { id: "b", type: "dien-cho-trong", prompt: "8 × ___ = 24\nvà ___ × 5 = 10", answers: ["3", "2"], points: 1, skills: [] },
        ],
      },
      { title: "Bộ trống", questions: [] },
    ]
    const prompt = buildGeneratePrompt(input(), refs)
    expect(prompt).toContain('Reference set 1: "Ôn tập bảng nhân"')
    expect(prompt).toContain("- [trac-nghiem] 6 × 7 = ? => 42")
    expect(prompt).toContain("- [dien-cho-trong] 8 × ___ = 24 và ___ × 5 = 10 => 3 ; 2")
    expect(prompt).not.toContain("Bộ trống")
  })

  it("caps the number of reference questions across sets", () => {
    const many = (prefix: string): Question[] =>
      Array.from({ length: 30 }, (_, i) => ({ id: `${prefix}${i}`, type: "tra-loi-ngan", prompt: `${prefix} câu ${i}`, answer: "1", points: 1, skills: [] }))
    const prompt = buildGeneratePrompt(input(), [
      { title: "A", questions: many("A") },
      { title: "B", questions: many("B") },
    ])
    expect(prompt.match(/^- \[tra-loi-ngan\]/gm)).toHaveLength(MAX_REFERENCE_QUESTIONS)
  })

  it("includes the parent's note, test ordering and the variation hint", () => {
    const prompt = buildGeneratePrompt(input({ kind: "de-thi", note: "  Thêm toán có lời văn ", variation: 2 }))
    expect(prompt).toContain("Parent's extra request (in Vietnamese): Thêm toán có lời văn")
    expect(prompt).toContain("test (đề thi)")
    expect(prompt).toContain("Variation 2")
  })
})

describe("mapGeneratedSet", () => {
  it("maps questions with fresh ids and trims the set meta", () => {
    const r = mapGeneratedSet(output([ai(), ai({ type: "trac-nghiem", options: ["1", "2"], correctIndexes: [1], answer: null })]), input({ count: 2 }), ids())
    expect(r.title).toBe("Luyện tập Bảng nhân 7")
    expect(r.estimatedMinutes).toBe(15)
    expect(r.items.map((i) => i.question.id)).toEqual(["q1", "q2"])
    expect(r.items[0].question).toMatchObject({ type: "tra-loi-ngan", answer: "56" })
    expect(r.shortfall).toBeNull()
  })

  it("drops unselected types, caps at count and reports a shortfall", () => {
    const qs = [ai({ type: "noi" }), ai(), ai({ type: "tu-luan", rubric: "x" })]
    const r = mapGeneratedSet(output(qs), input({ count: 5, types: ["tra-loi-ngan"] }), ids())
    expect(r.items).toHaveLength(1)
    expect(r.shortfall).toContain("1/5")

    const capped = mapGeneratedSet(output([ai(), ai(), ai()]), input({ count: 2, types: ["tra-loi-ngan"] }), ids())
    expect(capped.items).toHaveLength(2)
    expect(capped.shortfall).toBeNull()
  })

  it("keeps Claude's note and repair notes for review", () => {
    const r = mapGeneratedSet(output([ai({ answer: null, note: "Kiểm tra lại đơn vị" })]), input({ count: 1 }), ids())
    expect(r.items[0].notes).toEqual(["Kiểm tra lại đơn vị", "Chưa có đáp án"])
  })

  it("clamps estimated minutes", () => {
    expect(mapGeneratedSet(output([ai()], { estimatedMinutes: 0 }), input({ count: 1 }), ids()).estimatedMinutes).toBe(2)
    expect(mapGeneratedSet(output([ai()], { estimatedMinutes: 999 }), input({ count: 1 }), ids()).estimatedMinutes).toBe(240)
  })
})

it("asks for LaTeX formulas and no figures", () => {
  expect(GENERATE_SYSTEM_PROMPT).toContain("$\\frac{3}{4} + \\frac{1}{8}$")
  expect(GENERATE_SYSTEM_PROMPT).toContain("Never fill figure")
})
