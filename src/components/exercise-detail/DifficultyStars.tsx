import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Difficulty } from '@/lib/types'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Rất dễ',
  2: 'Dễ',
  3: 'Vừa',
  4: 'Khó',
  5: 'Rất khó',
}

interface DifficultyStarsProps {
  value: Difficulty
  onChange: (value: Difficulty) => void
  id?: string
}

export default function DifficultyStars({ value, onChange, id }: DifficultyStarsProps) {
  const levels: Difficulty[] = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center gap-2">
      <div
        id={id}
        role="radiogroup"
        aria-label="Độ khó"
        className="-ml-1.5 flex"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, value + 1) as Difficulty)
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, value - 1) as Difficulty)
        }}
      >
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            aria-label={`${level} sao – ${DIFFICULTY_LABELS[level]}`}
            tabIndex={value === level ? 0 : -1}
            onClick={() => onChange(level)}
            className="flex size-11 items-center justify-center rounded-xl outline-none hover:bg-amber-50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Star
              className={cn(
                'size-6 transition-colors',
                level <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-300',
              )}
            />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-slate-600">{DIFFICULTY_LABELS[value]}</span>
    </div>
  )
}
