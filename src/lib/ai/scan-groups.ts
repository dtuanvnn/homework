import { checkGroups, normalizeGroups } from "@/lib/question-groups"
import { canSplitBlanks, splitBlanks, splitBlanksInGroup, ungroup, updateGroup } from "@/lib/question-groups-edit"
import type { FillBlankQuestion, Question, QuestionGroup } from "@/lib/types"
import type { ScannedQuestion, ScanPart } from "./scan"

/*
 * After each page is scanned on its own: join the bài a page break cut in two,
 * split fill-in passages into one câu per blank, and make sure every bài is
 * valid. Pure, so the joining rules are unit tested.
 */

/** Joins `next` onto `prev`: a space when a paragraph was cut mid-way, else a new line. */
const joinText = (prev: string, next: string, midParagraph: boolean) =>
  !next.trim() ? prev : !prev.trim() ? next.trim() : `${prev.trimEnd()}${midParagraph ? " " : "\n"}${next.trim()}`

const withGroup = (it: ScannedQuestion, group: QuestionGroup, groupFigure: ScannedQuestion["groupFigure"]): ScannedQuestion => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- replaced by the joined bài's figure
  const { groupFigure: _old, ...rest } = it
  return { ...rest, question: { ...it.question, group }, ...(groupFigure ? { groupFigure } : {}) }
}

/**
 * Page parts in order → one list of review items. A bài that `continues` at
 * the top of page N joins the last bài of page N−1 (same label, or none); a
 * passage left without câu at the end of page N−1 takes the câu that open
 * page N. Nothing reaches past an adjacent page.
 */
export function joinPages(parts: ScanPart[]): ScannedQuestion[] {
  let items: ScannedQuestion[] = []
  // A page's bài that joined an earlier one is known by the earlier id from then on (a bài over 3+ pages).
  const joinedInto = new Map<string, string>()
  parts.forEach((part, n) => {
    let incoming = part.items
    const tail = n > 0 ? parts[n - 1].tail : undefined
    const tailId = tail && (joinedInto.get(tail.groupId) ?? tail.groupId)
    const target = tailId ? items.find((it) => it.question.group?.id === tailId)?.question.group : undefined
    const targetFigure = target && items.find((it) => it.question.group?.id === target.id && it.groupFigure)?.groupFigure
    const lead = part.lead
    if (target && lead && (!lead.label || !target.label || lead.label === target.label)) {
      const leadMembers = incoming.filter((it) => it.question.group?.id === lead.groupId)
      const leadGroup = leadMembers[0]?.question.group
      const group: QuestionGroup = { ...target, prompt: joinText(target.prompt, leadGroup?.prompt ?? "", lead.midParagraph) }
      if (!group.layout && leadGroup?.layout) group.layout = leadGroup.layout
      const figure = targetFigure ?? leadMembers.find((it) => it.groupFigure)?.groupFigure
      joinedInto.set(lead.groupId, target.id)
      items = items.map((it) => (it.question.group?.id === target.id ? withGroup(it, group, figure) : it))
      incoming = incoming.map((it) => (it.question.group?.id === lead.groupId ? withGroup(it, group, figure) : it))
      // A fill-in passage cut by the page break goes back to one passage (split later, numbered across both pages).
      const before = [...items].reverse().find((it) => it.question.group?.id === target.id && !it.placeholder)
      const after = incoming[0]
      if (before?.question.type === "dien-cho-trong" && after?.question.type === "dien-cho-trong" && after.question.group?.id === target.id) {
        const upper = before.question
        const lower = after.question as FillBlankQuestion
        const merged: FillBlankQuestion = {
          ...upper,
          prompt: joinText(upper.prompt, lower.prompt, lead.midParagraph),
          answers: [...upper.answers, ...lower.answers],
          points: upper.points + lower.points,
        }
        items = items.map((it) => (it === before ? { ...it, question: merged, confidence: Math.min(it.confidence, after.confidence) } : it))
        incoming = incoming.slice(1)
      }
    } else if (target && tail?.empty && !lead) {
      const opening = incoming.findIndex((it) => it.question.group)
      const count = opening < 0 ? incoming.length : opening
      incoming = incoming.map((it, k) => (k < count ? withGroup(it, target, targetFigure) : it))
    }
    items = [...items, ...incoming]
  })
  // A placeholder whose bài has received câu has done its job.
  return items.filter((it) => !it.placeholder || !items.some((o) => !o.placeholder && o.question.group?.id === it.question.group?.id))
}

/** The id of a bài whose câu are not all next to each other, if any. */
function brokenGroup(qs: Question[]): string | undefined {
  const closed = new Set<string>()
  let current: string | undefined
  for (const q of qs) {
    const id = q.group?.id
    if (current && id !== current) closed.add(current)
    if (id && closed.has(id)) return id
    current = id
  }
  return undefined
}

/**
 * Splits fill-in passages (inside a scanned bài, or standalone with 3+ blanks
 * as "Tự chia bài" does) into one câu per blank, then releases any bài the AI
 * left in pieces, so `checkGroups` holds. New blank câu take the review
 * details (page, confidence, note, figure) of the passage they came from.
 */
export function finalizeScanGroups(items: ScannedQuestion[]): ScannedQuestion[] {
  const byId = new Map(items.map((it) => [it.question.id, it]))
  const byGroup = new Map<string, ScannedQuestion>()
  let qs = items.map((it) => it.question)
  for (const it of items) {
    const id = it.question.group?.id
    if (id && !byGroup.has(id)) byGroup.set(id, it)
  }
  for (const id of byGroup.keys()) qs = splitBlanksInGroup(qs, id)
  for (const it of items) {
    if (it.placeholder || !canSplitBlanks(qs, it.question.id, 3)) continue
    const at = qs.findIndex((q) => q.id === it.question.id)
    qs = splitBlanks(qs, it.question.id)
    const group = qs[at].group!
    qs = updateGroup(qs, group.id, { layout: "doan-van" })
    // The passage's own figure becomes the bài's.
    const { figure, ...rest } = it
    byGroup.set(group.id, { ...rest, ...(figure ? { groupFigure: figure } : {}) })
  }
  qs = normalizeGroups(qs)
  for (let broken = brokenGroup(qs); broken; broken = brokenGroup(qs)) qs = ungroup(qs, broken)
  if (checkGroups(qs)) qs = qs.map((q) => (q.group ? ungroup([q], q.group.id)[0] : q))
  return qs.map((q): ScannedQuestion => {
    const known = byId.get(q.id)
    if (known) {
      if (q.group) return { ...known, question: q }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- released from its bài
      const { groupFigure: _figure, ...rest } = known
      return { ...rest, question: q }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a blank câu shows the passage's figure through its bài
    const { figure: _figure, ...source } = byGroup.get(q.group!.id)!
    return { ...source, question: q }
  })
}
