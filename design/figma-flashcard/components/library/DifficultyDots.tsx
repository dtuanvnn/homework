import { cn } from '@/lib/utils'
import type { Difficulty } from '@/lib/types'

export default function DifficultyDots({ level, colorClass }: { level: Difficulty; colorClass: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`Độ khó ${level}/5`} title={`Độ khó ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn('size-2 rounded-full', i <= level ? colorClass : 'bg-slate-200')} />
      ))}
    </span>
  )
}
