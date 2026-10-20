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
      ...(s.figure ? { figure: { ...s.figure, page: s.figure.page + pageOffset } } : {}),
      ...(s.groupFigure ? { groupFigure: { ...s.groupFigure, page: s.groupFigure.page + pageOffset } } : {}),
      ...(s.figure || s.groupFigure ? { figureState: 'cropping' as const } : {}),
    })),
  ]
}

/** Storage paths of every figure in a scan draft (câu and bài figures), each once. */
export function draftFigurePaths(items: ReviewItem[]): string[] {
  const paths = items.flatMap((it) => [it.question.group?.image?.path, it.question.image?.path]).filter((p): p is string => !!p)
  return [...new Set(paths)]
}

/** Puts freshly signed URLs on the câu and bài figures of a restored draft. */
export function withSignedFigures(items: ReviewItem[], urls: Record<string, string>): ReviewItem[] {
  return items.map((it) => {
    const q = it.question
    const groupUrl = q.group?.image && urls[q.group.image.path]
    const ownUrl = q.image && urls[q.image.path]
    if (!groupUrl && !ownUrl) return it
    return {
      ...it,
      question: { ...q, ...(ownUrl ? { imageUrl: ownUrl } : {}), ...(groupUrl && q.group ? { group: { ...q.group, imageUrl: groupUrl } } : {}) },
    }
  })
}

/** Bài operations work on questions (lib/question-groups-edit.ts); this puts the result back on the review items. */
export function withQuestions(items: ReviewItem[], questions: Question[]): ReviewItem[] {
  const byId = new Map(items.map((it) => [it.question.id, it]))
  const kept = new Set(questions.map((q) => q.id))
  // A new câu (a split passage merged back by "Bỏ bài") takes the details of the first câu it replaced.
  const replaced = items.find((it) => !kept.has(it.question.id))
  return questions.flatMap((q) => {
    const it = byId.get(q.id) ?? replaced
    if (!it) return []
    if (it.question === q) return [it]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a merged passage is a plain câu again
    const { placeholder: _placeholder, ...rest } = it
    return [{ ...(byId.has(q.id) ? it : rest), question: q }]
  })
}

/** "Đưa câu dưới vào bài": the standalone câu below a waiting passage joins it, and the stand-in goes. */
export function fillPlaceholder(items: ReviewItem[], placeholderId: string): ReviewItem[] {
  const i = items.findIndex((it) => it.question.id === placeholderId && it.placeholder)
  const next = items[i + 1]
  const group = items[i]?.question.group
  if (i < 0 || !group || !next || next.placeholder || next.question.group) return items
  const joined: ReviewItem = { ...next, reviewed: true, question: { ...next.question, group }, ...(items[i].groupFigure ? { groupFigure: items[i].groupFigure } : {}) }
  return [...items.slice(0, i), joined, ...items.slice(i + 2)]
}

/** "Xóa đoạn văn": a waiting passage goes, with every stand-in it has. */
export function deletePassage(items: ReviewItem[], groupId: string): ReviewItem[] {
  return items.filter((it) => !(it.placeholder && it.question.group?.id === groupId))
}

/** A passage the scan found without câu is still waiting for the parent. */
export const hasPlaceholder = (items: ReviewItem[]) => items.some((it) => it.placeholder)

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
