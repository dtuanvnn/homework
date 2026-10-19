import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type StatTone = 'indigo' | 'violet' | 'emerald' | 'red'

const TONES: Record<StatTone, { icon: string; value: string; card?: string }> = {
  indigo: { icon: 'bg-indigo-50 text-indigo-600', value: 'text-slate-900' },
  violet: { icon: 'bg-violet-50 text-violet-600', value: 'text-violet-700' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900' },
  red: { icon: 'bg-red-50 text-red-600', value: 'text-red-600', card: 'border-red-100' },
}

interface StatCardProps {
  label: string
  icon: LucideIcon
  tone: StatTone
  value: React.ReactNode
  aside?: React.ReactNode
  footer?: React.ReactNode
  onClick?: () => void
  ariaLabel?: string
}

export default function StatCard({ label, icon: Icon, tone, value, aside, footer, onClick, ariaLabel }: StatCardProps) {
  const t = TONES[tone]
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', t.icon)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600">{label}</span>
        {onClick && <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className={cn('text-3xl leading-none font-bold tracking-tight tabular-nums', t.value)}>{value}</div>
        {aside}
      </div>
      {footer && <div className="min-h-5 text-xs text-slate-500">{footer}</div>}
    </>
  )

  const cardClass = cn('h-full gap-3 p-4 md:p-5', t.card)

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="group h-full rounded-2xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Card className={cn(cardClass, 'transition-all group-hover:-translate-y-0.5 group-hover:shadow-md')}>{content}</Card>
      </button>
    )
  }
  return <Card className={cardClass}>{content}</Card>
}
