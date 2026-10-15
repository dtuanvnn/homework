/**
 * Automatic grading. Pure functions, no I/O: the same code grades on submit
 * (server) and powers previews in the UI.
 *
 * Response shapes match what the take-assignment components store:
 * trac-nghiem → option index, dung-sai → boolean, dien-cho-trong → string per
 * blank, tra-loi-ngan → string, noi → { leftIndex: rightPairIndex },
 * sap-xep → token indexes in the chosen order, tu-luan → EssayValue.
 */
import type { Ink } from "./ink"
import { mathAnswerMatches } from "./math-answer"
import type { Question } from "./types"

export interface EssayValue {
  text: string
  /** Legacy: PNG data URL of the old handwriting canvas. Read, never written. */
  drawing?: string
  /** Handwriting as vector strokes on pages (lib/ink.ts). */
  ink?: Ink
}

export type Response = number | boolean | string | string[] | number[] | Record<string, number> | EssayValue

export interface QuestionGrade {
  /** null = the parent has to grade it. */
  isCorrect: boolean | null
  pointsAwarded: number | null
}

const WRONG: QuestionGrade = { isCorrect: false, pointsAwarded: 0 }
const NEEDS_PARENT: QuestionGrade = { isCorrect: null, pointsAwarded: null }

/** NFC, lower case, single spaces, no surrounding punctuation. Tone marks are kept: they matter in Vietnamese. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!?"'“”]+|[\s.,;:!?"'“”]+$/g, "")
}

const NUMBER = /\d+(?:[.,]\d+)?/g

function numbersIn(value: string): number[] {
  return (value.match(NUMBER) ?? []).map((n) => Number(n.replace(",", ".")))
}

function wordsIn(value: string): string[] {
  return normalizeText(value.replace(NUMBER, " ")).split(" ").filter(Boolean)
}

/**
 * Short answers with numbers ("24 kg") accept the same numbers with any subset
 * of the expected words, so "24" and "24kg" pass but "24 g" or "25 kg" don't.
 */
function shortAnswerMatches(expected: string, given: string): boolean {
  if (normalizeText(expected) === normalizeText(given)) return true
  const want = numbersIn(expected)
  if (!want.length) return false
  const got = numbersIn(given)
  if (got.length !== want.length || got.some((n, i) => n !== want[i])) return false
  const allowed = new Set(wordsIn(expected))
  return wordsIn(given).every((w) => allowed.has(w))
}

function proportional(points: number, correct: number, total: number): QuestionGrade {
  if (total === 0) return WRONG
  return { isCorrect: correct === total, pointsAwarded: Math.round(((points * correct) / total) * 100) / 100 }
}

const allOrNothing = (points: number, ok: boolean): QuestionGrade => (ok ? { isCorrect: true, pointsAwarded: points } : WRONG)

/** Math answers compare by value; a key that can't be evaluated falls back to `text`. */
function answerMatches(q: { math?: boolean; simplest?: boolean }, expected: string, given: string, text: (e: string, g: string) => boolean): boolean {
  if (!q.math) return text(expected, given)
  return mathAnswerMatches(expected, given, { simplest: q.simplest }) ?? text(expected, given)
}

const sameText = (expected: string, given: string) => normalizeText(given) === normalizeText(expected)

export function gradeQuestion(q: Question, response: Response | undefined | null): QuestionGrade {
  if (q.type === "tu-luan") return NEEDS_PARENT
  if (response === undefined || response === null) return WRONG
  // No answer key yet: the parent compares by hand.
  if (q.answerStatus === "missing") return typeof response === "string" && !response.trim() ? WRONG : NEEDS_PARENT

  switch (q.type) {
    case "trac-nghiem":
      return allOrNothing(q.points, response === q.correctIndex)
    case "dung-sai":
      return allOrNothing(q.points, response === q.answer)
    case "tra-loi-ngan":
      return typeof response === "string" && response.trim()
        ? allOrNothing(q.points, answerMatches(q, q.answer, response, shortAnswerMatches))
        : WRONG
    case "dien-cho-trong": {
      if (!Array.isArray(response)) return WRONG
      const given = response as string[]
      const correct = q.answers.filter((a, i) => typeof given[i] === "string" && given[i].trim() !== "" && answerMatches(q, a, given[i], sameText)).length
      return proportional(q.points, correct, q.answers.length)
    }
    case "noi": {
      if (typeof response !== "object" || Array.isArray(response)) return WRONG
      const map = response as Record<string, number>
      const correct = q.pairs.filter((_, i) => map[String(i)] === i).length
      return proportional(q.points, correct, q.pairs.length)
    }
    case "sap-xep": {
      if (!Array.isArray(response) || response.length !== q.tokens.length) return WRONG
      const sentence = (response as number[]).map((i) => q.tokens[i])
      return allOrNothing(q.points, sentence.every((t, i) => t === q.tokens[i]))
    }
  }
}

/** 10-point scale, rounded to the nearest quarter point. */
export function scoreOutOf10(awarded: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((awarded / total) * 10 * 4) / 4
}

export function starsFor(score: number): 0 | 1 | 2 | 3 {
  if (score >= 9) return 3
  if (score >= 7) return 2
  if (score >= 5) return 1
  return 0
}

export interface AttemptGrade {
  grades: (QuestionGrade & { questionId: string })[]
  /** Some answers wait for the parent, so there is no final score yet. */
  needsReview: boolean
  autoPoints: number
  totalPoints: number
  score: number | null
}

export function gradeAttempt(questions: Question[], responses: Record<string, Response | undefined>): AttemptGrade {
  const grades = questions.map((q) => ({ questionId: q.id, ...gradeQuestion(q, responses[q.id]) }))
  const needsReview = grades.some((g) => g.isCorrect === null)
  const autoPoints = grades.reduce((sum, g) => sum + (g.pointsAwarded ?? 0), 0)
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)
  return { grades, needsReview, autoPoints, totalPoints, score: needsReview ? null : scoreOutOf10(autoPoints, totalPoints) }
}
