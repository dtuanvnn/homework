/**
 * View models for the student screens, built on the server from database
 * records. Pure functions (no I/O) so they can be unit-tested; every date
 * label is computed here so server and client render the same text.
 */
import { deriveAssignmentState, type DerivedState } from "@/lib/assignment-status"
import { blankMarks, type BlankMark } from "@/lib/blanks"
import { chosenOptions, correctOptions, isMultiAnswer } from "@/lib/choice"
import { addDays, startOfDay, startOfWeek } from "@/lib/dates"
import { formatDayMonth, formatShortDate, formatTime, formatVietnameseDate, formatWeekday } from "@/lib/format"
import type { EssayValue, Response } from "@/lib/grading"
import type { Ink } from "@/lib/ink"
import { attemptStars } from "@/lib/rewards/stars"
import { streakRuns } from "@/lib/rewards/streak"
import { answerAsRichText } from "@/lib/rich-text"
import { essayDrawing, essayInk } from "@/lib/views/grading"
import type { EssayQuestion, FillBlankQuestion, MultipleChoiceQuestion, Question, QuestionGroup, ShortAnswerQuestion, SubjectId, TrueFalseQuestion, VocabQuestion } from "@/lib/types"
import type { AnswerRecord, AssignmentRecord, AttemptRecord } from "@/server/queries"

export type StudentStatus = "not-started" | "in-progress" | "submitted" | "graded"

interface ItemBase {
  /** Assignment id. */
  id: string
  title: string
  subject: SubjectId
  questions: number
  minutes: number
  /** Exam mode: minutes per attempt. */
  timeLimit?: number
  mode: "web" | "paper"
  status: StudentStatus
  /** Answered share of the draft attempt, 0–100. */
  progress?: number
  score?: number
  previousScore?: number
  attempt: 1 | 2
  maxAttempts: 1 | 2
  canRetry: boolean
  /** Latest graded attempt, opened by "Xem kết quả". */
  resultId?: string
}

export interface TodayItem extends ItemBase {
  note?: string
  /** "17:00", "20:00 hôm qua", … */
  due: string
  overdue: boolean
}

export interface UpcomingItem {
  id: string
  day: string
  date: string
  title: string
  subject: SubjectId
  minutes: number
}

export interface TodayView {
  dateLabel: string
  items: TodayItem[]
  upcoming: UpcomingItem[]
  streak: number
}

export interface AssignmentGroup {
  key: string
  label: string
  order: number
  late?: boolean
}

export interface MyAssignment extends ItemBase {
  due: string // ISO
  dueText: string
  late: boolean
  group: AssignmentGroup
}

export interface AssignmentsView {
  items: MyAssignment[]
  week: { done: number; total: number }
}

export interface ResultListItem {
  /** Attempt id. */
  id: string
  title: string
  subject: SubjectId
  gradedAt: string // ISO
  gradedLabel: string
  score: number
  attempt: 1 | 2
  maxAttempts: 1 | 2
  previousScore?: number
  stars: 0 | 1 | 2 | 3
  /** This is the latest attempt and a retry is still open. */
  canRetry: boolean
  /** A later attempt was submitted and waits for grading. */
  retryPending: boolean
}

export interface ReviewItem {
  id: string
  prompt: string
  answer: string
  correct: boolean
  /** Only once answers are revealed (see ResultView.answersRevealed). */
  correctAnswer?: string
  /** Worked solution and its picture, only once answers are revealed. */
  solution?: string
  solutionImage?: { path: string; width: number; height: number }
  solutionImageUrl?: string
  comment?: string
  /** AI guidance for a wrong answer: what went wrong and how to solve it, without the answer. */
  hint?: string
  image?: { path: string; width: number; height: number }
  imageUrl?: string
  /** The child's handwritten essay pages (or a legacy drawing). */
  handwriting?: { ink?: Ink; drawing?: string }
  /** Flashcard word (tu-vung): its spelling is shown with wrong answers even before answers are revealed. */
  word?: string
  /** Unsplit fill-blank question with 2+ blanks (web): right/wrong per blank, keys only once revealed. */
  blanks?: BlankMark[]
  /** Blank câu of a split passage: which "___" it answers; the child's word and verdict (web) colour the bài's passage. */
  blankSlot?: { index: number; given?: string; correct: boolean | null }
  /** The câu's bài, from the snapshot taken at submit time. */
  group?: QuestionGroup
  /** Only for câu of a bài: summed into the bài header's score. */
  points?: { awarded: number; max: number }
}

