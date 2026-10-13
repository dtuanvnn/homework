'use client'

import dynamic from 'next/dynamic'

export interface MathAnswerInputProps {
  value: string
  onChange: (latex: string) => void
  ariaLabel: string
  size?: 'large' | 'inline'
  tone?: { border?: string; ring?: string }
}

// MathLive is ~1 MB: load it only where a math answer is needed, and fall back to a text box if it fails.
const MathField = dynamic(() => import('./MathField').catch(() => import('./PlainMathInput')), {
  ssr: false,
  loading: () => <div className="h-20 w-full animate-pulse rounded-2xl border-2 border-slate-200 bg-slate-50" />,
})

export default function MathAnswerInput(props: MathAnswerInputProps) {
  return <MathField {...props} />
}
