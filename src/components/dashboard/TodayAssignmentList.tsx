import { CalendarDays, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import SectionHeader from '@/components/shared/SectionHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import SubjectIcon from '@/components/shared/SubjectIcon'
import { formatTime } from '@/lib/format'
import { SUBJECTS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { TodayItem } from '@/server/analytics'

interface TodayAssignmentListProps {
  studentName: string
  items: TodayItem[]
  onOpenSchedule: () => void
  className?: string
}

export default function TodayAssignmentList({ studentName, items, onOpenSchedule, className }: TodayAssignmentListProps) {
  const submitted = items.filter((a) => a.status === 'cho-cham' || a.status === 'da-cham').length

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <SectionHeader
        title={`Hôm nay của ${studentName}`}
        description={`${items.length} bài · ${submitted} đã nộp`}
        action={
          <Button variant="ghost" size="sm" className="h-11 text-indigo-700 hover:bg-indigo-50" onClick={onOpenSchedule}>
            <CalendarDays />
            Xem lịch
          </Button>
        }
      />
      <Card className="flex-1 gap-0 p-2">
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">Hôm nay không có bài nào. Một ngày nghỉ ngơi!</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((a) => {
              const subject = SUBJECTS[a.subject]
              return (
                <li key={a.id} className="flex min-h-16 items-center gap-3 px-3 py-3">
                  <SubjectIcon subject={a.subject} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 leading-snug font-semibold text-slate-900">{a.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('size-2 rounded-full', subject.bg)} aria-hidden />
                        {subject.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        Hạn {formatTime(a.dueDate)}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </section>
  )
}