export interface ResultView {
  /** Attempt id. */
  id: string
  assignmentId: string
  title: string
  subject: SubjectId
  score: number
  attempt: 1 | 2
  maxAttempts: 1 | 2
  previousScore?: number
  stars: 0 | 1 | 2 | 3
  parentComment: string
  /** Work time in whole minutes (at least 1), when recorded. */
  durationMinutes?: number
  timeLimitMinutes?: number
  canRetry: boolean
  /**
   * Correct answers are shown only when no more attempts are possible, so the
   * child can't copy them into the retry. Until then wrong answers get hints.
   */
  answersRevealed: boolean
  /** Wrong answers still without a hint (the page asks the AI for them). */
  hintsPending: boolean
  review: ReviewItem[]
}

/* ---------- Status ---------- */

export function studentStatus(state: DerivedState): StudentStatus {
  return state.status === "scheduled" ? "not-started" : state.status
}

export const stateOf = (record: AssignmentRecord, now: Date) => deriveAssignmentState(record, record.attempts, now)

/** The web flow is open: not scheduled, not waiting for grading, and either unfinished or retryable. */
export function canTake(state: DerivedState): boolean {
  if (state.status === "scheduled" || state.status === "submitted") return false
  return state.status !== "graded" || state.canRetry
}

/** Number of saved answers per draft attempt id, used for progress bars. */
export type DraftCounts = Record<string, number>

function itemBase(record: AssignmentRecord, state: DerivedState, drafts: DraftCounts): ItemBase {
  const latest = record.attempts.at(-1)
  const total = record.set.questionCount
  const progress =
    state.status === "in-progress" && latest ? Math.min(100, Math.round(((drafts[latest.id] ?? 0) / Math.max(total, 1)) * 100)) : undefined
  return {
    id: record.id,
    title: record.set.title,
    subject: record.set.subject,
    questions: total,
    minutes: record.set.estimatedMinutes,
    timeLimit: record.timeLimitMinutes ?? undefined,
    mode: record.mode,
    status: studentStatus(state),
    progress,
    score: state.score,
    previousScore: state.previousScore,
    attempt: state.attemptNo,
    maxAttempts: record.maxAttempts,
    canRetry: state.canRetry,
    resultId: state.status === "graded" ? latest?.id : undefined,
  }
}

/* ---------- Dates ---------- */

const DAY = 864e5
/** Whole calendar days from `now` to `date` (local time zone). */
export const dayDiff = (date: Date, now: Date) => Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY)

function shortDue(due: Date, now: Date): string {
  const d = dayDiff(due, now)
  const t = formatTime(due)
  if (d === 0) return t
  if (d === 1) return `${t} ngày mai`
  if (d === -1) return `${t} hôm qua`
  return `${t}, ${formatDayMonth(due)}`
}

/* ---------- Today ---------- */

export function buildToday(records: AssignmentRecord[], drafts: DraftCounts, now: Date): TodayView {
  const items: TodayItem[] = []
  const upcoming: UpcomingItem[] = []
  for (const r of records) {
    const state = stateOf(r, now)
    const d = dayDiff(r.dueAt, now)
    const latest = r.attempts.at(-1)
    const available = r.availableFrom.getTime() <= now.getTime()
    const gradedTodayRetry = state.status === "graded" && state.canRetry && !!latest?.gradedAt && dayDiff(latest.gradedAt, now) === 0
    if (available && (d === 0 || state.overdue || gradedTodayRetry)) {
      items.push({ ...itemBase(r, state, drafts), note: r.parentNote ?? undefined, due: shortDue(r.dueAt, now), overdue: state.overdue })
    } else if (d > 0 && d <= 7 && state.status !== "submitted" && state.status !== "graded") {
      upcoming.push({ id: r.id, day: formatWeekday(r.dueAt), date: formatDayMonth(r.dueAt), title: r.set.title, subject: r.set.subject, minutes: r.set.estimatedMinutes })
    }
  }
  return { dateLabel: formatVietnameseDate(now), items, upcoming: upcoming.slice(0, 4), streak: streakRuns(records, now).current }
}

/* ---------- My assignments ---------- */

