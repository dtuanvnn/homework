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
// `loading` gets no props, so each size has its own dynamic component (the import stays inline: next/dynamic's
// ssr:false transform needs it there). Spans, because inline inputs sit inside FillBlank's <p>.
const placeholder = 'animate-pulse rounded-2xl border-2 border-slate-200 bg-slate-50'
const LargeMathField = dynamic(() => import('./MathField').catch(() => import('./PlainMathInput')), {
  ssr: false,
  loading: () => <span className={`block h-20 w-full ${placeholder}`} />,
})
const InlineMathField = dynamic(() => import('./MathField').catch(() => import('./PlainMathInput')), {
  ssr: false,
  loading: () => <span className={`mx-1 inline-block h-14 w-28 align-middle ${placeholder}`} />,
})

/** Loads the MathLive chunk without showing anything, so the service worker has it for offline work. */
export const MathFieldPreload = dynamic(() => import('./MathField').then(() => () => null), { ssr: false })

export default function MathAnswerInput(props: MathAnswerInputProps) {
  return props.size === 'inline' ? <InlineMathField {...props} /> : <LargeMathField {...props} />
}
