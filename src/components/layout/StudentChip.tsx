import { cn } from '@/lib/utils'
import type { AppMode, Student } from '@/lib/types'
import StarCount from './StarCount'

interface StudentChipProps {
  student: Student
  mode: AppMode
  collapsed?: boolean
}

export default function StudentChip({ student, mode, collapsed }: StudentChipProps) {
  const avatar = (
    <div
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-xl ring-2 ring-white"
      aria-hidden
    >
      {student.avatarEmoji}
    </div>
  )

  if (collapsed) return <div className="flex justify-center">{avatar}</div>

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-slate-50 p-3', mode === 'student' && 'bg-indigo-50')}>
      {avatar}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-semibold text-slate-900">{student.name}</div>
        <div className="text-xs text-slate-500">Lớp {student.className ?? student.grade}</div>
      </div>
      {mode === 'student' && <StarCount count={student.totalStars} className="px-2 text-xs" />}
    </div>
  )
}
