import { z } from "zod"
import { MAX_WORDS } from "@/lib/flashcard"

/*
 * Pure parts of "AI viết giải thích" in the flashcard builder: input
 * validation, the prompt, and checking the model's explanations. The Server
 * Action (src/server/actions/ai-flashcard.ts) only calls ask().
 */

export const MAX_EXPLANATION = 300

export const explainInputSchema = z.object({
  words: z.array(z.string().trim().min(1).max(60)).min(1, "Chưa có từ nào.").max(MAX_WORDS),
  topic: z.string().trim().max(200).default(""),
  grade: z.number().int().min(1).max(12),
  /** "Viết lại": the current explanation per word, which the new one must not repeat. */
  avoid: z.record(z.string(), z.string().max(MAX_EXPLANATION * 2)).optional(),
})

export type ExplainInput = z.input<typeof explainInputSchema>

export const explanationsSchema = z.object({
  items: z.array(
    z.object({
      word: z.string().describe("The word exactly as given"),
      definition: z.string().describe("One short English sentence explaining the word, without using the word itself"),
    }),
  ),
})

export type Explanations = z.infer<typeof explanationsSchema>

export const EXPLAIN_SYSTEM_PROMPT = `You write flashcard explanations of English words for a Vietnamese primary-school child who learns English with the Oxford Discovery textbooks. The child reads the explanation, listens to the word, and must write the word from memory.

Rules for every explanation:
- One sentence of at most 15 words, ending with a full stop.
- Simple words a Grade 2-4 English learner knows. No Vietnamese, no translations, no IPA, no example sentences with blanks.
- It must never contain the word itself or any form of it (plural, past tense, -ing, part of a compound). Describe the meaning so the child can guess the word.
- When a word has several meanings, use the one that fits the unit topic.
- Keep the order of the words and return one item per word, with the word exactly as given.`

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()

/** The user message for one request. */
export function buildExplainPrompt(input: z.output<typeof explainInputSchema>): string {
  const parts = [`Grade: ${input.grade}`]
  if (input.topic) parts.push(`Unit topic: ${oneLine(input.topic)}`)
  parts.push(`Words:\n${input.words.map((w, i) => `${i + 1}. ${oneLine(w)}`).join("\n")}`)
  const avoid = Object.entries(input.avoid ?? {}).filter(([, d]) => d.trim())
  if (avoid.length) {
    parts.push(
      `The parent asked for a new explanation. Write a clearly different one from the current explanation:\n${avoid.map(([w, d]) => `- ${oneLine(w)}: "${oneLine(d)}"`).join("\n")}`,
    )
  }
  parts.push("Return the items.")
  return parts.join("\n\n")
}

const STOP = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "and", "or", "for", "with"])

/** The part of a word that its forms share: "bees" → "bee", "butterfly" → "butterfl", "dance" → "danc". */
function stem(part: string): string {
  if (part.length < 4) return part
  if (/(ses|xes|ches|shes)$/.test(part)) return part.slice(0, -2)
  if (part.endsWith("ies")) return part.slice(0, -3)
  if (part.endsWith("s") && !part.endsWith("ss")) return part.slice(0, -1)
  if (part.length >= 5 && /[ey]$/.test(part)) return part.slice(0, -1)
  return part
}

/** The explanation gives the spelling away: it contains the word (or one of its parts) in some form. */
export function explanationLeaks(word: string, definition: string): boolean {
  const tokens = definition.toLowerCase().match(/[a-z]+/g) ?? []
  const parts = (word.toLowerCase().match(/[a-z]+/g) ?? []).filter((p, _, all) => p.length > 1 && (all.length === 1 || !STOP.has(p)))
  return parts.some((part) => {
    const s = stem(part)
    const short = new Set([part, s, `${s}s`, `${s}es`])
    return tokens.some((t) => (s.length >= 4 ? t.startsWith(s) : short.has(t)))
  })
}

/** Explanations keyed by the parent's words; missing, overlong or leaking ones are left out. */
export function mapExplanations(words: readonly string[], output: Explanations): Record<string, string> {
  const byWord = new Map(output.items.map((it) => [it.word.trim().toLowerCase(), it.definition]))
  const out: Record<string, string> = {}
  words.forEach((word, i) => {
    const raw = byWord.get(word.toLowerCase()) ?? (output.items.length === words.length ? output.items[i]?.definition : undefined)
    const definition = oneLine(raw ?? "")
    if (!definition || definition.length > MAX_EXPLANATION || explanationLeaks(word, definition)) return
    out[word] = definition
  })
  return out
}
