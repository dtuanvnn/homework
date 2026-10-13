import { Fragment, useMemo } from 'react'
import katex from 'katex'
import { splitRichText } from '@/lib/rich-text'

/**
 * Question text with $…$ formulas rendered by KaTeX. KaTeX's default
 * `trust: false` keeps untrusted LaTeX from producing links or raw HTML, so
 * its markup is safe to inject. A formula that fails to parse shows its source.
 */
function Formula({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: true, output: 'htmlAndMathml', strict: 'ignore' })
    } catch {
      return null
    }
  }, [tex])
  if (html === null) return <span className="text-slate-400">{`$${tex}$`}</span>
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitRichText(text), [text])
  return (
    <span className={className}>
      {segments.map((s, i) => (s.kind === 'text' ? <Fragment key={i}>{s.text}</Fragment> : <Formula key={i} tex={s.tex} />))}
    </span>
  )
}
