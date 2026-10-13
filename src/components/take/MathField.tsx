'use client'

import { useEffect, useRef } from 'react'
import { MathfieldElement } from 'mathlive'
import { cn } from '@/lib/utils'
import type { MathAnswerInputProps } from './MathAnswerInput'

// Global MathLive setup, once per page: local fonts, no sounds, a primary-school keyboard.
MathfieldElement.fontsDirectory = '/mathlive/fonts'
MathfieldElement.soundsDirectory = null
window.mathVirtualKeyboard.layouts = [
  {
    label: '123',
    rows: [
      ['7', '8', '9', { latex: '\\div', label: '÷' }, '[backspace]'],
      ['4', '5', '6', { latex: '\\times', label: '×' }, { latex: '\\frac{#@}{#?}', label: 'phân số' }],
      ['1', '2', '3', '-', { latex: '#?\\frac{#?}{#?}', label: 'hỗn số' }],
      ['0', { latex: '{,}', label: ',' }, '(', ')', '+'],
      ['[left]', '[right]', '[hide-keyboard]'],
    ],
  },
]

export default function MathField({ value, onChange, ariaLabel, size = 'large', tone }: MathAnswerInputProps) {
  const ref = useRef<MathfieldElement>(null)
  const latest = useRef(onChange)

  useEffect(() => {
    latest.current = onChange
  })

  useEffect(() => {
    const mf = ref.current
    if (!mf) return
    mf.mathVirtualKeyboardPolicy = 'auto'
    mf.menuItems = []
    const onInput = () => latest.current(mf.value)
    mf.addEventListener('input', onInput)
    return () => mf.removeEventListener('input', onInput)
  }, [])

  useEffect(() => {
    const mf = ref.current
    if (mf && mf.value !== value) mf.value = value
  }, [value])

  return (
    <math-field
      ref={ref}
      aria-label={ariaLabel}
      className={cn(
        'rounded-2xl border-2 bg-white px-4 text-slate-900 outline-none focus-within:ring-4',
        size === 'large' ? 'block min-h-20 w-full py-4 text-3xl' : 'mx-1 inline-block min-h-14 min-w-28 py-2 align-middle text-2xl',
        tone?.border,
        tone?.ring,
      )}
    />
  )
}
