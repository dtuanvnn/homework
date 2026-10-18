import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type UploadStepId = 'upload' | 'processing' | 'review'

const STEPS: { id: UploadStepId; label: string }[] = [
  { id: 'upload', label: 'Tải lên' },
  { id: 'processing', label: 'Quét AI' },
  { id: 'review', label: 'Kiểm tra' },
]

export default function UploadStepper({ current }: { current: UploadStepId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current)
  return (
    <ol className="flex items-center gap-2" aria-label="Các bước">
      {STEPS.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-emerald-500 text-white',
                active && 'bg-indigo-600 text-white ring-4 ring-indigo-100',
                !done && !active && 'bg-slate-100 text-slate-400',
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn('text-sm font-semibold whitespace-nowrap', active ? 'text-slate-900' : 'text-slate-400', done && 'text-slate-600')}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && <span className={cn('h-0.5 min-w-4 flex-1 rounded-full', done ? 'bg-emerald-300' : 'bg-slate-200')} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