function groupOf(due: Date, late: boolean, now: Date): AssignmentGroup {
  if (late) return { key: "late", label: "Trễ hạn", order: -1e6, late: true }
  const d = dayDiff(due, now)
  if (d === 0) return { key: "d0", label: "Hôm nay", order: 0 }
  if (d === 1) return { key: "d1", label: "Ngày mai", order: 1 }
  if (d === -1) return { key: "d-1", label: "Hôm qua", order: -1 }
  const nextWeek = startOfWeek(addDays(now, 7))
  if (due >= nextWeek && due < addDays(nextWeek, 7)) return { key: "nw", label: "Tuần sau", order: 7 }
  return { key: `d${d}`, label: `${formatWeekday(due)}, ${formatDayMonth(due)}`, order: d }
}

function dueText(due: Date, late: boolean, now: Date): string {
  const d = dayDiff(due, now)
  if (late) return `Trễ ${-d} ngày`
  const t = formatTime(due)
  if (d === 0) return `Hạn: ${t} hôm nay`
  if (d === 1) return `Hạn: ${t} ngày mai`
  return `Hạn: ${t}, ${formatDayMonth(due)}`
}

export function buildAssignments(records: AssignmentRecord[], drafts: DraftCounts, now: Date): AssignmentsView {
  const items = records
    .filter((r) => r.availableFrom.getTime() <= now.getTime())
    .map((r): MyAssignment => {
      const state = stateOf(r, now)
      const late = state.overdue && dayDiff(r.dueAt, now) < 0
      return { ...itemBase(r, state, drafts), due: r.dueAt.toISOString(), dueText: dueText(r.dueAt, late, now), late, group: groupOf(r.dueAt, late, now) }
    })
  const weekStart = startOfWeek(now)
  const thisWeek = items.filter((a) => new Date(a.due) >= weekStart && new Date(a.due) < addDays(weekStart, 7))
  const done = thisWeek.filter((a) => a.status === "submitted" || a.status === "graded").length
  return { items, week: { done, total: thisWeek.length } }
}

/* ---------- Results ---------- */

const gradedOf = (a: AttemptRecord) => (a.gradedAt && a.score !== null ? { at: a.gradedAt, score: a.score } : null)

export function buildResults(records: AssignmentRecord[], now: Date): ResultListItem[] {
  const out: { item: ResultListItem; sort: number }[] = []
  for (const r of records) {
    const state = stateOf(r, now)
    const latest = r.attempts.at(-1)
    for (const a of r.attempts) {
      const g = gradedOf(a)
      if (!g) continue
      const first = r.attempts[0]
      const later = r.attempts.find((x) => x.attemptNo > a.attemptNo)
      out.push({ sort: g.at.getTime(), item: {
        id: a.id,
        title: r.set.title,
        subject: r.set.subject,
        gradedAt: g.at.toISOString(),
        gradedLabel: formatShortDate(g.at),
        score: g.score,
        attempt: a.attemptNo as 1 | 2,
        maxAttempts: r.maxAttempts,
        previousScore: a.attemptNo > 1 ? (first.score ?? undefined) : undefined,
        stars: attemptStars(a.attemptNo, g.score),
        canRetry: a.id === latest?.id && state.canRetry,
        retryPending: !!later?.submittedAt && !later.gradedAt,
      } })
    }
  }
  return out.sort((a, b) => b.sort - a.sort).map((r) => r.item)
}

/* ---------- Result detail ---------- */

const yesNo = (v: boolean) => (v ? "Đúng" : "Sai")
const NO_ANSWER = "(chưa trả lời)"

