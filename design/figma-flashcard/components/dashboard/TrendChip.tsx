import { Triangle } from 'lucide-react'
import { formatDelta } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function TrendChip({ delta, className }: { delta: number; className?: string }) {
  const up = delta >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
        className,
      )}
    >
      <Triangle className={cn('size-2.5 fill-current', !up && 'rotate-180')} aria-hidden />
      {formatDelta(delta)}
      <span className="sr-only">{up ? 'tăng' : 'giảm'} so với tuần trước</span>
    </span>
  )
}
