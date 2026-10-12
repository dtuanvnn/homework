"use server"

import { eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { runAction, type ActionResult } from "@/lib/action-result"
import { HINTS_SYSTEM, hintsPrompt, hintsResponseSchema, validateHints, type HintItem } from "@/lib/ai/hints"
import { buildResultDetail } from "@/lib/views/student"
import { assertAccess } from "../access"
import { ask } from "../ai/llm"
import { getAttemptDetail, isUuid } from "../queries"

const { answers } = schema

/**
 * Writes AI hints for the wrong answers of a graded attempt the child may
 * still redo (answers hidden), once: they are saved on the answer rows.
 * Essays are left to the parent's comments. Returns the hints by answer id.
 */
export async function explainMistakes(attemptId: string): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => {
    await assertAccess("student")
    if (!isUuid(attemptId)) throw new Error("Không tìm thấy bài.")
    const detail = await getAttemptDetail(attemptId)
    const view = detail && buildResultDetail(detail, new Date())
    if (!detail || !view || view.answersRevealed) return {}

    const items: HintItem[] = detail.answers
      .filter((a) => a.isCorrect === false && !a.hint && a.question.type !== "tu-luan")
      .map((a) => ({ id: a.id, question: a.question, response: a.response }))
    if (!items.length) return {}

    const { set } = detail.assignment
    const result = await ask({
      system: HINTS_SYSTEM,
      content: [{ type: "text", text: hintsPrompt(items, set.subject, set.grade) }],
      schema: hintsResponseSchema,
      effort: "low",
      maxTokens: 6000,
    })
    const hints = validateHints(result, items)
    await db.transaction(async (tx) => {
      for (const [id, hint] of Object.entries(hints)) await tx.update(answers).set({ hint }).where(eq(answers.id, id))
    })
    return hints
  })
}
