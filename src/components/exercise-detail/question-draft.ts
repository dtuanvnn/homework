import { choiceKey, correctOptions } from '@/lib/choice'
import { evaluateMath } from '@/lib/math-answer'
import { editedQuestionSchema } from '@/lib/question-schema'
import { BLANK, countBlanks, shuffleIndexes } from '@/lib/questions'
import type { AnswerStatus, MatchingPair, Question, QuestionImage, QuestionType } from '@/lib/types'

const MATH_KEY_ISSUE = 'Đáp án dạng toán chưa đúng (VD: 3/4, 2\\frac{1}{3}, 0,75)'

/** Flat, form-friendly representation covering every question type. */
export interface QuestionDraft {
  type: QuestionType
  prompt: string
  points: number
  skills: string[]
  options: string[]
  /** Correct options; two or more make a pick-all question. Empty while there is no key. */
  correctIndexes: number[]
  tfAnswer: boolean
  blanks: string[]
  shortAnswer: string
  pairs: MatchingPair[]
  /** Correct sentence, parts separated by "/". */
  orderingText: string
  rubric: string
  math: boolean
  simplest: boolean
  image?: QuestionImage
  imageUrl?: string
  /** "missing": no key yet, the answer fields are left as they are; "ai"/"ai-check": key from AI. */
  answerStatus?: AnswerStatus
  solution: string
  solutionImage?: QuestionImage
  solutionImageUrl?: string
}

/** Fields that make up the answer key: changing one makes it the parent's own. */
const KEY_FIELDS = ['correctIndexes', 'tfAnswer', 'blanks', 'shortAnswer', 'pairs', 'orderingText', 'rubric'] as const

export function patchDraft(d: QuestionDraft, p: Partial<QuestionDraft>): QuestionDraft {
  const next = { ...d, ...p }
  if (d.answerStatus && KEY_FIELDS.some((k) => k in p && JSON.stringify(p[k]) !== JSON.stringify(d[k]))) delete next.answerStatus
  return next
}

const DEFAULT_PROMPTS: Partial<Record<QuestionType, string>> = {
  'dien-cho-trong': '',
  noi: 'Nối cột A với cột B cho đúng.',
  'sap-xep': 'Sắp xếp các từ sau thành câu đúng.',
}

export function emptyDraft(type: QuestionType): QuestionDraft {
  return {
    type,
    prompt: DEFAULT_PROMPTS[type] ?? '',
    points: type === 'tu-luan' ? 2 : 1,
    skills: [],
    options: ['', '', '', ''],
    correctIndexes: [],
    tfAnswer: true,
    blanks: [],
    shortAnswer: '',
    pairs: [
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
    ],
    orderingText: '',
    rubric: '',
    math: false,
    simplest: false,
    solution: '',
  }
}

export function toDraft(q: Question): QuestionDraft {
  const base = {
    ...emptyDraft(q.type),
    prompt: q.prompt,
    points: q.points,
    skills: [...q.skills],
    image: q.image,
    imageUrl: q.imageUrl,
    answerStatus: q.answerStatus,
    solution: q.solution ?? '',
    solutionImage: q.solutionImage,
    solutionImageUrl: q.solutionImageUrl,
  }
  switch (q.type) {
    case 'trac-nghiem':
      // No option chosen while the question has no key (correctIndex is a placeholder then).
      return { ...base, options: [...q.options], correctIndexes: q.answerStatus === 'missing' ? [] : correctOptions(q) }
    case 'dung-sai':
      return { ...base, tfAnswer: q.answer }
    case 'dien-cho-trong':
      return { ...base, blanks: [...q.answers], math: Boolean(q.math), simplest: Boolean(q.simplest) }
    case 'tra-loi-ngan':
      return { ...base, shortAnswer: q.answer, math: Boolean(q.math), simplest: Boolean(q.simplest) }
    case 'noi':
      return { ...base, pairs: q.pairs.map((p) => ({ ...p })) }
    case 'sap-xep':
      return { ...base, orderingText: q.tokens.join(' / ') }
    case 'tu-luan':
      return { ...base, rubric: q.rubric }
    case 'tu-vung':
      return { ...base, shortAnswer: q.word }
  }
}

/**
 * Switches an existing question to another type, keeping the prompt, points
 * and skills. A short answer becomes the grading hint when switching to an
 * essay (e.g. a scanned word problem the child should write out), and back.
 */
export function changeDraftType(d: QuestionDraft, type: QuestionType): QuestionDraft {
  if (type === d.type) return d
  const next = { ...d, type }
  if (type === 'tu-luan' && !d.rubric.trim() && d.shortAnswer.trim()) next.rubric = `Đáp số: ${d.shortAnswer.trim()}`
  if (type === 'tra-loi-ngan' && !d.shortAnswer.trim() && d.rubric.trim()) next.shortAnswer = d.rubric.trim().replace(/^Đáp số:\s*/i, '')
  return next
}

/** Points typed by the parent ("4", "2,5", "0.25"): quarter points from 0.25 to 100, else null. */
export function parsePoints(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  if (!text.trim() || !Number.isFinite(n)) return null
  const quarters = Math.round(n * 4) / 4
  return quarters >= 0.25 && quarters <= 100 ? quarters : null
}

