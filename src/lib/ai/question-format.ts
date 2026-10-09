import { z } from "zod"
import { questionContentSchema } from "@/lib/question-schema"
import { BLANK, shuffleIndexes } from "@/lib/questions"
import type { Question, QuestionContent, QuestionType } from "@/lib/types"

/*
 * The question shape Claude fills in (scan and generate). It is flat, with
 * nullable type-specific fields, which structured outputs handle more
 * reliably than a discriminated union. toQuestion() turns it into the app's
 * Question union and reports what had to be fixed or is missing.
 */

const QUESTION_TYPES = ["trac-nghiem", "dung-sai", "dien-cho-trong", "tra-loi-ngan", "noi", "sap-xep", "tu-luan"] as const

export const aiQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES).describe(
    "trac-nghiem = multiple choice; dung-sai = true/false; dien-cho-trong = fill in the blanks; tra-loi-ngan = short answer; noi = matching; sap-xep = put words in order; tu-luan = open-ended/essay",
  ),
  prompt: z.string().describe("Question text in the document's language. For dien-cho-trong mark every blank as ___ (three underscores)."),
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
  rubric: z.string().nullable().describe("tu-luan: what a good answer contains, for the parent grading it"),
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
}

/** Confidence ceiling for questions we had to repair or that miss something, so the review step flags them. */
export const REPAIRED_CONFIDENCE = 0.6

/** Any run of underscores/dots that reads as a blank becomes the canonical "___". */
function normalizeBlanks(prompt: string): string {
  return prompt.replace(/_{2,}|\.{4,}|…{2,}/g, BLANK)
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
      if (blanks === 0 && answers.length > 0) {
        prompt = `${prompt} ${Array(answers.length).fill(BLANK).join(" ; ")}`
        issues.push("Đã thêm chỗ trống vào cuối câu")
      } else if (blanks !== answers.length) issues.push(`Số chỗ trống (${blanks}) khác số đáp án (${answers.length})`)
      const filled = Array.from({ length: Math.max(blanks, answers.length, 1) }, (_, i) => answers[i]?.trim() ?? "")
      if (filled.some((a) => !a)) issues.push("Còn chỗ trống chưa có đáp án")
      return { ...base, prompt, type: "dien-cho-trong", answers: filled }
    }
    case "tra-loi-ngan":
      if (!ai.answer?.trim()) issues.push("Chưa có đáp án")
      return { ...base, type: "tra-loi-ngan", answer: ai.answer?.trim() ?? "" }
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
  const reported = Number.isFinite(ai.confidence) ? Math.min(1, Math.max(0, ai.confidence)) : 0.5
  return {
    question: { ...content, id } as Question,
    confidence: issues.length ? Math.min(reported, REPAIRED_CONFIDENCE) : reported,
    page: Math.max(1, Math.round(ai.page || 1)),
    notes: [...(ai.note?.trim() ? [ai.note.trim()] : []), ...issues],
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
