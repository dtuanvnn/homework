import { z } from "zod"
import { choiceKey, correctOptions } from "@/lib/choice"
import { questionContentSchema } from "@/lib/question-schema"
import { BLANK, shuffleIndexes } from "@/lib/questions"
import type { Question, QuestionContent, QuestionType } from "@/lib/types"
import { repairBox, type Box } from "@/lib/figure-crop"
import { evaluateMath } from "@/lib/math-answer"

/*
 * The question shape Claude fills in (scan and generate). It is flat, with
 * nullable type-specific fields, which structured outputs handle more
 * reliably than a discriminated union. toQuestion() turns it into the app's
 * Question union and reports what had to be fixed or is missing.
 */

const QUESTION_TYPES = ["trac-nghiem", "dung-sai", "dien-cho-trong", "tra-loi-ngan", "noi", "sap-xep", "tu-luan"] as const

export const aiQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES).describe(
    "trac-nghiem = multiple choice; dung-sai = true/false; dien-cho-trong = fill in the blanks; tra-loi-ngan = one short exact answer (number, word, phrase); noi = matching; sap-xep = put words in order; tu-luan = written-out answer graded by the parent (essay, worked solution of a word problem, sentences)",
  ),
  prompt: z
    .string()
    .describe(
      "Question text in the document's language, keeping its line breaks as \\n (passages, poems, letters, one line per dialogue turn). For dien-cho-trong mark every blank as ___ (three underscores).",
    ),
  points: z.number().describe("Points for the question; 1 if the document doesn't say"),
  skills: z.array(z.string()).describe("1-2 short Vietnamese skill tags, e.g. \"Bảng nhân 7\", \"Toán có lời văn\", \"Dấu hỏi/ngã\""),
  options: z.array(z.string()).nullable().describe("trac-nghiem: the options without their A/B/C letters"),
  correctIndexes: z
    .array(z.number().int())
    .nullable()
    .describe("trac-nghiem: 0-based indexes of the correct options; one index, or several only when more than one option is correct (\"chọn tất cả đáp án đúng\")"),
  trueFalseAnswer: z.boolean().nullable().describe("dung-sai: true if the statement is true"),
  answers: z.array(z.string()).nullable().describe("dien-cho-trong: one answer per ___ in order"),
  answer: z.string().nullable().describe("tra-loi-ngan: the expected answer, with its unit when there is one (e.g. \"24 kg\")"),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .nullable()
    .describe("noi: correctly matched pairs"),
  tokens: z.array(z.string()).nullable().describe("sap-xep: the words/phrases in the CORRECT order"),
  rubric: z
    .string()
    .nullable()
    .describe("tu-luan: what a good answer contains, for the parent grading it; for a math problem the model solution and the final answer (\"Đáp số: …\")"),
  math: z
    .boolean()
    .nullable()
    .describe("tra-loi-ngan/dien-cho-trong: true when the answer is a number, fraction or expression the child types with a math keyboard; the answer(s) are then LaTeX without $"),
  simplest: z.boolean().nullable().describe("With math: true when the exercise asks for the simplest form (\"rút gọn\", \"tối giản\")"),
  figure: z
    .object({ box: z.array(z.number()).describe("[x0, y0, x1, y1] from 0 to 1000 of the page's width and height, tight around the drawing and its labels, without the question text or answer choices") })
    .nullable()
    .describe("The picture, diagram, drawn table or chart the child needs to answer, on this question's page; null when there is none"),
  solution: z
    .string()
    .nullable()
    .describe("Worked solution / how to solve it, in the document's language with LaTeX formulas; null when there is none"),
  confidence: z.number().describe("0-1: how sure you are the question and its answer are read/written correctly"),
  page: z.number().int().describe("1-based page/image the question comes from (1 when generating)"),
  note: z.string().nullable().describe("Short Vietnamese note for the parent when something is unclear (e.g. answer missing in the document); null otherwise"),
})

export type AiQuestion = z.infer<typeof aiQuestionSchema>

export interface ConvertedQuestion {
  question: Question
  confidence: number
  page: number
  /** Vietnamese notes for the review step: Claude's own, then anything fixed or missing. */
  notes: string[]
  figure?: { page: number; box: Box }
}

/** Confidence ceiling for questions we had to repair or that miss something, so the review step flags them. */
export const REPAIRED_CONFIDENCE = 0.6

/** Formula rules shared by the scan and generate prompts. */
export const MATH_NOTATION_RULES = `- Write every formula (fractions, mixed numbers, expressions with ×, ÷, powers) as LaTeX between dollar signs inside prompts and options, e.g. "Tính $\\frac{3}{4} + \\frac{1}{8}$", "$2\\frac{1}{3}$", "$12 \\times 5$". Plain numbers and units need no LaTeX ("24 kg").
- Set math to true for tra-loi-ngan and dien-cho-trong questions whose answer is a number, fraction or expression the child types with a math keyboard; then write the answer(s) as LaTeX without dollar signs, e.g. "\\frac{3}{4}", "2\\frac{1}{3}", "0{,}75". Answers with words or units ("24 kg", "Thứ năm") keep math null.
- Set simplest to true when the exercise asks for the simplest form ("rút gọn", "phân số tối giản").`

