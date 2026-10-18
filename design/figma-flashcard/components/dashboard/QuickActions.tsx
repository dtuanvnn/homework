import { ChartColumnBig, Plus, Send, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  primary?: boolean
  onClick: () => void
}

export function buildQuickActions(handlers: { onAdd: () => void; onAssign: () => void; onReport: () => void }): QuickAction[] {
  return [
    { id: 'add', label: 'Thêm bài tập', icon: Plus, primary: true, onClick: handlers.onAdd },
    { id: 'assign', label: 'Giao bài', icon: Send, onClick: handlers.onAssign },
    { id: 'report', label: 'Xem báo cáo', icon: ChartColumnBig, onClick: handlers.onReport },
  ]
}

export default function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section aria-label="Thao tác nhanh" className="grid grid-cols-3 gap-3 md:gap-4">
      {actions.map(({ id, label, icon: Icon, primary, onClick }) => (
        <button
          key={id}
          type="button"
          onClick={onClick}
          className={cn(
            'flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-sm font-semibold transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-14 md:flex-row md:gap-2.5',
            primary
              ? 'border-transparent bg-indigo-600 text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700'
              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700',
          )}
        >
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-xl',
              primary ? 'bg-white/15' : 'bg-slate-100 text-slate-600',
            )}
          >
            <Icon className="size-5" />
          </span>
          {label}
        </button>
      ))}
    </section>
  )
}
