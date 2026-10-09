import { z } from "zod"
import { OPTION_LETTERS } from "@/lib/questions"
import type { Question } from "@/lib/types"
import { correctAnswerText, pointStep } from "@/lib/views/grading"
import { answerKey, QUESTION_TYPE_NAMES } from "./question-format"

/*
 * Pure pieces of AI grading: system prompts, output schemas, the question
 * text sent to Claude and the mapping of Claude's answer back onto the
 * grading form. The server actions (server/actions/ai-grading.ts) only load
 * data, attach images and call ask(). Nothing here saves grades: the parent
 * reviews every mark and finishes grading through gradeAttempt.
 */

/** Below this confidence a paper mark is flagged "AI chưa chắc – kiểm tra lại". */
export const LOW_CONFIDENCE = 0.7

export const ESSAY_SYSTEM = `You help a Vietnamese parent grade open-ended (tự luận) answers of their child, a grade-3 primary-school student in Vietnam.

For each question you get the prompt, the grading guide (rubric) and the maximum points, then the child's answer: typed text, a photo of handwriting, or both.
- Read the handwriting carefully. Grade-3 handwriting is uneven and may have spelling mistakes; judge the content first, and only take points off for spelling or presentation when the rubric or the question asks for it.
- Judge against the rubric. When there is no rubric, judge whether the answer responds to the question correctly and completely for a grade-3 child.
- points: from 0 to the maximum. Give partial credit for partly correct answers. An empty or off-topic answer gets 0.
- comment: in Vietnamese, addressed to the child ("con"), 1–2 short sentences: first what is good, then one concrete thing to fix or add. Warm and encouraging, never harsh, no generic praise only.
- Use the question numbers you were given.
The parent reviews every suggestion before anything is saved.`

export const PAPER_SYSTEM = `You help a Vietnamese parent grade homework that their child, a grade-3 primary-school student in Vietnam, did on paper. You get photos/scans of the child's pages and the numbered list of questions with their answer keys and points.

For every question in the list:
- Find the child's answer on the pages (matching the question number or position) and transcribe it exactly as written into studentAnswer, in the language it is written in. For multiple choice give the chosen letter and option; for true/false "Đúng"/"Sai"; for matching the pairs the child drew. Do not correct the child's spelling or numbers.
- Compare it with the answer key. Objective questions get full points when correct and 0 when wrong; accept equivalent forms (e.g. "24kg" for "24 kg", a missing unit when the number is right, the option text instead of its letter). Open-ended (tự luận) questions are judged against the rubric with partial credit allowed.
- points: from 0 to the question's maximum. isCorrect: true when the answer is (mostly) correct.
- comment: null when the answer is simply correct; otherwise one short Vietnamese sentence addressed to the child ("con"), encouraging and concrete (what to check or fix).
- note: a short Vietnamese note for the parent when something is uncertain (crossed out, hard to read, answer not found, ambiguous); null otherwise.
- confidence 0–1: how sure you are about both the transcription and the mark. If the answer is missing, unreadable or you cannot find it, set studentAnswer to "", isCorrect false, points 0, explain in note and use confidence ≤ 0.3.
Include every question number exactly once.

overallFeedback: 2–3 short Vietnamese sentences for the child ("con"): what went well, the main thing to practise, a warm encouragement. Do not invent results; base it on your marks.
The parent reviews every mark before anything is saved.`

/* ---------- Output schemas ---------- */

export const essayGradesSchema = z.object({
  grades: z.array(
    z.object({
      questionNumber: z.number().int().describe("The question number as given"),
      points: z.number().describe("Points awarded, 0 to the question's maximum"),
      comment: z.string().describe("1-2 short Vietnamese sentences addressed to the child, encouraging and concrete"),
    }),
  ),
})
export type EssayGrades = z.infer<typeof essayGradesSchema>

export const paperGradesSchema = z.object({
  questions: z.array(
    z.object({
      questionNumber: z.number().int().describe("The question number as given in the list"),
      studentAnswer: z.string().describe("The child's answer transcribed exactly as written; \"\" if missing or unreadable"),
      isCorrect: z.boolean(),
      points: z.number().describe("Points awarded, 0 to the question's maximum"),
      comment: z.string().nullable().describe("Short Vietnamese sentence for the child, or null when simply correct"),
      note: z.string().nullable().describe("Short Vietnamese note for the parent when something is uncertain, else null"),
      confidence: z.number().describe("0-1"),
    }),
  ),
  overallFeedback: z.string().describe("2-3 short Vietnamese sentences of overall feedback for the child"),
})
export type PaperGrades = z.infer<typeof paperGradesSchema>

/* ---------- Results the grading screen applies ---------- */

export interface AiMark {
  isCorrect: boolean
  pointsAwarded: number
  comment: string
}

export interface AiPaperMark extends AiMark {
  /** The child's answer as Claude read it from the scan ("" = not found). */
  studentAnswer: string
  /** Parent-facing remark (uncertain reading, answer not found…). */
  note: string | null
  confidence: number
}

export interface AiPaperResult {
  /** By answer id. */
  marks: Record<string, AiPaperMark>
  feedback: string
}

/* ---------- Helpers ---------- */

