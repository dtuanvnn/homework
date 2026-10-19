"use server"

import { runAction, type ActionResult } from "@/lib/action-result"
import { buildExplainPrompt, EXPLAIN_SYSTEM_PROMPT, explainInputSchema, explanationsSchema, mapExplanations, type ExplainInput } from "@/lib/ai/flashcard"
import { assertAccess } from "../access"
import { ask } from "../ai/llm"

/**
 * "AI viết giải thích" / "Viết lại" in the flashcard builder: one short English
 * explanation per word, keyed by word. Nothing is saved; the parent reviews
 * the explanations before saving the set.
 */
export async function explainWords(input: ExplainInput): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => {
    await assertAccess("parent")
    const parsed = explainInputSchema.parse(input)
    const output = await ask({
      system: EXPLAIN_SYSTEM_PROMPT,
      content: [{ type: "text", text: buildExplainPrompt(parsed) }],
      schema: explanationsSchema,
      effort: "low",
      maxTokens: 8000,
    })
    const explanations = mapExplanations(parsed.words, output)
    if (!Object.keys(explanations).length) throw new Error("AI chưa viết được giải thích nào. Vui lòng thử lại.")
    return explanations
  })
}
