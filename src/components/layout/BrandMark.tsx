import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BrandMark({ showName = true, className }: { showName?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
        <GraduationCap className="size-5" />
      </div>
      {showName && (
        <div className="min-w-0 leading-tight">
          <div className="truncate font-bold tracking-tight text-slate-900">Homework Hub</div>
          <div className="truncate text-xs text-slate-500">Học tập tại nhà</div>
        </div>
      )}
    </div>
  )
}
