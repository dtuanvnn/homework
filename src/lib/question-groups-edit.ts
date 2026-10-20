import { checkBlanks, groupBlocks } from "./question-groups"
import { countBlanks, uid } from "./questions"
import type { FillBlankQuestion, Question, QuestionGroup, QuestionImage, ShortAnswerQuestion } from "./types"

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
  imageUrl?: string
  /** Set when the bài is a passage split into this many blank câu. */
  blanks?: number
}

const LABEL = /^(Part|Bài|Exercise|Câu|Phần)\s+(\d+|[IVXLC]+)([a-z])?\s*[.:)]\s*/iu

const linesOf = (prompt: string) => prompt.split("\n").map((l) => l.trim())

/** Proposed by "Tự chia bài" only from this many blanks; the manual action needs 2. */
const SUGGEST_SPLIT_BLANKS = 3

/**
 * Splits standalone passages with 3+ blanks, then groups runs of standalone câu
 * that start with the same line(s); existing bài are left alone.
 */
export function suggestGroups(input: Question[]): { questions: Question[]; groups: SuggestedGroup[] } {
  const created = new Set<string>()
  let qs = input
  for (const q of input) {
    if (!canSplitBlanks(qs, q.id, SUGGEST_SPLIT_BLANKS)) continue
    const at = qs.indexOf(q)
    qs = splitBlanks(qs, q.id)
    created.add(qs[at].group!.id)
  }
  const out: Question[] = []
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
  const groups = groupBlocks(out).flatMap((b) => {
    if (b.kind !== "group" || !created.has(b.group.id)) return []
    const blanks = b.items.filter((x) => isBlank(x.item)).length
    return [
      {
        title: b.title,
        from: b.items[0].number,
        to: b.items.at(-1)!.number,
        prompt: b.group.prompt,
        ...(b.group.image ? { image: b.group.image, imageUrl: b.group.imageUrl } : {}),
        ...(blanks ? { blanks } : {}),
      },
    ]
  })
  return { questions: created.size ? out : input, groups }
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

/* ---------- Split passage (Tách / Gộp chỗ trống) ---------- */

/** A blank câu of a split passage: it only moves with its passage ("Gộp chỗ trống" / "Bỏ bài"). */
export const isBlankQuestion = (q: Question): q is ShortAnswerQuestion & { blank: number } => q.type === "tra-loi-ngan" && q.blank !== undefined
const isBlank = isBlankQuestion

/** A standalone fill-blank question with at least `min` blanks. */
export function canSplitBlanks(qs: Question[], questionId: string, min = 2): boolean {
  const q = qs.find((x) => x.id === questionId)
  return !!q && q.type === "dien-cho-trong" && !q.group && countBlanks(q.prompt) >= min
}

/**
 * The passage becomes a bài (its text, still with "___", as the shared prompt;
 * its figure as the shared figure) with one short answer per blank. Keys pair
 * with the blanks in order; a blank without a key is marked "missing".
 */
export function splitBlanks(qs: Question[], questionId: string): Question[] {
  if (!canSplitBlanks(qs, questionId)) return qs
  const q = qs.find((x) => x.id === questionId) as FillBlankQuestion
  const match = LABEL.exec(q.prompt)
  const group: QuestionGroup = {
    id: uid("bai"),
    ...(match ? { label: `${match[1]} ${match[2]}${match[3] ?? ""}` } : {}),
    prompt: match ? q.prompt.slice(match[0].length).trim() : q.prompt,
    ...(q.image ? { image: q.image, ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}) } : {}),
  }
  return qs.flatMap((x) => (x === q ? blankQuestions(q, group) : [x]))
}

/** One short-answer câu per "___" of `q`'s prompt, in bài `group`. */
function blankQuestions(q: FillBlankQuestion, group: QuestionGroup): Question[] {
  const count = countBlanks(q.prompt)
  return Array.from({ length: count }, (_, k): Question => {
    const answer = q.answers[k] ?? ""
    // A blank the key list doesn't reach has no key, whatever the passage's status.
    const answerStatus = answer.trim() ? q.answerStatus : "missing"
    return {
      id: uid("ch"),
      type: "tra-loi-ngan",
      prompt: "",
      answer,
      blank: k + 1,
      // Every blank câu is worth 1 point, like any câu (the parent can change it).
      points: 1,
      skills: q.skills,
      group,
      ...(q.math !== undefined ? { math: q.math } : {}),
      ...(q.simplest !== undefined ? { simplest: q.simplest } : {}),
      ...(answerStatus ? { answerStatus } : {}),
      ...(k === 0 && q.solution ? { solution: q.solution } : {}),
      ...(k === 0 && q.solutionImage ? { solutionImage: q.solutionImage, ...(q.solutionImageUrl ? { solutionImageUrl: q.solutionImageUrl } : {}) } : {}),
    }
  })
}

/** One key per "___" of the passage: missing keys are empty, extra keys dropped (so joined passages keep keys on their blanks). */
export function blankKeys(q: FillBlankQuestion): string[] {
  return Array.from({ length: countBlanks(q.prompt) }, (_, k) => q.answers[k] ?? "")
}

/**
 * A bài whose câu are only fill-blank passages (a scanned cloze text under its
 * instruction) becomes a split passage in place: the passages join into one,
 * appended to the bài's prompt, with one blank câu per "___". The bài keeps
 * its id, label, layout and figure.
 */
