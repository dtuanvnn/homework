import { editedQuestionSchema } from '@/lib/question-schema'
import { BLANK, countBlanks, shuffleIndexes } from '@/lib/questions'
import type { MatchingPair, Question, QuestionType } from '@/lib/types'

/** Flat, form-friendly representation covering every question type. */
export interface QuestionDraft {
  type: QuestionType
  prompt: string
  points: number
  skills: string[]
  options: string[]
  correctIndex: number
  tfAnswer: boolean
  blanks: string[]
  shortAnswer: string
  pairs: MatchingPair[]
  /** Correct sentence, parts separated by "/". */
  orderingText: string
  rubric: string
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
    correctIndex: 0,
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
  }
}

export function toDraft(q: Question): QuestionDraft {
  const base = { ...emptyDraft(q.type), prompt: q.prompt, points: q.points, skills: [...q.skills] }
  switch (q.type) {
    case 'trac-nghiem':
      return { ...base, options: [...q.options], correctIndex: q.correctIndex }
    case 'dung-sai':
      return { ...base, tfAnswer: q.answer }
    case 'dien-cho-trong':
      return { ...base, blanks: [...q.answers] }
    case 'tra-loi-ngan':
      return { ...base, shortAnswer: q.answer }
    case 'noi':
      return { ...base, pairs: q.pairs.map((p) => ({ ...p })) }
    case 'sap-xep':
      return { ...base, orderingText: q.tokens.join(' / ') }
    case 'tu-luan':
      return { ...base, rubric: q.rubric }
  }
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
  switch (d.type) {
    case 'trac-nghiem': {
      const filled = d.options.filter((o) => o.trim())
      if (filled.length < 2) issues.push('Cần ít nhất 2 phương án')
      if (!d.options[d.correctIndex]?.trim()) issues.push('Chọn đáp án đúng có nội dung')
      break
    }
    case 'dien-cho-trong': {
      const n = countBlanks(d.prompt)
      if (n === 0) issues.push(`Thêm ít nhất một chỗ trống (${BLANK})`)
      else if (d.blanks.slice(0, n).some((b) => !b?.trim())) issues.push('Nhập đáp án cho mọi chỗ trống')
      break
    }
    case 'tra-loi-ngan':
      if (!d.shortAnswer.trim()) issues.push('Nhập đáp án')
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
  const base = { id, prompt: d.prompt.trim(), points: d.points, skills: d.skills }
  switch (d.type) {
    case 'trac-nghiem': {
      // Drop empty options while keeping the correct answer pointing at the same text.
      const kept = d.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
      return {
        ...base,
        type: 'trac-nghiem',
        options: kept.map((x) => x.o),
        correctIndex: Math.max(0, kept.findIndex((x) => x.i === d.correctIndex)),
      }
    }
    case 'dung-sai':
      return { ...base, type: 'dung-sai', answer: d.tfAnswer }
    case 'dien-cho-trong':
      return { ...base, type: 'dien-cho-trong', answers: d.blanks.slice(0, countBlanks(d.prompt)).map((b) => b.trim()) }
    case 'tra-loi-ngan':
      return { ...base, type: 'tra-loi-ngan', answer: d.shortAnswer.trim() }
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
