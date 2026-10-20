import { z } from "zod"
import { MATH_NOTATION_RULES, optionIndexes } from "@/lib/ai/question-format"
import { choiceKey } from "@/lib/choice"
import { evaluateMath } from "@/lib/math-answer"
import { OPTION_LETTERS } from "@/lib/questions"
import { fullPrompt } from "@/lib/question-groups"
import type { Question, SubjectId } from "@/lib/types"

/*
 * "Giải đáp án": the AI solves one question of a saved set and its answer key
 * and worked solution go straight into the question, marked as AI-solved.
 * Pure, so it is unit tested; src/server/actions/ai-solve.ts does the I/O.
 */

/** Below this the answer is saved but flagged for the parent to check ("ai-check"). */
export const SOLVE_SURE = 0.7

export const solveResponseSchema = z.object({
  correctIndexes: z
    .array(z.number().int())
    .nullable()
    .describe("trac-nghiem: 0-based indexes of the correct options; one index, or several only when more than one option is correct"),
  trueFalseAnswer: z.boolean().nullable().describe("dung-sai: true if the statement is true"),
  answers: z.array(z.string()).nullable().describe("dien-cho-trong: one answer per ___ in order"),
  answer: z.string().nullable().describe("tra-loi-ngan: the expected answer, with its unit when there is one"),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .nullable()
    .describe("noi: every left item with its matching right item, copied exactly as given"),
  tokens: z.array(z.string()).nullable().describe("sap-xep: the given parts, copied exactly, in the correct order"),
  rubric: z.string().nullable().describe("tu-luan: what a good answer contains, for the parent grading it, ending with the final answer (\"Đáp số: …\") for a maths problem"),
  solution: z.string().describe("Short worked solution in Vietnamese for the parent and child: the steps, then the answer. LaTeX between $ for formulas"),
  confidence: z.number().describe("0-1: how sure you are the answer is right"),
})

export type SolveResponse = z.infer<typeof solveResponseSchema>

const SUBJECT_NAMES: Record<SubjectId, string> = {
  toan: "Math (Toán)",
  "tieng-viet": "Vietnamese language (Tiếng Việt)",
  "tieng-anh": "English as a foreign language (Tiếng Anh)",
}

export const SOLVE_SYSTEM_PROMPT = `You write the answer key of one homework question for a Vietnamese primary-school homework app. The app grades the child's answers against it, so it must be exact; the parent checks it.

- Solve the question as a teacher of this grade expects, using methods the child has learnt.
- Fill only the answer field for the question's type (named in the request); leave the others null.
- Write a short worked solution in Vietnamese: the key steps, then the answer. It is shown to the parent and, after the last attempt, to the child.
- When you are not sure (unclear question or picture, several possible answers, long reasoning), still give your best answer and set confidence below ${SOLVE_SURE}.
${MATH_NOTATION_RULES.split("\n")[0]}`

const stripDollars = (s: string) => s.trim().replace(/^\$+|\$+$/g, "").trim()

/** The question as the child sees it, plus which answer field to fill. */
export function solveRequestText(q: Question, meta: { subject: SubjectId; grade: number }): string {
  const lines = [`Subject: ${SUBJECT_NAMES[meta.subject]}. Grade ${meta.grade} (Vietnamese primary school).`, "", `Question: ${fullPrompt(q)}`]
  switch (q.type) {
    case "trac-nghiem":
      lines.push(...q.options.map((o, i) => `${OPTION_LETTERS[i]}. ${o}`), "", "Type trac-nghiem (multiple choice): fill correctIndexes with every correct option (usually one).")
      break
    case "dung-sai":
      lines.push("", "Type dung-sai (true/false statement): fill trueFalseAnswer.")
      break
    case "dien-cho-trong":
      lines.push("", `Type dien-cho-trong: fill answers with one answer per ___ (${q.answers.length}).${q.math ? " The answers are numbers or expressions: write them as LaTeX without $." : ""}`)
      break
    case "tra-loi-ngan":
      lines.push("", `Type tra-loi-ngan (one short exact answer): fill answer.${q.math ? " It is a number or expression: write it as LaTeX without $." : ""}`)
      break
    case "noi":
      lines.push(
        `Left: ${q.pairs.map((p) => p.left).join(" | ")}`,
        `Right: ${q.pairs.map((p) => p.right).join(" | ")}`,
        "",
        "Type noi (matching): fill pairs with every left item and its right item.",
      )
      break
    case "sap-xep":
      lines.push(`Parts: ${q.shuffled.map((i) => q.tokens[i]).join(" / ")}`, "", "Type sap-xep (put in order): fill tokens with the parts in the correct order.")
      break
    case "tu-luan":
      lines.push("", "Type tu-luan (the child writes out the answer; the parent grades it): fill rubric.")
      break
  }
  return lines.join("\n")
}

const sameItems = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n")

/** The question with the AI's answer key and solution, or null when the answer doesn't fit the question. */
export function applySolution(q: Question, res: SolveResponse): Question | null {
  const solution = res.solution.trim()
  let sure = Number.isFinite(res.confidence) && res.confidence >= SOLVE_SURE
  const key = ((): Question | null => {
    switch (q.type) {
      case "trac-nghiem":
      {
        const correct = optionIndexes(res.correctIndexes, q.options.length)
        return correct.length ? { ...q, ...choiceKey(correct) } : null
      }
      case "dung-sai":
        return res.trueFalseAnswer === null ? null : { ...q, answer: res.trueFalseAnswer }
      case "dien-cho-trong": {
        const answers = (res.answers ?? []).map((a) => (q.math ? stripDollars(a) : a.trim()))
        if (answers.length !== q.answers.length || answers.some((a) => !a)) return null
        if (q.math && answers.some((a) => !evaluateMath(a))) sure = false
        return { ...q, answers }
      }
      case "tra-loi-ngan": {
        const answer = q.math ? stripDollars(res.answer ?? "") : (res.answer ?? "").trim()
        if (!answer) return null
        if (q.math && !evaluateMath(answer)) sure = false
        return { ...q, answer }
      }
      case "noi": {
        const pairs = (res.pairs ?? []).map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
        const rights = new Map(pairs.map((p) => [p.left, p.right]))
        if (!sameItems(pairs.map((p) => p.left), q.pairs.map((p) => p.left)) || !sameItems(pairs.map((p) => p.right), q.pairs.map((p) => p.right))) return null
        return { ...q, pairs: q.pairs.map((p) => ({ ...p, right: rights.get(p.left)! })) }
      }
      case "sap-xep": {
        const tokens = (res.tokens ?? []).map((t) => t.trim())
        if (!sameItems(tokens, q.tokens)) return null
        // Keep the order the child is shown: map each shown part to its place in the correct order.
        const free = tokens.map((t, i) => ({ t, i }))
        const shuffled = q.shuffled.map((s) => free.splice(free.findIndex((f) => f.t === q.tokens[s]), 1)[0].i)
        return { ...q, tokens, shuffled }
      }
      case "tu-luan": {
        const rubric = res.rubric?.trim() || solution
        return rubric ? { ...q, rubric } : null
      }
      case "tu-vung":
        return null
    }
  })()
  if (!key) return null
  return { ...key, answerStatus: sure ? "ai" : "ai-check", ...(solution ? { solution } : {}) }
}
