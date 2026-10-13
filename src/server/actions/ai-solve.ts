"use server"

import { z } from "zod"
import { runAction, type ActionResult } from "@/lib/action-result"
import { applySolution, SOLVE_SYSTEM_PROMPT, solveRequestText, solveResponseSchema } from "@/lib/ai/solve"
import { figureOwner } from "@/lib/figures"
import { editedQuestionSchema } from "@/lib/question-schema"
import type { Question } from "@/lib/types"
import { assertAccess } from "../access"
import { ask, storageFileBlocks } from "../ai/llm"

const solveInputSchema = z.object({
  setId: z.uuid(),
  subject: z.enum(["toan", "tieng-viet", "tieng-anh"]),
  grade: z.number().int().min(1).max(12),
  question: editedQuestionSchema,
})

export type SolveInput = z.input<typeof solveInputSchema>

/**
 * Solves one question of a set ("Giải đáp án") and returns it with the AI's
 * answer key and worked solution, marked "ai"/"ai-check". The client applies
 * it to the set and saves; one call per question keeps each within the 300 s
 * function limit, and the client runs a few at once.
 */
export async function solveQuestion(input: SolveInput): Promise<ActionResult<Question>> {
  return runAction(async () => {
    await assertAccess("parent")
    const { setId, subject, grade, question } = solveInputSchema.parse(input)
    const q = question as Question
    // Only figures of this set (the schema already checks the path's shape).
    const figure = q.image && figureOwner(q.image.path) === setId ? await storageFileBlocks(q.image.path, "Hình minh họa của câu hỏi:") : []
    const response = await ask({
      system: SOLVE_SYSTEM_PROMPT,
      content: [{ type: "text", text: solveRequestText(q, { subject, grade }) }, ...figure],
      schema: solveResponseSchema,
      effort: "medium",
      maxTokens: 32000,
    })
    const solved = applySolution(q, response)
    if (!solved) throw new Error("AI chưa đưa ra được đáp án hợp lệ cho câu này. Hãy thử lại hoặc tự nhập đáp án.")
    return solved
  })
}