/** The child's answer as plain text, for every question type. */
export function answerText(q: Question, response: Response | null | undefined, mode: "web" | "paper" = "web"): string {
  if (response === null || response === undefined) return mode === "paper" ? "Bài làm trên giấy" : NO_ANSWER
  switch (q.type) {
    case "trac-nghiem":
    {
      const picked = chosenOptions(response).filter((i) => q.options[i] !== undefined)
      return picked.length ? picked.map((i) => q.options[i]).join(" ; ") : NO_ANSWER
    }
    case "dung-sai":
      return typeof response === "boolean" ? yesNo(response) : NO_ANSWER
    case "dien-cho-trong": {
      if (!Array.isArray(response)) return NO_ANSWER
      const given = q.answers.map((_, i) => {
        const text = typeof response[i] === "string" ? (response[i] as string).trim() : ""
        return text ? answerAsRichText(q, text) : "…"
      })
      return given.join(" ; ")
    }
    case "tra-loi-ngan":
      return typeof response === "string" && response.trim() ? answerAsRichText(q, response.trim()) : NO_ANSWER
    case "noi": {
      if (typeof response !== "object" || Array.isArray(response)) return NO_ANSWER
      const map = response as Record<string, number>
      return q.pairs.map((p, i) => `${p.left} – ${q.pairs[map[String(i)]]?.right ?? "?"}`).join("; ")
    }
    case "sap-xep":
      return Array.isArray(response) && response.length ? (response as number[]).map((i) => q.tokens[i] ?? "?").join(" ") : NO_ANSWER
    case "tu-luan": {
      const essay = response as EssayValue
      const text = typeof essay.text === "string" ? essay.text.trim() : ""
      if (essayInk(essay)) return text ? `${text} (kèm bài viết tay)` : "(bài viết tay)"
      if (essay.drawing) return text ? `${text} (kèm hình vẽ)` : "(bài viết tay)"
      return text || NO_ANSWER
    }
    case "tu-vung":
      return essayInk(response) ? "(bài viết tay)" : NO_ANSWER
  }
}

/** The expected answer as plain text; essays and questions without an answer key have none. */
export function correctAnswerText(q: Question): string | undefined {
  if (q.answerStatus === "missing") return undefined
  switch (q.type) {
    case "trac-nghiem":
      return correctOptions(q).map((i) => q.options[i]).join(" ; ")
    case "dung-sai":
      return yesNo(q.answer)
    case "dien-cho-trong":
      return q.answers.map((a) => answerAsRichText(q, a)).join(" ; ")
    case "tra-loi-ngan":
      return answerAsRichText(q, q.answer)
    case "noi":
      return q.pairs.map((p) => `${p.left} – ${p.right}`).join("; ")
    case "sap-xep":
      return q.tokens.join(" ")
    case "tu-luan":
      return undefined
    case "tu-vung":
      return q.word
  }
}

export function buildResultDetail(
  detail: { attempt: AttemptRecord & { assignmentId: string }; assignment: AssignmentRecord; answers: AnswerRecord[] },
  now: Date,
): ResultView | null {
  const { attempt, assignment, answers } = detail
  const g = gradedOf(attempt)
  if (!g) return null
  const state = stateOf(assignment, now)
  const latest = assignment.attempts.at(-1)
  const first = assignment.attempts.find((a) => a.attemptNo === 1)
  // Every attempt is used up (or the parent closed the retry) and graded.
  const answersRevealed = state.status === "graded" && !state.canRetry
  return {
    id: attempt.id,
    assignmentId: assignment.id,
    title: assignment.set.title,
    subject: assignment.set.subject,
    score: g.score,
    attempt: attempt.attemptNo as 1 | 2,
    maxAttempts: assignment.maxAttempts,
    previousScore: attempt.attemptNo > 1 ? (first?.score ?? undefined) : undefined,
    stars: attemptStars(attempt.attemptNo, g.score),
    parentComment: attempt.feedback ?? "",
    durationMinutes: attempt.durationSeconds !== null ? Math.max(1, Math.round(attempt.durationSeconds / 60)) : undefined,
    timeLimitMinutes: assignment.timeLimitMinutes ?? undefined,
    canRetry: latest?.id === attempt.id && state.canRetry,
    answersRevealed,
    hintsPending:
      !answersRevealed && answers.some((a) => a.isCorrect === false && !a.hint && needsHint(a.question)),
    review: answers.map((row) => {
      const correct = row.isCorrect === true
      // A word's spelling is no secret: the retry starts with study cards that show every word.
      const word = row.question.type === "tu-vung" ? row.question.word : undefined
      return {
        word,
        id: row.id,
        prompt: row.question.prompt,
        answer: answerText(row.question, row.response, attempt.mode),
        correct,
        correctAnswer: correct || (!answersRevealed && !word) ? undefined : correctAnswerText(row.question),
        solution: answersRevealed ? row.question.solution : undefined,
        solutionImage: answersRevealed ? row.question.solutionImage : undefined,
        solutionImageUrl: answersRevealed ? row.question.solutionImageUrl : undefined,
        comment: row.comment ?? undefined,
        hint: correct ? undefined : (row.hint ?? undefined),
        image: row.question.image,
        imageUrl: row.question.imageUrl,
        handwriting: handwritingOf(row.response),
        ...blankFields(row, attempt.mode !== "paper", answersRevealed),
        ...(row.question.group ? { group: row.question.group, points: { awarded: row.pointsAwarded ?? 0, max: row.question.points } } : {}),
      }
    }),
  }
}

