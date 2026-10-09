import type { Attachment, Question } from '@/lib/types'
import type { ScannedQuestion } from '@/data/scan-mock'

export interface ReviewItem extends ScannedQuestion {
  /** Set once the parent edits, merges or confirms the question. */
  reviewed: boolean
}

export const LOW_CONFIDENCE = 0.75
export const HIGH_CONFIDENCE = 0.85

export function needsCheck(item: ReviewItem): boolean {
  return !item.reviewed && item.confidence < LOW_CONFIDENCE
}

export function hasAnswer(q: Question): boolean {
  switch (q.type) {
    case 'dien-cho-trong':
      return q.answers.length > 0 && q.answers.every((a) => a.trim())
    case 'tra-loi-ngan':
      return q.answer.trim() !== ''
    case 'noi':
      return q.pairs.length > 0
    case 'sap-xep':
      return q.tokens.length > 1
    default:
      return true
  }
}

/**
 * Merges `lower` into `upper` (the scanner often splits one question across lines).
 * The answer/type comes from whichever part actually has an answer, preferring the lower part.
 */
export function mergeQuestions(upper: Question, lower: Question): Question {
  const source = hasAnswer(lower) || !hasAnswer(upper) ? lower : upper
  return {
    ...source,
    id: upper.id,
    prompt: `${upper.prompt.trim()} ${lower.prompt.trim()}`,
    points: Math.max(upper.points, lower.points),
    skills: [...new Set([...upper.skills, ...lower.skills])],
  } as Question
}

export interface SourcePage {
  /** 1-based index across all files. */
  index: number
  file: Attachment
  /** Page within the file. */
  pageInFile: number
}

export function pagesFromFiles(files: Attachment[]): SourcePage[] {
  const pages: SourcePage[] = []
  files.forEach((file) => {
    const count = file.kind === 'pdf' ? (file.pages ?? 1) : 1
    for (let p = 1; p <= count; p++) pages.push({ index: pages.length + 1, file, pageInFile: p })
  })
  return pages
}
