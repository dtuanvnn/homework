import { useMemo, type ReactNode } from 'react'
import katex from 'katex'
import { splitRichText, type RichStyle } from '@/lib/rich-text'

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

export function TextEmphasis({ children, bold, underline, highlight }: RichStyle & { children: ReactNode }) {
  let content = children
  if (bold) content = <strong>{content}</strong>
  if (underline) content = <u className="underline underline-offset-2">{content}</u>
  if (highlight) content = <mark className="bg-yellow-200 text-inherit print:[print-color-adjust:exact]">{content}</mark>
  return content
}

export function RichTextRun({ text, math, ...style }: RichStyle & { text: string; math?: boolean }) {
  return <TextEmphasis {...style}>{math ? <Formula tex={text} /> : text}</TextEmphasis>
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitRichText(text), [text])
  return (
    <span className={className}>
      {segments.map((s, i) => <RichTextRun key={i} text={s.kind === 'text' ? s.text : s.tex} math={s.kind === 'math'} bold={s.bold} underline={s.underline} highlight={s.highlight} />)}
    </span>
  )
}
