/*
 * Inline emphasis and $…$ formulas, without interpreting arbitrary HTML.
 * Empty/unclosed markers stay literal. Rendering is components/question/RichText.
 */

export interface RichStyle {
  bold?: boolean
  underline?: boolean
  highlight?: boolean
}

export type InlineFormat = keyof RichStyle
export type RichSegment = ({ kind: "text"; text: string } | { kind: "math"; tex: string }) & RichStyle
export interface FormatRange {
  format: InlineFormat
  start: number
  contentStart: number
  contentEnd: number
  end: number
}

export const TEXT_FORMATS = {
  bold: { open: "**", close: "**" },
  underline: { open: "<u>", close: "</u>" },
  highlight: { open: "==", close: "==" },
} as const

function append(segments: RichSegment[], segment: RichSegment) {
  const last = segments.at(-1)
  if (
    segment.kind === "text" && last?.kind === "text" &&
    last.bold === segment.bold && last.underline === segment.underline && last.highlight === segment.highlight
  ) last.text += segment.text
  else segments.push(segment)
}

/** Index of the next unescaped "$" from `start`, or -1. */
function closingDollar(input: string, start: number): number {
  for (let j = start; j < input.length; j++) {
    if (input[j] === "\\") j++
    else if (input[j] === "$") return j
  }
  return -1
}

export function mathRanges(input: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "\\") i++
    else if (input[i] === "$") {
      const end = closingDollar(input, i + 1)
      if (end > i + 1) ranges.push({ start: i, end: end + 1 })
      if (end >= 0) i = end
    }
  }
  return ranges
}

function parseRichText(input: string): { segments: RichSegment[]; ranges: FormatRange[] } {
  const ranges: FormatRange[] = []
  const frames: { format?: InlineFormat; marker: string; start: number; segments: RichSegment[] }[] = [{ marker: "", start: 0, segments: [] }]
  const tokens = (Object.entries(TEXT_FORMATS) as [InlineFormat, { open: string; close: string }][]).flatMap(([format, marks]) =>
    marks.open === marks.close
      ? [{ format, token: marks.open, closing: false }]
      : [{ format, token: marks.open, closing: false }, { format, token: marks.close, closing: true }],
  )
  let i = 0
  while (i < input.length) {
    const frame = frames.at(-1)!
    const text = (value: string) => append(frame.segments, { kind: "text", text: value })
    const c = input[i]
    if (c === "\\") {
      const escaped = tokens.find(({ token }) => input.startsWith(token, i + 1))?.token
      if (escaped || input[i + 1] === "$") {
        text(escaped ?? "$")
        i += 1 + (escaped?.length ?? 1)
        continue
      }
    }
    if (c === "$") {
      const end = closingDollar(input, i + 1)
      if (end > i + 1) {
        append(frame.segments, { kind: "math", tex: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
      if (end === i + 1) {
        text("$$")
        i += 2
        continue
      }
    }
    const mark = tokens.find(({ token }) => input.startsWith(token, i))
    if (mark) {
      if (frame.format === mark.format && mark.token === TEXT_FORMATS[mark.format].close) {
        frames.pop()
        const parent = frames.at(-1)!
        if (!frame.segments.length) append(parent.segments, { kind: "text", text: frame.marker + mark.token })
        else {
          ranges.push({ format: mark.format, start: frame.start, contentStart: frame.start + frame.marker.length, contentEnd: i, end: i + mark.token.length })
          for (const segment of frame.segments) append(parent.segments, { ...segment, [mark.format]: true })
        }
      } else if (mark.closing) text(mark.token)
      else frames.push({ format: mark.format, marker: mark.token, start: i, segments: [] })
      i += mark.token.length
      continue
    }
    text(c)
    i++
  }
  while (frames.length > 1) {
    const frame = frames.pop()!
    const parent = frames.at(-1)!
    append(parent.segments, { kind: "text", text: frame.marker })
    for (const segment of frame.segments) append(parent.segments, segment)
  }
  return { segments: frames[0].segments, ranges }
}

export const splitRichText = (input: string): RichSegment[] => parseRichText(input).segments
export const formattingRanges = (input: string): FormatRange[] => parseRichText(input).ranges.sort((a, b) => a.start - b.start)

export const hasMath = (input: string) => splitRichText(input).some((s) => s.kind === "math")
export const hasFormatting = (input: string) => splitRichText(input).some((s) => s.bold || s.underline || s.highlight)
export const plainRichText = (input: string) => splitRichText(input).map((s) => s.kind === "text" ? s.text : `$${s.tex}$`).join("")

/** A LaTeX answer key as displayable rich text. */
export const mathText = (latex: string) => `$${latex}$`

/**
 * One answer (a single blank, or a short answer) of a question for display:
 * math questions store and receive LaTeX without $, so it is wrapped for
 * RichText; anything else is returned unchanged.
 */
export const answerAsRichText = (q: { math?: boolean }, answer: string) => (q.math ? mathText(answer) : answer)