/** Clamps to 0 … max and rounds to the grading screen's step (quarter or half points). */
export function roundToStep(points: number, max: number): number {
  if (!Number.isFinite(points) || max <= 0) return 0
  const step = pointStep(max)
  const clamped = Math.min(max, Math.max(0, points))
  const rounded = Math.round(clamped / step) * step
  return Math.round(Math.min(max, rounded) * 100) / 100
}

/** The app's rule: an answer counts as correct with at least half of its points. */
export const isPassing = (points: number, max: number) => points >= max / 2

const clip = (text: string | null | undefined, max = 400) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/** Number and points header of one question in a prompt. */
function questionHeader(q: Question, n: number) {
  return `Câu ${n} (${QUESTION_TYPE_NAMES[q.type]}, tối đa ${q.points} điểm)`
}

/** One essay question for ESSAY_SYSTEM: prompt, rubric, points and the child's typed text. */
export function essayQuestionText(q: Question, n: number, typed: string): string {
  const rubric = q.type === "tu-luan" && q.rubric.trim() ? q.rubric.trim() : "(không có – tự đánh giá theo đề bài)"
  return [
    `${questionHeader(q, n)}`,
    `Đề bài: ${q.prompt}`,
    `Gợi ý chấm: ${rubric}`,
    `Bài làm của con (gõ phím): ${typed.trim() || "(không gõ chữ)"}`,
  ].join("\n")
}

/** One question of the paper list, with what the child sees and the answer key. */
export function paperQuestionText(q: Question, n: number): string {
  const lines = [questionHeader(q, n), `Đề bài: ${q.prompt}`]
  switch (q.type) {
    case "trac-nghiem":
      lines.push(`Các lựa chọn: ${q.options.map((o, i) => `${OPTION_LETTERS[i] ?? i + 1}. ${o}`).join(" | ")}`)
      lines.push(`Đáp án: ${correctAnswerText(q)}`)
      break
    case "noi":
      lines.push(`Cột trái: ${q.pairs.map((p) => p.left).join(" | ")}`)
      lines.push(`Đáp án (nối đúng): ${answerKey(q)}`)
      break
    case "sap-xep":
      lines.push(`Các từ cần sắp xếp: ${q.tokens.join(" / ")}`)
      lines.push(`Đáp án: ${answerKey(q)}`)
      break
    case "tu-luan":
      lines.push(`Gợi ý chấm: ${q.rubric.trim() || "(không có – tự đánh giá theo đề bài)"}`)
      break
    default:
      lines.push(`Đáp án: ${answerKey(q)}`)
  }
  return lines.join("\n")
}

export function paperQuestionList(questions: { question: Question }[]): string {
  return `Danh sách câu hỏi (${questions.length} câu):\n\n${questions.map((a, i) => paperQuestionText(a.question, i + 1)).join("\n\n")}`
}

/** Claude's essay grades → marks by answer id. `items[i]` is question number `numbers[i]`. */
export function mapEssayGrades(items: { id: string; number: number; question: Question }[], result: EssayGrades): Record<string, AiMark> {
  const byNumber = new Map<number, EssayGrades["grades"][number]>()
  for (const g of result.grades) if (!byNumber.has(g.questionNumber)) byNumber.set(g.questionNumber, g)
  const marks: Record<string, AiMark> = {}
  for (const item of items) {
    const g = byNumber.get(item.number) ?? (items.length === 1 && result.grades.length === 1 ? result.grades[0] : undefined)
    if (!g) continue
    const max = item.question.points
    const points = roundToStep(g.points, max)
    marks[item.id] = { isCorrect: isPassing(points, max), pointsAwarded: points, comment: clip(g.comment, 300) }
  }
  return marks
}

const NOT_FOUND_NOTE = "AI không tìm thấy câu trả lời trên ảnh – kiểm tra lại."

/**
 * Claude's paper grades → marks by answer id, by question number (position
 * order, 1-based). Questions Claude skipped get 0 points, a note and zero
 * confidence, so the parent sees them flagged.
 */
export function mapPaperGrades(answers: { id: string; question: Question }[], result: PaperGrades): AiPaperResult {
  const byNumber = new Map<number, PaperGrades["questions"][number]>()
  for (const g of result.questions) if (!byNumber.has(g.questionNumber)) byNumber.set(g.questionNumber, g)
  const marks: Record<string, AiPaperMark> = {}
  answers.forEach((a, i) => {
    const max = a.question.points
    const g = byNumber.get(i + 1)
    if (!g) {
      marks[a.id] = { isCorrect: false, pointsAwarded: 0, comment: "", studentAnswer: "", note: NOT_FOUND_NOTE, confidence: 0 }
      return
    }
    const studentAnswer = clip(g.studentAnswer, 600)
    const points = studentAnswer ? roundToStep(g.points, max) : 0
    let confidence = clamp01(g.confidence)
    let note = clip(g.note, 300) || null
    if (!studentAnswer) {
      confidence = Math.min(confidence, 0.3)
      note ??= NOT_FOUND_NOTE
    }
    marks[a.id] = { isCorrect: isPassing(points, max) && points > 0, pointsAwarded: points, comment: clip(g.comment, 300), studentAnswer, note, confidence }
  })
  return { marks, feedback: clip(result.overallFeedback, 1000) }
}

/** Splits an inline image data URL into an image block's media type and base64 data. */
export function parseImageDataUrl(url: string): { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url)
  return m ? { mediaType: m[1] as "image/png" | "image/jpeg" | "image/webp", data: m[2] } : null
}
