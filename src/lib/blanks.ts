import { blankMatches, gradeQuestion } from "./grading"
import { BLANK } from "./questions"
import type { FillBlankQuestion } from "./types"

/*
 * Per-blank display: a passage cut at its "___", and right/wrong for each blank
 * of an unsplit fill-blank question. Used by the take box, result, grading and
 * print (components/question/BlankText).
 */

export type PassagePiece = { kind: "text"; text: string } | { kind: "blank"; index: number }

/** The text between blanks and the blanks (1-based) in order; empty text pieces are left out. */
export function passagePieces(prompt: string): PassagePiece[] {
  return prompt.split(BLANK).flatMap((text, i): PassagePiece[] => [
    ...(i > 0 ? [{ kind: "blank" as const, index: i }] : []),
    ...(text ? [{ kind: "text" as const, text }] : []),
  ])
}

export interface BlankMark {
  given: string
  /** Null: not coloured (no key for it, or the parent graded the câu by hand). */
  correct: boolean | null
  /** The key, only on a wrong blank and only when the caller may show keys. */
  answer?: string
}

type Stored = { isCorrect: boolean | null; pointsAwarded: number | null }

/** The parent changed the câu's grade: it no longer is what the auto grading gives. */
function handGraded(q: FillBlankQuestion, response: unknown, stored: Stored | null): boolean {
  if (!stored) return false
  const auto = gradeQuestion(q, response as string[])
  return auto.isCorrect !== stored.isCorrect || Math.abs((auto.pointsAwarded ?? 0) - (stored.pointsAwarded ?? 0)) > 1e-9
}

export function blankMarks(q: FillBlankQuestion, response: unknown, stored: Stored | null, showKeys: boolean): BlankMark[] {
  const given = Array.isArray(response) ? response : []
  const neutral = q.answerStatus === "missing" || handGraded(q, response, stored)
  return q.answers.map((key, i) => {
    const text = typeof given[i] === "string" ? (given[i] as string).trim() : ""
    if (neutral || !key.trim()) return { given: text, correct: null }
    const correct = blankMatches(q, i, text)
    return { given: text, correct, ...(!correct && showKeys ? { answer: key } : {}) }
  })
}

/** "k/N ô đúng", only when every blank is coloured. */
export function blankCount(marks: BlankMark[]): { right: number; total: number } | null {
  if (marks.some((m) => m.correct === null)) return null
  return { right: marks.filter((m) => m.correct).length, total: marks.length }
}
