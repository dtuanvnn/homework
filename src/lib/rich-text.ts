/*
 * Question text may contain LaTeX between $…$ (fractions, expressions).
 * `\$` is a literal dollar; an unclosed or empty `$` stays literal, so plain
 * text renders exactly as before. Rendering is components/question/RichText.
 */

export type RichSegment = { kind: "text"; text: string } | { kind: "math"; tex: string }

/** Index of the next unescaped "$" from `start`, or -1. */
function closingDollar(input: string, start: number): number {
  for (let j = start; j < input.length; j++) {
    if (input[j] === "\\") j++
    else if (input[j] === "$") return j
  }
  return -1
}

export function splitRichText(input: string): RichSegment[] {
  const out: RichSegment[] = []
  let text = ""
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (c === "\\" && input[i + 1] === "$") {
      text += "$"
      i += 2
      continue
    }
    if (c === "$") {
      const end = closingDollar(input, i + 1)
      if (end > i + 1) {
        if (text) out.push({ kind: "text", text })
        text = ""
        out.push({ kind: "math", tex: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
      if (end === i + 1) {
        text += "$$"
        i += 2
        continue
      }
    }
    text += c
    i++
  }
  if (text) out.push({ kind: "text", text })
  return out
}

export const hasMath = (input: string) => splitRichText(input).some((s) => s.kind === "math")

/** A LaTeX answer key as displayable rich text. */
export const mathText = (latex: string) => `$${latex}$`
