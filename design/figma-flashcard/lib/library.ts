import { PenLine, Sparkles, Upload, type LucideIcon } from 'lucide-react'
import type { ExerciseKind, ExerciseSet, ExerciseSetStatus, ExerciseSource, SubjectId } from './types'
import { SUBJECT_LIST } from './subjects'

export const EXERCISE_KINDS: Record<ExerciseKind, string> = {
  'de-thi': 'Đề thi',
  'chu-de': 'Bài học theo chủ đề',
  'luyen-tap': 'Luyện tập',
}

export const EXERCISE_SOURCES: Record<ExerciseSource, { label: string; icon: LucideIcon }> = {
  'thu-cong': { label: 'Thủ công', icon: PenLine },
  'tai-len': { label: 'Tải lên', icon: Upload },
  ai: { label: 'AI', icon: Sparkles },
}

export const EXERCISE_STATUSES: Record<ExerciseSetStatus, string> = {
  nhap: 'Nháp',
  'san-sang': 'Sẵn sàng',
}

export const GRADES = [3, 4, 5, 6, 7] as const

export const ALL = 'all'

export interface LibraryFilters {
  subject: SubjectId | typeof ALL
  grade: string
  kind: ExerciseKind | typeof ALL
  source: ExerciseSource | typeof ALL
  status: ExerciseSetStatus | typeof ALL
}

export const EMPTY_FILTERS: LibraryFilters = { subject: ALL, grade: ALL, kind: ALL, source: ALL, status: ALL }

export interface FilterDef {
  key: keyof LibraryFilters
  label: string
  options: { value: string; label: string }[]
}

const allOption = { value: ALL, label: 'Tất cả' }

export const FILTER_DEFS: FilterDef[] = [
  { key: 'subject', label: 'Môn', options: [allOption, ...SUBJECT_LIST.map((s) => ({ value: s.id, label: s.name }))] },
  { key: 'grade', label: 'Lớp', options: [allOption, ...GRADES.map((g) => ({ value: String(g), label: `Lớp ${g}` }))] },
  {
    key: 'kind',
    label: 'Loại',
    options: [allOption, ...Object.entries(EXERCISE_KINDS).map(([value, label]) => ({ value, label }))],
  },
  {
    key: 'source',
    label: 'Nguồn',
    options: [allOption, ...Object.entries(EXERCISE_SOURCES).map(([value, s]) => ({ value, label: s.label }))],
  },
  {
    key: 'status',
    label: 'Trạng thái',
    options: [allOption, ...Object.entries(EXERCISE_STATUSES).map(([value, label]) => ({ value, label }))],
  },
]

export function countActiveFilters(filters: LibraryFilters): number {
  return Object.values(filters).filter((v) => v !== ALL).length
}

/** Lowercase and strip Vietnamese diacritics so "bang nhan" matches "Bảng nhân". */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function filterExerciseSets(sets: ExerciseSet[], filters: LibraryFilters, query: string): ExerciseSet[] {
  const q = normalizeText(query.trim())
  return sets.filter((s) => {
    if (filters.subject !== ALL && s.subject !== filters.subject) return false
    if (filters.grade !== ALL && String(s.grade) !== filters.grade) return false
    if (filters.kind !== ALL && s.kind !== filters.kind) return false
    if (filters.source !== ALL && s.source !== filters.source) return false
    if (filters.status !== ALL && s.status !== filters.status) return false
    if (q && !normalizeText(`${s.title} ${s.topic} ${s.description}`).includes(q)) return false
    return true
  })
}
