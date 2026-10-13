'use client'

import { cn } from '@/lib/utils'
import type { MathAnswerInputProps } from './MathAnswerInput'

/** Used when MathLive can't load (offline): "3/4" typed as text still grades by value. */
export default function PlainMathInput({ value, onChange, ariaLabel, size = 'large', tone }: MathAnswerInputProps) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      placeholder="VD: 3/4"
      className={cn(
        'rounded-2xl border-2 bg-white px-4 font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:ring-4',
        size === 'large' ? 'h-20 w-full text-3xl' : 'mx-1 inline-block h-14 w-28 text-center align-middle text-2xl',
        tone?.border,
        tone?.ring,
      )}
    />
  )
}