export function orderingTokens(text: string): string[] {
  return text
    .split('/')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Returns a list of problems; empty means the draft can be saved. */
export function validateDraft(d: QuestionDraft): string[] {
  const issues: string[] = []
  if (!d.prompt.trim()) issues.push('Nhập nội dung câu hỏi')
  // Without a key only the content is checked: the parent grades by hand.
  const keyless = d.answerStatus === 'missing'
  switch (d.type) {
    case 'trac-nghiem': {
      const filled = d.options.filter((o) => o.trim())
      if (filled.length < 2) issues.push('Cần ít nhất 2 phương án')
      if (!keyless && (!d.correctIndexes.length || d.correctIndexes.some((i) => !d.options[i]?.trim()))) issues.push('Chọn đáp án đúng có nội dung')
      break
    }
    case 'dien-cho-trong': {
      const n = countBlanks(d.prompt)
      if (n === 0) issues.push(`Thêm ít nhất một chỗ trống (${BLANK})`)
      else if (keyless) break
      else if (d.blanks.slice(0, n).some((b) => !b?.trim())) issues.push('Nhập đáp án cho mọi chỗ trống')
      else if (d.math && d.blanks.slice(0, n).some((b) => !evaluateMath(b))) issues.push(MATH_KEY_ISSUE)
      break
    }
    case 'tra-loi-ngan':
      if (keyless) break
      if (!d.shortAnswer.trim()) issues.push('Nhập đáp án')
      else if (d.math && !evaluateMath(d.shortAnswer)) issues.push(MATH_KEY_ISSUE)
      break
    case 'noi':
      if (d.pairs.filter((p) => p.left.trim() && p.right.trim()).length < 2) issues.push('Cần ít nhất 2 cặp nối đầy đủ')
      break
    case 'sap-xep':
      if (orderingTokens(d.orderingText).length < 2) issues.push('Câu cần ít nhất 2 phần, ngăn cách bằng “/”')
      break
  }
  return issues
}

export function fromDraft(d: QuestionDraft, id: string, previous?: Question): Question {
  const solution = d.solution.trim()
  const base = {
    id,
    prompt: d.prompt.trim(),
    points: d.points,
    skills: d.skills,
    ...(d.image ? { image: d.image, imageUrl: d.imageUrl } : {}),
    ...(d.answerStatus ? { answerStatus: d.answerStatus } : {}),
    ...(solution ? { solution } : {}),
    ...(d.solutionImage ? { solutionImage: d.solutionImage, solutionImageUrl: d.solutionImageUrl } : {}),
  }
  const math = d.math ? { math: true as const, ...(d.simplest ? { simplest: true as const } : {}) } : {}
  switch (d.type) {
    case 'trac-nghiem': {
      // Drop empty options while keeping the correct answers pointing at the same text.
      const kept = d.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
      const correct = kept.flatMap((x, at) => (d.correctIndexes.includes(x.i) ? [at] : []))
      const { correctIndexes, ...key } = choiceKey(correct)
      return {
        ...base,
        type: 'trac-nghiem',
        options: kept.map((x) => x.o),
        ...key,
        ...(correctIndexes ? { correctIndexes } : {}),
      }
    }
    case 'dung-sai':
      return { ...base, type: 'dung-sai', answer: d.tfAnswer }
    case 'dien-cho-trong':
      return { ...base, type: 'dien-cho-trong', answers: Array.from({ length: countBlanks(d.prompt) }, (_, i) => (d.blanks[i] ?? '').trim()), ...math }
    case 'tra-loi-ngan':
      return { ...base, type: 'tra-loi-ngan', answer: d.shortAnswer.trim(), ...math }
    case 'noi':
      return {
        ...base,
        type: 'noi',
        pairs: d.pairs
          .filter((p) => p.left.trim() && p.right.trim())
          .map((p) => ({ left: p.left.trim(), right: p.right.trim(), picture: p.picture?.trim() || undefined })),
      }
    case 'sap-xep': {
      const tokens = orderingTokens(d.orderingText)
      const keepShuffle =
        previous?.type === 'sap-xep' && previous.tokens.join('/') === tokens.join('/') ? previous.shuffled : undefined
      return { ...base, type: 'sap-xep', tokens, shuffled: keepShuffle ?? shuffleIndexes(tokens.length) }
    }
    case 'tu-luan':
      return { ...base, type: 'tu-luan', rubric: d.rubric.trim() }
    case 'tu-vung':
      return { ...base, type: 'tu-vung', word: d.shortAnswer.trim() }
  }
}

/**
 * First question the server would reject (e.g. an unreviewed scan result),
 * with a readable hint taken from the editor's own checks when available.
 */
export function findInvalidQuestion(questions: Question[]): { index: number; hint: string } | null {
  const index = questions.findIndex((q) => !editedQuestionSchema.safeParse(q).success)
  if (index < 0) return null
  return { index, hint: validateDraft(toDraft(questions[index]))[0] ?? 'Kiểm tra lại nội dung và đáp án.' }
}
