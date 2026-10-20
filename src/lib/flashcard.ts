import type { ExerciseFormat, QuestionContent, SubjectId } from "./types"

/*
 * Vocabulary flashcard sets ("Từ vựng – Flashcard"): one `tu-vung` question per
 * word, studied on flip cards and written by hand. Pure helpers shared by the
 * builder, the server checks and the take/grading/result screens.
 */

export const MAX_WORDS = 40
export const MAX_WORD_LENGTH = 60

const WORD = /^[A-Za-z][A-Za-z' -]*$/

/** Letters, spaces, hyphens and apostrophes ("polar bear", "o'clock"), at most 60 characters. */
export function isValidWord(word: string): boolean {
  const w = word.trim()
  return w.length > 0 && w.length <= MAX_WORD_LENGTH && WORD.test(w)
}

export interface ParsedWordList {
  words: string[]
  /** Repeats dropped (case-insensitive). */
  duplicateCount: number
  /** Words beyond MAX_WORDS that were left out. */
  overflow: number
}

/** One word per line; "a / b / c" on one line also works. Trims, drops blanks and repeats, caps at MAX_WORDS. */
export function parseWordList(text: string, existing: readonly string[] = []): ParsedWordList {
  const seen = new Set(existing.map((w) => w.toLowerCase()))
  const words: string[] = []
  let duplicateCount = 0
  let overflow = 0
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split("/")) {
      const word = part.trim().replace(/\s+/g, " ")
      if (!word) continue
      const key = word.toLowerCase()
      if (seen.has(key)) {
        duplicateCount++
        continue
      }
      seen.add(key)
      if (existing.length + words.length >= MAX_WORDS) overflow++
      else words.push(word)
    }
  }
  return { words, duplicateCount, overflow }
}

/** Every question is a word: the set is studied and taken as flashcards. */
export function isFlashcardSet(questions: readonly { type: string }[]): boolean {
  return questions.length > 0 && questions.every((q) => q.type === "tu-vung")
}

export function vocabQuestion(word: string, prompt: string): QuestionContent {
  return { type: "tu-vung", word: word.trim(), prompt: prompt.trim(), points: 1, skills: [] }
}

/** Why a set's questions don't fit its format (Vietnamese), or null when they do. */
export function checkSetFormat(set: { format: ExerciseFormat; subject: SubjectId }, questions: readonly { type: string; group?: unknown }[]): string | null {
  const words = questions.filter((q) => q.type === "tu-vung").length
  if (set.format === "cau-hoi") return words ? "Từ vựng chỉ dùng trong bộ Flashcard." : null
  if (set.subject !== "tieng-anh") return "Bộ Flashcard là môn Tiếng Anh."
  if (words !== questions.length) return "Bộ Flashcard chỉ gồm từ vựng."
  if (questions.some((q) => q.group)) return "Bộ Flashcard không chia bài."
  if (words > MAX_WORDS) return `Bộ Flashcard có tối đa ${MAX_WORDS} từ.`
  return null
}
