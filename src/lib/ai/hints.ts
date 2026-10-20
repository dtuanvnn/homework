import { z } from "zod"
import { correctOptions } from "@/lib/choice"
import { answerKey, QUESTION_TYPE_NAMES } from "@/lib/ai/question-format"
import { normalizeText, type Response } from "@/lib/grading"
import { equalRational, evaluateMath, latexToPlain, mathValuesIn } from "@/lib/math-answer"
import { SUBJECTS } from "@/lib/subjects"
import type { Question, SubjectId } from "@/lib/types"
import { answerText } from "@/lib/views/student"
import { fullPrompt } from "@/lib/question-groups"

/*
 * Hints for wrong answers on the child's result page while a retry is still
 * open: what went wrong and how to get it right, never the answer itself.
 * Pure (prompt, schema, leak filter); the action is server/actions/ai-hints.ts.
 */

export interface HintItem {
  /** Answer row id. */
  id: string
  question: Question
  response: Response | null
}

export const HINTS_SYSTEM = `You help a Vietnamese primary-school child learn from mistakes in a homework app. The child will redo the exercise, so you must NOT give away any answer.

For each wrong answer you get the question, the child's answer and the correct answer (for you only). Write one hint in Vietnamese, speaking to the child as "em", warm and encouraging, 1–3 short sentences a child of this grade understands:
- Say what went wrong in the child's answer (e.g. forgot the unit, added instead of subtracting, misread the question, wrong tense, chose an option that doesn't fit). If the child didn't answer, encourage them to try and say how to start.
- Then guide how to do it right: the method, the rule, or the first step to take.
- NEVER write the correct answer, the correct option or its letter, the final number, the missing word(s), the correct word order, or "Đúng"/"Sai" as the verdict for a true/false statement. Don't do the last step of the calculation for the child.
Return one hint per id you were given.`

export const hintsResponseSchema = z.object({
  hints: z
    .array(
      z.object({
        id: z.string().describe("The id of the answer"),
        hint: z.string().describe("1-3 short Vietnamese sentences for the child, without the answer"),
      }),
    )
    .describe("One hint per wrong answer"),
})
export type HintsResponse = z.infer<typeof hintsResponseSchema>

export function hintsPrompt(items: HintItem[], subject: SubjectId, grade: number): string {
  const lines = [`Môn ${SUBJECTS[subject].name}, lớp ${grade}.`, ""]
  for (const { id, question: q, response } of items) {
    lines.push(`id: ${id} (${QUESTION_TYPE_NAMES[q.type]})`)
    lines.push(`Câu hỏi: ${fullPrompt(q)}`)
    if (q.type === "trac-nghiem") lines.push(`Các lựa chọn: ${q.options.join(" | ")}`)
    if (q.type === "noi") lines.push(`Cột A: ${q.pairs.map((p) => p.left).join(" | ")} — Cột B: ${q.pairs.map((p) => p.right).join(" | ")}`)
    if (q.type === "sap-xep") lines.push(`Các phần: ${q.shuffled.map((i) => q.tokens[i]).join(" / ")}`)
    lines.push(`Em trả lời: ${answerText(q, response)}`)
    lines.push(`Đáp án đúng (không được nói ra): ${answerKey(q)}`)
    lines.push("")
  }
  return lines.join("\n")
}

/** The answer pieces a hint must not contain (that the prompt doesn't already show). */
function secrets(q: Question): string[] {
  switch (q.type) {
    case "trac-nghiem":
      return correctOptions(q).map((i) => q.options[i] ?? "")
    // Numbers of 2+ digits on their own too ("605" of "605 kg"); single digits are too common in guidance.
    case "dien-cho-trong":
      return [...q.answers, ...q.answers.flatMap((a) => a.match(/\d{2,}/g) ?? [])]
    case "tra-loi-ngan":
      return [q.answer, ...(q.answer.match(/\d{2,}/g) ?? [])]
    case "sap-xep":
      return [q.tokens.join(" ")]
    default:
      return []
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const containsWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}($|[^\\p{L}\\p{N}])`, "u").test(text)

/** True when the hint gives away an answer that isn't already visible in the question. */
export function leaksAnswer(hint: string, q: Question): boolean {
  const plainHint = latexToPlain(hint)
  const text = normalizeText(plainHint)
  const prompt = normalizeText(latexToPlain(fullPrompt(q)))
  const textLeak = secrets(q).some((s) => {
    const secret = normalizeText(latexToPlain(s))
    return secret.length > 0 && containsWord(text, secret) && !containsWord(prompt, secret)
  })
  return textLeak || mathValueLeaks(plainHint, q)
}

/** Math keys also leak as any equal value (6/8 or 0,75 for 3/4) the question doesn't show. Single digits stay allowed. */
function mathValueLeaks(plainHint: string, q: Question): boolean {
  if ((q.type !== "tra-loi-ngan" && q.type !== "dien-cho-trong") || !q.math) return false
  const keys = q.type === "tra-loi-ngan" ? [q.answer] : q.answers
  const shown = mathValuesIn(latexToPlain(fullPrompt(q)))
  const said = mathValuesIn(plainHint).filter((c) => !/^\d$/.test(c.raw))
  return keys.some((k) => {
    const value = evaluateMath(k)
    if (!value || shown.some((s) => equalRational(s.value, value))) return false
    return said.some((c) => equalRational(c.value, value))
  })
}

/** Keeps one clean hint per known answer; drops hints that reveal the answer. */
export function validateHints(result: HintsResponse, items: HintItem[]): Record<string, string> {
  const byId = new Map(items.map((i) => [i.id, i]))
  const out: Record<string, string> = {}
  for (const { id, hint } of result.hints) {
    const item = byId.get(id)
    const text = hint.trim().slice(0, 600)
    if (!item || !text || out[id] || leaksAnswer(text, item.question)) continue
    out[id] = text
  }
  return out
}
