import { AlertTriangle, ClipboardCheck, ClipboardList, Star } from 'lucide-react'
import { formatScoreValue } from '@/lib/format'
import type { WeekSummary } from '@/lib/stats'
import ProgressRing from './ProgressRing'
import StatCard from './StatCard'
import TrendChip from './TrendChip'

interface KpiGridProps {
  summary: WeekSummary
  average: number | null
  previousAverage: number | null
  overdueTitle?: string
  onOpenGrading: () => void
}

export default function KpiGrid({ summary, average, previousAverage, overdueTitle, onOpenGrading }: KpiGridProps) {
  const delta = average !== null && previousAverage !== null ? average - previousAverage : null

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard
        label="Bài tuần này"
        icon={ClipboardList}
        tone="indigo"
        value={summary.total}
        aside={<ProgressRing value={summary.done} max={summary.total} />}
        footer={`${summary.done} bài đã hoàn thành`}
      />
      <StatCard
        label="Chờ chấm"
        icon={ClipboardCheck}
        tone="violet"
        value={summary.awaitingGrading}
        onClick={onOpenGrading}
        ariaLabel={`${summary.awaitingGrading} bài chờ chấm, mở trang Chấm bài`}
        footer={<span className="font-semibold text-violet-700">Chấm ngay</span>}
      />
      <StatCard
        label="Điểm TB tuần"
        icon={Star}
        tone="emerald"
        value={
          average === null ? (
            '–'
          ) : (
            <>
              {formatScoreValue(Math.round(average * 10) / 10)}
              <span className="text-base font-semibold text-slate-400">/10</span>
            </>
          )
        }
        footer={
          delta !== null && (
            <span className="flex flex-wrap items-center gap-1.5">
              <TrendChip delta={delta} />
              <span>so với tuần trước</span>
            </span>
          )
        }
      />
      <StatCard
        label="Trễ hạn"
        icon={AlertTriangle}
        tone="red"
        value={summary.overdue}
        footer={overdueTitle ? <span className="line-clamp-1">{overdueTitle}</span> : 'Không có bài trễ hạn'}
      />
    </div>
  )
}
