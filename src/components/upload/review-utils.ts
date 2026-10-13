import type { Attachment, Question } from '@/lib/types'
import type { ScannedQuestion } from '@/lib/ai/scan'

export interface ReviewItem extends ScannedQuestion {
  /** Set once the parent edits, merges or confirms the question. */
  reviewed: boolean
  /** Figure being cut out and uploaded, or one that failed (the card offers a retry). */
  figureState?: 'cropping' | 'error'
}

/**
 * Review items after a scan of more pages: the new questions go after the
 * existing ones, unreviewed, with page numbers shifted past the `pageOffset`
 * pages scanned before (a scan numbers the files it was sent from 1).
 */
export function appendScanned(existing: ReviewItem[], scanned: ScannedQuestion[], pageOffset: number): ReviewItem[] {
  return [
    ...existing,
    ...scanned.map((s) => ({
      ...s,
      page: s.page + pageOffset,
      reviewed: false,
      ...(s.figure ? { figure: { ...s.figure, page: s.figure.page + pageOffset }, figureState: 'cropping' as const } : {}),
    })),
  ]
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

/** The page image to crop from: the picked file, else its (signed) preview URL. */
export function pageSource(page: SourcePage | undefined): Blob | string | undefined {
  return page?.file.file ?? page?.file.url
}
