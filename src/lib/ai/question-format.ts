import { z } from "zod"
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
  correctIndex: z.number().int().nullable().describe("trac-nghiem: 0-based index of the correct option"),
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
    .object({ box: z.array(z.number()).describe("[x0, y0, x1, y1] from 0 to 1000 of the page's width and height, tight around the drawing and its labels") })
    .nullable()
    .describe("The picture, diagram, drawn table or chart the child needs to answer, on this question's page; null when there is none"),
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
      const ok = ai.correctIndex !== null && ai.correctIndex >= 0 && ai.correctIndex < options.length
      if (!ok) issues.push("Chưa xác định được đáp án đúng")
      return { ...base, type: "trac-nghiem", options, correctIndex: ok ? ai.correctIndex! : 0 }
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

export function toQuestion(ai: AiQuestion, id: string): ConvertedQuestion {
  const issues: string[] = []
  const content = draft(ai, issues)
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
    notes: [...(ai.note?.trim() ? [ai.note.trim()] : []), ...issues],
    ...(figure ? { figure } : {}),
  }
}

/** Readable answer key of a question, for prompts (generation references, AI grading). */
export function answerKey(q: Question): string {
  switch (q.type) {
    case "trac-nghiem":
      return q.options[q.correctIndex] ?? ""
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
}
