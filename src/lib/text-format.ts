import { formattingRanges, mathRanges, TEXT_FORMATS, type InlineFormat } from "./rich-text"

interface Range { start: number; end: number }

function withoutRanges(text: string, ranges: Range[]): string {
  let cursor = 0
  let result = ""
  for (const range of ranges) {
    result += text.slice(cursor, range.start)
    cursor = range.end
  }
  return result + text.slice(cursor)
}

export function formatSelection(text: string, start: number, end: number, format: InlineFormat): { text: string; start: number; end: number } {
  const { open, close } = TEXT_FORMATS[format]
  for (const range of mathRanges(text)) {
    if ((start < range.end && end > range.start) || (start === end && start > range.start && start < range.end)) {
      start = Math.min(start, range.start)
      end = Math.max(end, range.end)
    }
  }
  const ranges = formattingRanges(text)
  const markers = ranges.flatMap((r) => [{ start: r.start, end: r.contentStart }, { start: r.contentEnd, end: r.end }]).sort((a, b) => a.start - b.start)
  const targets = ranges.filter((r) => r.format === format && r.end > start && r.start < end)
  const invisible = (from: number, to: number) => !withoutRanges(text.slice(from, to), markers
    .filter((r) => r.end > from && r.start < to)
    .map((r) => ({ start: Math.max(from, r.start) - from, end: Math.min(to, r.end) - from }))).trim()
  let covered = start
  let active = targets.length > 0
  for (const range of targets) {
    if (range.start > covered && !invisible(covered, Math.min(end, range.start))) active = false
    covered = Math.max(covered, range.end)
  }
  if (covered < end && !invisible(covered, end)) active = false
  if (active) {
    const remove = targets.flatMap((r) => [{ start: r.start, end: r.contentStart }, { start: r.contentEnd, end: r.end }]).sort((a, b) => a.start - b.start)
    const removedBefore = (position: number) => remove.reduce((n, r) => n + Math.max(0, Math.min(position, r.end) - r.start), 0)
    return { text: withoutRanges(text, remove), start: start - removedBefore(start), end: end - removedBefore(end) }
  }
  const selected = text.slice(start, end)
  const math = mathRanges(selected)
  const lines: string[] = []
  let from = 0
  for (let i = 0; i < selected.length; i++) {
    if (selected[i] === "\n" && !math.some((r) => r.start < i && r.end > i)) {
      lines.push(selected.slice(from, i))
      from = i + 1
    }
  }
  lines.push(selected.slice(from))
  const marked = selected ? lines.map((line) => line ? open + line + close : line).join("\n") : open + close
  const prefix = selected && selected.startsWith("\n") ? 0 : open.length
  const suffix = selected && selected.endsWith("\n") ? 0 : close.length
  return {
    text: text.slice(0, start) + marked + text.slice(end),
    start: start + prefix,
    end: start + marked.length - suffix,
  }
}