export function splitBlanksInGroup(qs: Question[], groupId: string, min = SUGGEST_SPLIT_BLANKS): Question[] {
  const members = qs.filter((q) => q.group?.id === groupId)
  if (!members.length || !members.every((q): q is FillBlankQuestion => q.type === "dien-cho-trong")) return qs
  const passage = members.map((q) => q.prompt.trim()).join("\n")
  if (countBlanks(passage) < min) return qs
  const first = members[0]
  const group: QuestionGroup = { ...first.group!, prompt: [first.group!.prompt, passage].filter((p) => p.trim()).join("\n") }
  const merged: FillBlankQuestion = { ...first, prompt: passage, answers: members.flatMap(blankKeys) }
  return qs.flatMap((q) => (q === first ? blankQuestions(merged, group) : q.group?.id === groupId ? [] : [q]))
}

/** The bài consists only of blank câu (so it can go back to one question). */
export function isBlankGroup(qs: Question[], groupId: string): boolean {
  const members = qs.filter((q) => q.group?.id === groupId)
  return members.length > 0 && members.every(isBlank)
}

/** The bài holds blank câu (a split passage, maybe with ordinary câu among them). */
export function hasBlanks(qs: Question[], groupId: string): boolean {
  return qs.some((q) => q.group?.id === groupId && isBlank(q))
}

const STATUS_ORDER = ["missing", "ai-check", "ai"] as const

/**
 * Inverse of splitBlanks: one fill-blank question in the bài's place. Ordinary
 * câu of the bài follow it on their own (lossless, like "Bỏ bài").
 */
export function mergeBlanks(qs: Question[], groupId: string): Question[] {
  if (!hasBlanks(qs, groupId)) return qs
  const all = qs.filter((q) => q.group?.id === groupId)
  const members = all.filter(isBlank)
  const others = all.filter((q) => !isBlank(q)).map(release)
  const sorted = [...members].sort((a, b) => a.blank - b.blank)
  const group = members[0].group!
  const notes = sorted.filter((m) => m.prompt.trim()).map((m) => `(${m.blank}) ${m.prompt.trim()}`)
  const solution = [...members.flatMap((m) => (m.solution ? [m.solution] : [])), ...notes].join("\n")
  const solutionImage = members.find((m) => m.solutionImage)
  const answerStatus = STATUS_ORDER.find((s) => members.some((m) => m.answerStatus === s))
  const first = members[0]
  const anchor = all[0]
  const merged: FillBlankQuestion = {
    id: uid("ch"),
    type: "dien-cho-trong",
    prompt: `${group.label ? `${group.label}. ` : ""}${group.prompt}`,
    answers: sorted.map((m) => m.answer),
    points: members.reduce((sum, m) => sum + m.points, 0),
    skills: [...new Set(members.flatMap((m) => m.skills))],
    ...(first.math !== undefined ? { math: first.math } : {}),
    ...(first.simplest !== undefined ? { simplest: first.simplest } : {}),
    ...(group.image ? { image: group.image, ...(group.imageUrl ? { imageUrl: group.imageUrl } : {}) } : {}),
    ...(answerStatus ? { answerStatus } : {}),
    ...(solution ? { solution } : {}),
    ...(solutionImage ? { solutionImage: solutionImage.solutionImage, ...(solutionImage.solutionImageUrl ? { solutionImageUrl: solutionImage.solutionImageUrl } : {}) } : {}),
  }
  return qs.flatMap((q) => (q === anchor ? [merged, ...others] : q.group?.id === groupId ? [] : [q]))
}

/** A reorder is allowed unless it moves a blank câu out of its bài or out of order. */
export function canApplyMove(next: Question[]): boolean {
  return checkBlanks(next) === null
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

/** The bài's câu join the bài directly above it, each keeping the shared prompt it had (lossless). */
export function joinPreviousGroup(qs: Question[], groupId: string): Question[] {
  const i = qs.findIndex((q) => q.group?.id === groupId)
  const above = qs[i - 1]?.group
  if (i < 0 || !above || hasBlanks(qs, groupId) || hasBlanks(qs, above.id)) return qs
  return qs.map((q) => (q.group?.id === groupId ? withGroup(release(q), above) : q))
}

/** "Tách thành bài riêng": the câu and those after it in its bài form a new bài with the same shared part, unlabelled. */
export function splitGroupAt(qs: Question[], questionId: string): Question[] {
  const i = qs.findIndex((q) => q.id === questionId)
  const group = qs[i]?.group
  if (!group || qs[i - 1]?.group?.id !== group.id || hasBlanks(qs, group.id)) return qs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the new bài is titled "Bài n" until the parent names it
  const { label: _label, ...shared } = group
  const next: QuestionGroup = { ...shared, id: uid("bai") }
  return qs.map((q, k) => (k >= i && q.group?.id === group.id ? withGroup(q, next) : q))
}

/** Only the first or last câu of a bài can leave it without splitting the bài. */
export function canRelease(qs: Question[], questionId: string): boolean {
  const i = qs.findIndex((q) => q.id === questionId)
  const id = qs[i]?.group?.id
  if (!id || isBlank(qs[i])) return false
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
    if (!next.layout) delete next.layout
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
