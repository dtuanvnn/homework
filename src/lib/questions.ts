import {
  AlignLeft,
  ArrowDownUp,
  CircleCheckBig,
  Link2,
  ListChecks,
  MessageSquareText,
  TextCursorInput,
  type LucideIcon,
} from 'lucide-react'
import type { Question, QuestionType } from './types'

export interface QuestionTypeInfo {
  type: QuestionType
  label: string
  hint: string
  icon: LucideIcon
}

export const QUESTION_TYPES: Record<QuestionType, QuestionTypeInfo> = {
  'trac-nghiem': { type: 'trac-nghiem', label: 'Trắc nghiệm', hint: 'Chọn một đáp án đúng', icon: ListChecks },
  'dung-sai': { type: 'dung-sai', label: 'Đúng / Sai', hint: 'Nhận định đúng hay sai', icon: CircleCheckBig },
  'dien-cho-trong': { type: 'dien-cho-trong', label: 'Điền vào chỗ trống', hint: 'Điền từ còn thiếu vào câu', icon: TextCursorInput },
  'tra-loi-ngan': { type: 'tra-loi-ngan', label: 'Trả lời ngắn', hint: 'Một con số hoặc cụm từ', icon: MessageSquareText },
  noi: { type: 'noi', label: 'Nối', hint: 'Nối cột trái với cột phải', icon: Link2 },
  'sap-xep': { type: 'sap-xep', label: 'Sắp xếp', hint: 'Sắp xếp từ thành câu đúng', icon: ArrowDownUp },
  'tu-luan': { type: 'tu-luan', label: 'Tự luận', hint: 'Viết câu trả lời, phụ huynh chấm', icon: AlignLeft },
}

export const QUESTION_TYPE_LIST = Object.values(QUESTION_TYPES)

export const BLANK = '___'

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function countBlanks(prompt: string): number {
  return prompt.split(BLANK).length - 1
}

/** Reading passages, letters and dialogues: shown as body text instead of a big heading. */
export function isLongPrompt(prompt: string): boolean {
  return prompt.includes('\n') || prompt.length > 140
}

let idCounter = 0
export function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

/** Deterministic shuffle that never returns the original order (for 2+ items). */
export function shuffleIndexes(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (length > 1 && order.every((v, i) => v === i)) order.push(order.shift()!)
  return order
}

export function totalPoints(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + q.points, 0)
}
