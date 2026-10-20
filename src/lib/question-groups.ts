import { BLANK, countBlanks } from "./questions"
import type { QuestionGroup, QuestionImage } from "./types"

/*
 * Bài: consecutive questions sharing `group.id`. Every câu con stores the same
 * group (label, shared prompt, shared figure), so snapshots, offline packs and
 * AI requests carry it. Câu keep their set position as number everywhere.
 * A split passage is a bài whose prompt keeps its "___" and whose blank câu
 * (`blank: k`) answer them in order.
 */

type Groupable = { group?: QuestionGroup; blank?: number }

export type Block<T> =
  | { kind: "single"; item: T; number: number }
  | { kind: "group"; group: QuestionGroup; title: string; order: number; items: { item: T; number: number }[] }

export function groupTitle(group: QuestionGroup, order: number): string {
  return group.label || `Bài ${order}`
}

/** Splits `items` into standalone câu and bài; `numberOf` defaults to the position (index + 1). */
export function groupBlocks<T extends Groupable>(items: T[], numberOf: (item: T, index: number) => number = (_, i) => i + 1): Block<T>[] {
  const blocks: Block<T>[] = []
  let order = 0
  items.forEach((item, i) => {
    const number = numberOf(item, i)
    const last = blocks.at(-1)
    if (!item.group) blocks.push({ kind: "single", item, number })
    else if (last?.kind === "group" && last.group.id === item.group.id) last.items.push({ item, number })
    else {
      order += 1
      blocks.push({ kind: "group", group: item.group, title: groupTitle(item.group, order), order, items: [{ item, number }] })
    }
  })
  return blocks
}

const sameGroup = (a: QuestionGroup, b: QuestionGroup) =>
  (a.label ?? "") === (b.label ?? "") && a.prompt === b.prompt && a.image?.path === b.image?.path

/** Vietnamese error when a bài is split or its câu disagree on the shared part; null when valid. */
export function checkGroups(items: Groupable[]): string | null {
  const closed = new Set<string>()
  let current: QuestionGroup | undefined
  for (const { group } of items) {
    if (current && group?.id !== current.id) closed.add(current.id)
    if (group) {
      if (closed.has(group.id)) return "Các câu của một bài phải liền nhau."
      if (current?.id === group.id && !sameGroup(current, group)) return "Các câu của một bài phải có cùng đề chung."
    }
    current = group
  }
  return checkBlanks(items)
}

/** Blank câu sit in a bài and answer its prompt's "___" one by one, in order. */
export function checkBlanks(items: Groupable[]): string | null {
  const blanks = new Map<string, { group: QuestionGroup; seen: number[] }>()
  for (const { group, blank } of items) {
    if (blank === undefined) continue
    if (!group) return "Câu điền chỗ trống phải nằm trong một bài."
    const entry = blanks.get(group.id) ?? { group, seen: [] }
    entry.seen.push(blank)
    blanks.set(group.id, entry)
  }
  for (const { group, seen } of blanks.values()) {
    if (seen.some((b, i) => b !== i + 1)) return "Các câu điền chỗ trống phải theo đúng thứ tự."
    if (seen.length !== countBlanks(group.prompt)) return "Số chỗ trống trong đề chung phải bằng số câu điền chỗ trống."
  }
  return null
}

/** Copies each bài's first câu's group onto the rest, so all members match. */
export function normalizeGroups<T extends Groupable>(items: T[]): T[] {
  const first = new Map<string, QuestionGroup>()
  return items.map((item) => {
    if (!item.group) return item
    const group = first.get(item.group.id)
    if (!group) {
      first.set(item.group.id, item.group)
      return item
    }
    return { ...item, group }
  })
}

/**
 * The câu's prompt preceded by its bài's label and shared prompt (for AI requests
 * and answer-leak checks). A blank câu marks its "___" as "[___]" and names it.
 */
export function fullPrompt(q: { prompt: string; group?: QuestionGroup; blank?: number }): string {
  if (!q.group) return q.prompt
  const shared = q.blank ? markBlank(q.group.prompt, q.blank) : q.group.prompt
  const own = q.blank ? [q.prompt, `Chỗ trống số ${q.blank}`] : [q.prompt]
  return [q.group.label, shared, ...own].filter((part) => part?.trim()).join("\n")
}

function markBlank(prompt: string, blank: number): string {
  const parts = prompt.split(BLANK)
  return parts.map((p, i) => (i === 0 ? p : `${i === blank ? `[${BLANK}]` : BLANK}${p}`)).join("")
}

/** The bài's shared figure, then the câu's own, without duplicates. */
export function questionFigures(q: { image?: QuestionImage; group?: QuestionGroup }): QuestionImage[] {
  const figures = [q.group?.image, q.image].filter((f): f is QuestionImage => !!f)
  return figures.filter((f, i) => figures.findIndex((x) => x.path === f.path) === i)
}