/** Any run of underscores/dots that reads as a blank becomes the canonical "___". */
function normalizeBlanks(prompt: string): string {
  return prompt.replace(/_{2,}|\.{4,}|…{2,}/g, BLANK)
}

const stripDollars = (s: string) => s.trim().replace(/^\$+|\$+$/g, "").trim()

/**
 * Where answer keys come from: "solve" = the model wrote them (generated sets),
 * "none" = a transcription-only scan (keys left for later), "document" = read
 * from the answers printed in the document, where some may be missing.
 */
export type AnswerSource = "solve" | "none" | "document"

/** The valid, distinct option indexes among the model's (out-of-range ones dropped). */
export function optionIndexes(indexes: number[] | null | undefined, optionCount: number): number[] {
  return [...new Set((indexes ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < optionCount))].sort((a, b) => a - b)
}

/** Whether the model gave this question an answer key. */
function hasKey(ai: AiQuestion): boolean {
  switch (ai.type) {
    case "trac-nghiem":
      return optionIndexes(ai.correctIndexes, ai.options?.length ?? 0).length > 0
    case "dung-sai":
      return ai.trueFalseAnswer !== null
    case "dien-cho-trong":
      return Boolean(ai.answers?.length && ai.answers.every((a) => a.trim()))
    case "tra-loi-ngan":
      return Boolean(ai.answer?.trim())
    case "noi":
    case "sap-xep":
      return true
    case "tu-luan":
      return Boolean(ai.rubric?.trim() || ai.solution?.trim())
  }
}

/** A question without an answer key: the content as printed, placeholder answers, nothing flagged for the missing key. */
function keylessDraft(ai: AiQuestion, issues: string[]): QuestionContent {
  const base = {
    prompt: ai.prompt.trim(),
    points: Number.isFinite(ai.points) && ai.points > 0 ? Math.min(ai.points, 100) : 1,
    skills: ai.skills.map((s) => s.trim()).filter(Boolean).slice(0, 4),
  }
  const math = ai.math ? { math: true as const, ...(ai.simplest ? { simplest: true as const } : {}) } : {}
  switch (ai.type) {
    case "trac-nghiem":
      return { ...base, type: "trac-nghiem", options: (ai.options ?? []).map((o) => o.trim()).filter(Boolean), correctIndex: 0 }
    case "dung-sai":
      return { ...base, type: "dung-sai", answer: true }
    case "dien-cho-trong": {
      const prompt = normalizeBlanks(base.prompt)
      const blanks = prompt.split(BLANK).length - 1
      if (!blanks) issues.push(`Chưa thấy chỗ trống (${BLANK}) trong câu`)
      return { ...base, prompt, type: "dien-cho-trong", answers: Array(Math.max(1, blanks)).fill(""), ...math }
    }
    case "tra-loi-ngan":
      return { ...base, type: "tra-loi-ngan", answer: "", ...math }
    case "noi": {
      const pairs = (ai.pairs ?? []).filter((p) => p.left.trim() && p.right.trim())
      if (pairs.length < 2) issues.push("Cần ít nhất 2 cặp để nối")
      return { ...base, type: "noi", pairs }
    }
    case "sap-xep": {
      // Printed in jumbled order: show it as printed until the key puts it in order.
      const tokens = (ai.tokens ?? []).map((t) => t.trim()).filter(Boolean)
      if (tokens.length < 2) issues.push("Cần ít nhất 2 từ để sắp xếp")
      return { ...base, type: "sap-xep", tokens, shuffled: tokens.map((_, i) => i) }
    }
    case "tu-luan":
      return { ...base, type: "tu-luan", rubric: "" }
  }
}

/** Math flags for answers `answers`; math is turned off (with a note) when one can't be evaluated. */
function mathFlags(ai: AiQuestion, answers: string[], issues: string[]): { math?: true; simplest?: true } {
  if (!ai.math) return {}
  if (!answers.length || answers.some((a) => !evaluateMath(a))) {
    issues.push("Đáp án dạng toán chưa đọc được – kiểm tra lại")
    return {}
  }
  return ai.simplest ? { math: true, simplest: true } : { math: true }
}

