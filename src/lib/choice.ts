import type { MultipleChoiceQuestion } from "./types"

type ChoiceKey = Pick<MultipleChoiceQuestion, "correctIndex" | "correctIndexes">

/** Indexes of the correct options, ascending; several when the question has more than one right answer. */
export function correctOptions(q: ChoiceKey): number[] {
  return q.correctIndexes?.length ? [...q.correctIndexes].sort((a, b) => a - b) : [q.correctIndex]
}

/** The child picks every correct option (checkboxes) instead of one. */
export function isMultiAnswer(q: ChoiceKey): boolean {
  return (q.correctIndexes?.length ?? 0) > 1
}

/**
 * Answer-key fields for a set of correct options: `correctIndex` is always the
 * first one, `correctIndexes` only exists with two or more (explicitly
 * undefined otherwise, so spreading it over an old key clears it).
 */
export function choiceKey(indexes: number[]): ChoiceKey {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b)
  return sorted.length > 1 ? { correctIndex: sorted[0], correctIndexes: sorted } : { correctIndex: sorted[0] ?? 0, correctIndexes: undefined }
}

/** The child's picks as a sorted list: a number for single-answer questions, a list for multi-answer ones. */
export function chosenOptions(response: unknown): number[] {
  if (typeof response === "number") return [response]
  if (Array.isArray(response) && response.every((v) => typeof v === "number")) return [...new Set(response as number[])].sort((a, b) => a - b)
  return []
}
