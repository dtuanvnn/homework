import { BookOpen, Calculator, Languages, type LucideIcon } from 'lucide-react'
import type { AssignmentStatus, SubjectId } from './types'

export interface SubjectStyle {
  id: SubjectId
  name: string
  icon: LucideIcon
  /** Hex used for Recharts series. */
  color: string
  text: string
  bg: string
  softBg: string
  border: string
  ring: string
}

export const SUBJECTS: Record<SubjectId, SubjectStyle> = {
  toan: {
    id: 'toan',
    name: 'Toán',
    icon: Calculator,
    color: '#3b82f6',
    text: 'text-blue-600',
    bg: 'bg-blue-500',
    softBg: 'bg-blue-50',
    border: 'border-blue-200',
    ring: 'ring-blue-500/20',
  },
  'tieng-viet': {
    id: 'tieng-viet',
    name: 'Tiếng Việt',
    icon: BookOpen,
    color: '#f97316',
    text: 'text-orange-600',
    bg: 'bg-orange-500',
    softBg: 'bg-orange-50',
    border: 'border-orange-200',
    ring: 'ring-orange-500/20',
  },
  'tieng-anh': {
    id: 'tieng-anh',
    name: 'Tiếng Anh',
    icon: Languages,
    color: '#22c55e',
    text: 'text-green-600',
    bg: 'bg-green-500',
    softBg: 'bg-green-50',
    border: 'border-green-200',
    ring: 'ring-green-500/20',
  },
}

export const SUBJECT_LIST = Object.values(SUBJECTS)

export interface StatusStyle {
  label: string
  badge: string
  dot: string
}

export const STATUSES: Record<AssignmentStatus, StatusStyle> = {
  'chua-lam': { label: 'Chưa làm', badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  'dang-lam': { label: 'Đang làm', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'cho-cham': { label: 'Chờ chấm', badge: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  'da-cham': { label: 'Đã chấm', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'tre-han': { label: 'Trễ hạn', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
}