/** Per-blank result fields: marks for an unsplit fill-blank question, the slot of a blank câu. Paper work has no typed words. */
function blankFields(row: AnswerRecord, web: boolean, showKeys: boolean): Pick<ReviewItem, "blanks" | "blankSlot"> {
  const q = row.question
  if (web && q.type === "dien-cho-trong" && q.answers.length >= 2) {
    return { blanks: blankMarks(q, row.response, { isCorrect: row.isCorrect, pointsAwarded: row.pointsAwarded }, showKeys) }
  }
  if (q.type === "tra-loi-ngan" && q.blank) {
    if (!web) return { blankSlot: { index: q.blank, correct: null } }
    const given = typeof row.response === "string" ? row.response.trim() : ""
    return { blankSlot: { index: q.blank, ...(given ? { given } : {}), correct: row.isCorrect } }
  }
  return {}
}

/** Wrong answers that get an AI hint while a retry is open: not essays, handwritten words or questions without a key. */
export function needsHint(q: Question): boolean {
  return q.type !== "tu-luan" && q.type !== "tu-vung" && q.answerStatus !== "missing"
}

function handwritingOf(response: Response | null): ReviewItem["handwriting"] {
  const ink = essayInk(response)
  if (ink) return { ink }
  const drawing = essayDrawing(response)
  return drawing ? { drawing } : undefined
}

/* ---------- Taking an assignment ---------- */

/** Fields no question sent to the child while taking may carry. */
type KeyInfo = "solution" | "solutionImage" | "solutionImageUrl" | "answerStatus"

/** A question as sent to the browser while taking: answer keys and solutions removed. */
export type TakeQuestion =
  | (Omit<MultipleChoiceQuestion, "correctIndex" | "correctIndexes" | KeyInfo> & { multi?: true })
  | Omit<TrueFalseQuestion, "answer" | KeyInfo>
  | (Omit<FillBlankQuestion, "answers" | KeyInfo> & { blanks: number })
  | Omit<ShortAnswerQuestion, "answer" | KeyInfo>
  | Omit<Extract<Question, { type: "noi" }>, KeyInfo>
  | Omit<Extract<Question, { type: "sap-xep" }>, KeyInfo>
  | Omit<EssayQuestion, "rubric" | KeyInfo>
  /** Keeps `word`: the device reads it aloud and shows it on the study cards (never while writing). */
  | Omit<VocabQuestion, KeyInfo>

function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Omit<T, K>
}

export function toTakeQuestion(question: Question): TakeQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Dropping the solution and answer status
  const { solution: _solution, solutionImage: _image, solutionImageUrl: _imageUrl, answerStatus: _status, ...q } = question
  switch (q.type) {
    case "trac-nghiem": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Dropping the answer key
      const { correctIndex: _index, correctIndexes: _indexes, ...rest } = q
      return isMultiAnswer(q) ? { ...rest, multi: true } : rest
    }
    case "dung-sai":
      return without(q, "answer")
    case "tra-loi-ngan":
      return without(q, "answer")
    case "dien-cho-trong":
      return { ...without(q, "answers"), blanks: q.answers.length }
    case "tu-luan":
      return without(q, "rubric")
    default:
      return q
  }
}

const FEEDBACK: [number, string][] = [
  [10, "Tuyệt vời! Con làm đúng hết rồi 🌟"],
  [9, "Rất tốt! Con làm gần như đúng hết."],
  [8, "Giỏi lắm! Chỉ cần cẩn thận thêm một chút."],
  [6.5, "Khá tốt, con xem lại những câu sai nhé."],
  [5, "Con cố lên nhé! Xem lại các câu sai rồi thử lần nữa."],
  [0, "Không sao đâu, mình ôn lại rồi làm lại nhé!"],
]

/** Short friendly message stored with auto-graded attempts. */
export const autoFeedback = (score: number) => FEEDBACK.find(([min]) => score >= min)![1]
