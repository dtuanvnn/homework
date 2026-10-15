import {
  BookOpenCheck,
  CalendarDays,
  ChartColumnBig,
  ClipboardCheck,
  Gift,
  LayoutDashboard,
  Library,
  Sun,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { AppMode } from '@/lib/types'

export type ParentTabId = 'dashboard' | 'library' | 'schedule' | 'grading' | 'reports'
export type StudentTabId = 'today' | 'assignments' | 'results' | 'rewards'
export type TabId = ParentTabId | StudentTabId

export interface NavItem {
  id: TabId
  label: string
  /** Short label for the phone tab bar. */
  shortLabel?: string
  icon: LucideIcon
  description: string
  badge?: number
}

export const PARENT_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, description: 'Tình hình học tập của con trong tuần này.' },
  { id: 'library', label: 'Kho bài tập', icon: Library, description: 'Quản lý các bộ bài tập theo môn và chủ đề.' },
  { id: 'schedule', label: 'Lịch giao bài', shortLabel: 'Lịch giao', icon: CalendarDays, description: 'Lên lịch và giao bài tập theo ngày.' },
  { id: 'grading', label: 'Chấm bài', icon: ClipboardCheck, description: 'Chấm điểm và nhận xét bài làm của con.' },
  { id: 'reports', label: 'Báo cáo', icon: ChartColumnBig, description: 'Theo dõi tiến bộ qua điểm số và biểu đồ.' },
]

export const STUDENT_NAV: NavItem[] = [
  { id: 'today', label: 'Hôm nay', icon: Sun, description: 'Những bài em cần làm hôm nay.' },
  { id: 'assignments', label: 'Bài của em', icon: BookOpenCheck, description: 'Tất cả bài tập bố mẹ đã giao cho em.' },
  { id: 'results', label: 'Kết quả', icon: Trophy, description: 'Điểm số và sao em đã đạt được.' },
  { id: 'rewards', label: 'Phần thưởng', shortLabel: 'Thưởng', icon: Gift, description: 'Đổi sao lấy quà, xem chuỗi ngày và huy hiệu.' },
]

export interface NavCounts {
  awaitingGrading: number
  openAssignments: number
  pendingRedemptions: number
}

/** Navigation for a mode, with live badge counts. */
export function navFor(mode: AppMode, counts: NavCounts): NavItem[] {
  if (mode === 'student')
    return STUDENT_NAV.map((i) => (i.id === 'assignments' ? { ...i, badge: counts.openAssignments || undefined } : i))
  return PARENT_NAV.map((i) =>
    i.id === 'grading' ? { ...i, badge: counts.awaitingGrading || undefined } : i.id === 'dashboard' ? { ...i, badge: counts.pendingRedemptions || undefined } : i,
  )
}

export const MODE_LABELS: Record<AppMode, string> = {
  parent: 'Phụ huynh',
  student: 'Học sinh',
}
