"use server"

import { randomUUID } from "node:crypto"
import { runAction, type ActionResult } from "@/lib/action-result"
import {
  buildGeneratePrompt,
  GENERATE_SYSTEM_PROMPT,
  generatedSetSchema,
  generateInputSchema,
  mapGeneratedSet,
  type GenerateInput,
  type GenerateResult,
} from "@/lib/ai/generate"
import { assertAccess } from "../access"
import { ask } from "../ai/llm"
import { getQuestions, listExerciseSets } from "../queries"

/**
 * Generates a new exercise set with Claude. Reference questions are loaded
 * here from the database (never taken from the client). Nothing is saved:
 * the client previews the result and saves it as a draft via library.addSet().
 */
export async function generateSet(input: GenerateInput): Promise<ActionResult<GenerateResult>> {
  return runAction(async () => {
    await assertAccess()
    const parsed = generateInputSchema.parse(input)
    const ids = new Set(parsed.referenceSetIds)
    const sets = ids.size ? (await listExerciseSets()).filter((s) => ids.has(s.id)) : []
    const references = await Promise.all(sets.map(async (s) => ({ title: s.title, questions: await getQuestions(s.id) })))
    const output = await ask({
      system: GENERATE_SYSTEM_PROMPT,
      content: [{ type: "text", text: buildGeneratePrompt(parsed, references) }],
      schema: generatedSetSchema,
      effort: "high",
    })
    const result = mapGeneratedSet(output, parsed, randomUUID)
    if (!result.items.length) throw new Error("AI chưa tạo được câu hỏi hợp lệ nào. Vui lòng thử lại.")
    return result
  })
}