function draft(ai: AiQuestion, issues: string[]): QuestionContent {
  const base = {
    prompt: ai.prompt.trim(),
    points: Number.isFinite(ai.points) && ai.points > 0 ? Math.min(ai.points, 100) : 1,
    skills: ai.skills.map((s) => s.trim()).filter(Boolean).slice(0, 4),
  }
  switch (ai.type) {
    case "trac-nghiem": {
      const options = (ai.options ?? []).map((o) => o.trim()).filter(Boolean)
      const correct = optionIndexes(ai.correctIndexes, options.length)
      if (!correct.length) issues.push("Chưa xác định được đáp án đúng")
      const { correctIndexes, ...key } = choiceKey(correct)
      return { ...base, type: "trac-nghiem", options, ...key, ...(correctIndexes ? { correctIndexes } : {}) }
    }
    case "dung-sai":
      if (ai.trueFalseAnswer === null) issues.push("Chưa xác định được Đúng hay Sai")
      return { ...base, type: "dung-sai", answer: ai.trueFalseAnswer ?? true }
    case "dien-cho-trong": {
      let prompt = normalizeBlanks(base.prompt)
      const answers = ai.answers ?? []
      const blanks = prompt.split(BLANK).length - 1
      // "6 × 10 =" with one answer is common and harmless: append the blank without flagging it.
      if (blanks === 0 && answers.length > 0) prompt = `${prompt} ${Array(answers.length).fill(BLANK).join(" ; ")}`
      else if (blanks !== answers.length) issues.push(`Số chỗ trống (${blanks}) khác số đáp án (${answers.length})`)
      const filled = Array.from({ length: Math.max(blanks, answers.length, 1) }, (_, i) => {
        const a = answers[i]?.trim() ?? ""
        return ai.math ? stripDollars(a) : a
      })
      if (filled.some((a) => !a)) issues.push("Còn chỗ trống chưa có đáp án")
      return { ...base, prompt, type: "dien-cho-trong", answers: filled, ...mathFlags(ai, filled.filter(Boolean), issues) }
    }
    case "tra-loi-ngan": {
      const answer = ai.math ? stripDollars(ai.answer ?? "") : (ai.answer?.trim() ?? "")
      if (!answer) issues.push("Chưa có đáp án")
      return { ...base, type: "tra-loi-ngan", answer, ...mathFlags(ai, answer ? [answer] : [], issues) }
    }
    case "noi": {
      const pairs = (ai.pairs ?? []).filter((p) => p.left.trim() && p.right.trim())
      if (pairs.length < 2) issues.push("Cần ít nhất 2 cặp để nối")
      return { ...base, type: "noi", pairs }
    }
    case "sap-xep": {
      const tokens = (ai.tokens ?? []).map((t) => t.trim()).filter(Boolean)
      if (tokens.length < 2) issues.push("Cần ít nhất 2 từ để sắp xếp")
      return { ...base, type: "sap-xep", tokens, shuffled: shuffleIndexes(tokens.length) }
    }
    case "tu-luan":
      return { ...base, type: "tu-luan", rubric: ai.rubric?.trim() ?? "" }
  }
}

export function toQuestion(ai: AiQuestion, id: string, { answers = "solve" }: { answers?: AnswerSource } = {}): ConvertedQuestion {
  const issues: string[] = []
  const keyless = answers === "none" || (answers === "document" && !hasKey(ai))
  const notes = answers === "document" && keyless ? ["Tài liệu không có đáp án câu này"] : []
  const solution = ai.solution?.trim()
  const content: QuestionContent = {
    ...(keyless ? keylessDraft(ai, issues) : draft(ai, issues)),
    ...(keyless ? { answerStatus: "missing" as const } : {}),
    ...(solution ? { solution } : {}),
  }
  if (!issues.length && !questionContentSchema.safeParse(content).success) issues.push("Câu hỏi chưa đủ thông tin")
  const page = Math.max(1, Math.round(ai.page || 1))
  let figure: ConvertedQuestion["figure"]
  if (ai.figure) {
    const box = repairBox(ai.figure.box)
    if (box) figure = { page, box }
    else issues.push("Chưa xác định được vị trí hình – hãy thêm hình bằng tay")
  }
  const reported = Number.isFinite(ai.confidence) ? Math.min(1, Math.max(0, ai.confidence)) : 0.5
  return {
    question: { ...content, id } as Question,
    confidence: issues.length ? Math.min(reported, REPAIRED_CONFIDENCE) : reported,
    page,
    notes: [...(ai.note?.trim() ? [ai.note.trim()] : []), ...notes, ...issues],
    ...(figure ? { figure } : {}),
  }
}

/** Readable answer key of a question, for prompts (generation references, AI grading). */
export function answerKey(q: Question): string {
  if (q.answerStatus === "missing" && q.type !== "tu-luan") return "(chưa có đáp án)"
  switch (q.type) {
    case "trac-nghiem":
      return correctOptions(q).map((i) => q.options[i] ?? "").join(" ; ")
    case "dung-sai":
      return q.answer ? "Đúng" : "Sai"
    case "dien-cho-trong":
      return q.answers.join(" ; ")
    case "tra-loi-ngan":
      return q.answer
    case "noi":
      return q.pairs.map((p) => `${p.left} – ${p.right}`).join(" ; ")
    case "sap-xep":
      return q.tokens.join(" ")
    case "tu-luan":
      return q.rubric ? `(tự luận) ${q.rubric}` : "(tự luận)"
    case "tu-vung":
      return q.word
  }
}

export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  "trac-nghiem": "trắc nghiệm",
  "dung-sai": "đúng/sai",
  "dien-cho-trong": "điền vào chỗ trống",
  "tra-loi-ngan": "trả lời ngắn",
  noi: "nối",
  "sap-xep": "sắp xếp",
  "tu-luan": "tự luận",
  "tu-vung": "từ vựng (viết tay)",
}
