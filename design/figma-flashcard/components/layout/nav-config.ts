import {
  BookOpenCheck,
  CalendarDays,
  ChartColumnBig,
  ClipboardCheck,
  LayoutDashboard,
  Library,
  Sun,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { AppMode } from '@/lib/types'
import { awaitingGradingCount, openAssignmentsCount } from '@/data/mock-data'

export type ParentTabId = 'dashboard' | 'library' | 'schedule' | 'grading' | 'reports'
export type StudentTabId = 'today' | 'assignments' | 'results'
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
  { id: 'grading', label: 'Chấm bài', icon: ClipboardCheck, description: 'Chấm điểm và nhận xét bài làm của con.', badge: awaitingGradingCount },
  { id: 'reports', label: 'Báo cáo', icon: ChartColumnBig, description: 'Theo dõi tiến bộ qua điểm số và biểu đồ.' },
]

export const STUDENT_NAV: NavItem[] = [
  { id: 'today', label: 'Hôm nay', icon: Sun, description: 'Những bài em cần làm hôm nay.' },
  { id: 'assignments', label: 'Bài của em', icon: BookOpenCheck, description: 'Tất cả bài tập bố mẹ đã giao cho em.', badge: openAssignmentsCount },
  { id: 'results', label: 'Kết quả', icon: Trophy, description: 'Điểm số, sao và huy hiệu em đã đạt được.' },
]

export const NAV_BY_MODE: Record<AppMode, NavItem[]> = {
  parent: PARENT_NAV,
  student: STUDENT_NAV,
}

export const MODE_LABELS: Record<AppMode, string> = {
  parent: 'Phụ huynh',
  student: 'Học sinh',
}
