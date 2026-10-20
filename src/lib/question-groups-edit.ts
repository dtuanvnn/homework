import { groupBlocks } from "./question-groups"
import { uid } from "./questions"
import type { Question, QuestionGroup, QuestionImage } from "./types"

/*
 * Pure editor operations on bài. Every function returns a new list in which
 * each bài stays contiguous (checkGroups holds). Taking a câu out of its bài
 * is lossless: the shared prompt goes back in front of the câu's prompt and
 * the shared figure back to a câu without one of its own.
 */

const newGroup = (): QuestionGroup => ({ id: uid("bai"), prompt: "" })

/** The câu on its own again, carrying its bài's shared prompt and figure. */
function release(q: Question): Question {
  if (!q.group) return q
  const { group, ...rest } = q
  const prompt = [group.prompt, rest.prompt].filter((p) => p.trim()).join("\n")
  const image = !rest.image && group.image ? { image: group.image, ...(group.imageUrl ? { imageUrl: group.imageUrl } : {}) } : {}
  return { ...rest, prompt, ...image } as Question
}

const withGroup = (q: Question, group: QuestionGroup): Question => ({ ...q, group })

/* ---------- Tự chia bài ---------- */

export interface SuggestedGroup {
  title: string
  /** 1-based câu numbers. */
  from: number
  to: number
  prompt: string
  image?: QuestionImage
}

const LABEL = /^(Part|Bài|Exercise|Câu|Phần)\s+(\d+|[IVXLC]+)([a-z])?\s*[.:)]\s*/iu

const linesOf = (prompt: string) => prompt.split("\n").map((l) => l.trim())

/** Groups runs of standalone câu that start with the same line(s); existing bài are left alone. */
export function suggestGroups(qs: Question[]): { questions: Question[]; groups: SuggestedGroup[] } {
  const out: Question[] = []
  const created = new Set<string>()
  let i = 0
  while (i < qs.length) {
    const first = linesOf(qs[i].prompt)[0]
    let j = i
    while (j < qs.length && !qs[j].group && first && linesOf(qs[j].prompt)[0] === first) j++
    const run = qs.slice(i, Math.max(j, i + 1))
    const grouped = run.length >= 2 ? groupRun(run) : null
    if (grouped) {
      created.add(grouped[0].group!.id)
      out.push(...grouped)
    } else out.push(...run)
    i += run.length
  }
  const groups = groupBlocks(out).flatMap((b) =>
    b.kind === "group" && created.has(b.group.id)
      ? [{ title: b.title, from: b.items[0].number, to: b.items.at(-1)!.number, prompt: b.group.prompt, ...(b.group.image ? { image: b.group.image } : {}) }]
      : [],
  )
  return { questions: created.size ? out : qs, groups }
}

function groupRun(run: Question[]): Question[] | null {
  const lines = run.map((q) => linesOf(q.prompt))
  let shared = 0
  while (lines.every((l) => l[shared] !== undefined && l[shared] === lines[0][shared])) shared++
  // Every câu must keep something of its own.
  while (shared > 0 && lines.some((l) => !l.slice(shared).some(Boolean))) shared--
  if (!shared) return null

  let prompt = lines[0].slice(0, shared).join("\n")
  const match = LABEL.exec(prompt)
  const label = match ? `${match[1]} ${match[2]}${match[3] ?? ""}` : undefined
  if (match) prompt = prompt.slice(match[0].length).trim()

  const figure = run[0].image
  const sharedFigure = figure && run.every((q) => q.image?.path === figure.path)
  const group: QuestionGroup = {
    id: uid("bai"),
    ...(label ? { label } : {}),
    prompt,
    ...(sharedFigure ? { image: figure, ...(run[0].imageUrl ? { imageUrl: run[0].imageUrl } : {}) } : {}),
  }
  return run.map((q, k) => {
    const own = { ...q, prompt: lines[k].slice(shared).join("\n").trim(), group }
    if (!sharedFigure) return own
    const { image: _image, imageUrl: _imageUrl, ...rest } = own // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest as Question
  })
}

/* ---------- Manual editing ---------- */

export function createGroup(qs: Question[], questionId: string): Question[] {
  const group = newGroup()
  return qs.map((q) => (q.id === questionId && !q.group ? withGroup(q, group) : q))
}

/** A standalone câu joins the bài above/below, or forms a new bài with a standalone neighbour. */
export function joinGroup(qs: Question[], questionId: string, direction: "up" | "down"): Question[] {
  const i = qs.findIndex((q) => q.id === questionId)
  const neighbour = qs[direction === "up" ? i - 1 : i + 1]
  if (i < 0 || !neighbour || qs[i].group) return qs
  const group = neighbour.group ?? newGroup()
  return qs.map((q) => (q === qs[i] || q === neighbour ? withGroup(q, group) : q))
}

/** Only the first or last câu of a bài can leave it without splitting the bài. */
export function canRelease(qs: Question[], questionId: string): boolean {
  const i = qs.findIndex((q) => q.id === questionId)
  const id = qs[i]?.group?.id
  if (!id) return false
  return qs[i - 1]?.group?.id !== id || qs[i + 1]?.group?.id !== id
}

export function releaseQuestion(qs: Question[], questionId: string): Question[] {
  if (!canRelease(qs, questionId)) return qs
  return qs.map((q) => (q.id === questionId ? release(q) : q))
}

export function ungroup(qs: Question[], groupId: string): Question[] {
  return qs.map((q) => (q.group?.id === groupId ? release(q) : q))
}

export function updateGroup(qs: Question[], groupId: string, patch: Partial<Omit<QuestionGroup, "id">>): Question[] {
  return qs.map((q) => {
    if (q.group?.id !== groupId) return q
    const next: QuestionGroup = { ...q.group, ...patch }
    if (!next.label) delete next.label
    if (!next.image) {
      delete next.image
      delete next.imageUrl
    }
    return withGroup(q, next)
  })
}

/** "Điểm cả bài": every câu gets an exact equal share. */
export function setGroupPoints(qs: Question[], groupId: string, total: number): Question[] {
  const count = qs.filter((q) => q.group?.id === groupId).length
  return count ? qs.map((q) => (q.group?.id === groupId ? { ...q, points: total / count } : q)) : qs
}

export function deleteGroup(qs: Question[], groupId: string): Question[] {
  return qs.filter((q) => q.group?.id !== groupId)
}

/**
 * Fixes bài membership after a drag: between two câu of one bài ⇒ joins it;
 * next to a câu of its own bài ⇒ stays; otherwise leaves its bài (lossless).
 * `after` is the reordered list (dnd-kit's arrayMove).
 */
export function applyDrop(after: Question[], movedId: string): Question[] {
  const i = after.findIndex((q) => q.id === movedId)
  if (i < 0) return after
  const moved = after[i]
  const own = moved.group?.id
  const prev = after[i - 1]?.group
  const next = after[i + 1]?.group
  let result: Question
  if (prev && next && prev.id === next.id) result = own === prev.id ? moved : withGroup(release(moved), prev)
  else if (own && (prev?.id === own || next?.id === own)) result = moved
  else result = release(moved)
  return result === moved ? after : after.map((q, k) => (k === i ? result : q))
}
