"use server"

import { eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { runAction, type ActionResult } from "@/lib/action-result"
import { HINTS_SYSTEM, hintsPrompt, hintsResponseSchema, validateHints, type HintItem } from "@/lib/ai/hints"
import { buildResultDetail, needsHint } from "@/lib/views/student"
import { assertAccess } from "../access"
import { ask, storageFileBlocks, type ContentBlock } from "../ai/llm"
import { getAttemptDetail, isUuid } from "../queries"
import { assertAttemptInScope } from "../ownership"

const { answers } = schema

/**
 * Writes AI hints for the wrong answers of a graded attempt the child may
 * still redo (answers hidden), once: they are saved on the answer rows.
 * Essays are left to the parent's comments. Returns the hints by answer id.
 */
export async function explainMistakes(attemptId: string): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => {
    const ctx = await assertAccess("student")
    await assertAttemptInScope(ctx, attemptId)
    if (!isUuid(attemptId)) throw new Error("Không tìm thấy bài.")
    const detail = await getAttemptDetail(attemptId)
    const view = detail && buildResultDetail(detail, new Date())
    if (!detail || !view || view.answersRevealed) return {}

    const items: HintItem[] = detail.answers
      // Without an answer key a hint would explain a placeholder.
      .filter((a) => a.isCorrect === false && !a.hint && needsHint(a.question))
      .map((a) => ({ id: a.id, question: a.question, response: a.response }))
    if (!items.length) return {}

    const { set } = detail.assignment
    const figures: ContentBlock[] = (
      await Promise.all(
        items.map((i) => (i.question.image ? storageFileBlocks(i.question.image.path, `Hình của câu id ${i.id}:`).catch(() => []) : [])),
      )
    ).flat()
    const result = await ask({
      system: HINTS_SYSTEM,
      content: [{ type: "text", text: hintsPrompt(items, set.subject, set.grade) }, ...figures],
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
