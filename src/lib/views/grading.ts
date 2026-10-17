/**
 * View models of the grading screens ("Chấm bài"). Pure functions: the server
 * pages feed them database rows, tests feed them plain objects.
 */
import { OPTION_LETTERS } from "../questions"
import type { EssayValue, Response } from "../grading"
import { inkSchema, isInkEmpty, type Ink } from "../ink"
import { answerAsRichText } from "../rich-text"
import type { Attachment, Question, QuestionType, SubjectId } from "../types"

/* ---------- Queue ---------- */

export interface QueueAttempt {
  id: string
  attemptNo: number
  mode: "web" | "paper"
  submittedAt: Date | null
  gradedAt: Date | null
  score: number | null
  feedback: string | null
  retryAllowed: boolean
  /** Handed in on the child's device without network, synced later. */
  submittedOffline?: boolean
}

export interface QueueAssignment {
  id: string
  maxAttempts: number
  set: { id: string; title: string; subject: SubjectId }
  /** Any order. */
  attempts: QueueAttempt[]
}

export interface AnswerStat {
  attemptId: string
  type: QuestionType
  /** null = waits for the parent. */
  isCorrect: boolean | null
}

export interface GradingQueueItem {
  attemptId: string
  assignmentId: string
  setId: string
  subject: SubjectId
  title: string
  attemptNo: 1 | 2
  maxAttempts: 1 | 2
  mode: "web" | "paper"
  submittedAt: string
  gradedAt: string | null
  /** Submitted, not graded yet. */
  awaiting: boolean
  totalQuestions: number
  /** Auto-graded objective answers marked correct. */
  autoCorrect: number
  /** Auto-graded objective answers marked wrong. */
  autoWrong: number
  /** Answers the parent still has to mark. */
  ungraded: number
  scanUrl?: string
  score: number | null
  feedback: string | null
  /** Graded latest attempt whose second try is allowed but not started yet. */
  retryPending: boolean
  /** "Nộp offline": handed in without network and synced later. */
  submittedOffline: boolean
}

/** Submitted attempts, newest submission first. */
export function buildGradingQueue(
  assignments: QueueAssignment[],
  answers: AnswerStat[],
  scanUrls: Map<string, string | undefined> = new Map(),
): GradingQueueItem[] {
  const byAttempt = Map.groupBy(answers, (a) => a.attemptId)
  const items: GradingQueueItem[] = []
  for (const assignment of assignments) {
    const latestNo = Math.max(0, ...assignment.attempts.map((t) => t.attemptNo))
    for (const t of assignment.attempts) {
      if (!t.submittedAt) continue
      const rows = byAttempt.get(t.id) ?? []
      const objective = rows.filter((r) => r.type !== "tu-luan" && r.isCorrect !== null)
      const graded = t.gradedAt !== null
      items.push({
        attemptId: t.id,
        assignmentId: assignment.id,
        setId: assignment.set.id,
        subject: assignment.set.subject,
        title: assignment.set.title,
        attemptNo: t.attemptNo as 1 | 2,
        maxAttempts: assignment.maxAttempts as 1 | 2,
        mode: t.mode,
        submittedAt: t.submittedAt.toISOString(),
        gradedAt: t.gradedAt?.toISOString() ?? null,
        awaiting: !graded,
        totalQuestions: rows.length,
        autoCorrect: objective.filter((r) => r.isCorrect).length,
        autoWrong: objective.filter((r) => !r.isCorrect).length,
        ungraded: rows.filter((r) => r.isCorrect === null).length,
        scanUrl: scanUrls.get(t.id),
        score: graded ? t.score : null,
        feedback: t.feedback,
        retryPending: graded && t.attemptNo === latestNo && t.retryAllowed && t.attemptNo < assignment.maxAttempts,
        submittedOffline: t.submittedOffline ?? false,
      })
    }
  }
  return items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

/* ---------- Detail ---------- */

export interface GradingAnswer {
  id: string
  position: number
  question: Question
  response: Response | null
  isCorrect: boolean | null
  pointsAwarded: number | null
  comment: string | null
}

export interface GradingDetail {
  attemptId: string
  assignmentId: string
  subject: SubjectId
  title: string
  attemptNo: 1 | 2
  maxAttempts: 1 | 2
  mode: "web" | "paper"
  submittedAt: string
  gradedAt: string | null
  gradedBy: "auto" | "ai" | "parent" | null
  durationSeconds: number | null
  /** Exam mode limit of the assignment. */
  timeLimitMinutes: number | null
  feedback: string
  retryAllowed: boolean
  /** A later attempt exists, so the retry choice is already used. */
  retryUsed: boolean
  answers: GradingAnswer[]
  scans: Attachment[]
  /** "Nộp offline": handed in without network and synced later. */
  submittedOffline: boolean
  /** The set was edited after the child downloaded it, so nothing was auto-graded. */
  offlineSetChanged: boolean
}

/** Points the parent can pick for a question: 0 … max in quarter (≤ 2 points) or half steps. */
export function pointStep(max: number): number {
  return max <= 2 ? 0.25 : 0.5
}

/** Moves `current` by one step, clamped to 0 … max. Starts from 0 when ungraded. */
export function stepPoints(current: number | null, max: number, direction: 1 | -1): number {
  const step = pointStep(max)
  const base = current ?? 0
  const next = direction > 0 ? Math.floor(base / step + 1e-9) * step + step : Math.ceil(base / step - 1e-9) * step - step
  return Math.round(Math.min(max, Math.max(0, next)) * 100) / 100
}

export interface AnswerMark {
  isCorrect: boolean | null
  pointsAwarded: number | null
}

/** Live total of a grading form on the 10-point-scale inputs. */
export function markedTotals(answers: { question: Question }[], marks: AnswerMark[]) {
  const total = answers.reduce((sum, a) => sum + a.question.points, 0)
  const awarded = marks.reduce((sum, m) => sum + (m.pointsAwarded ?? 0), 0)
  const remaining = marks.filter((m) => m.isCorrect === null || m.pointsAwarded === null).length
  return { total, awarded: Math.round(awarded * 100) / 100, remaining }
}

/* ---------- Readable answers ---------- */

const NO_ANSWER = "(Chưa trả lời)"
const optionLabel = (q: { options: string[] }, i: number) => `${OPTION_LETTERS[i] ?? i + 1}. ${q.options[i] ?? "?"}`

/** The expected answer, written for the parent. */
export function correctAnswerText(q: Question): string {
  if (q.answerStatus === "missing" && q.type !== "tu-luan") return "Chưa có đáp án – phụ huynh tự đối chiếu"
  switch (q.type) {
    case "trac-nghiem":
      return optionLabel(q, q.correctIndex)
    case "dung-sai":
      return q.answer ? "Đúng" : "Sai"
    case "dien-cho-trong":
      return q.answers.map((a) => answerAsRichText(q, a)).join(" · ")
    case "tra-loi-ngan":
      return answerAsRichText(q, q.answer)
    case "noi":
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ")
    case "sap-xep":
      return q.tokens.join(" ")
    case "tu-luan":
      return q.rubric.trim() || "Phụ huynh tự đánh giá"
  }
}

export function isEssayValue(value: unknown): value is EssayValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && ("text" in value || "drawing" in value || "ink" in value)
}

/** The child's answer, written for the parent. Essays only return their text. */
export function responseText(q: Question, response: Response | null | undefined): string {
  if (response === null || response === undefined) return NO_ANSWER
  switch (q.type) {
    case "trac-nghiem":
      return typeof response === "number" ? optionLabel(q, response) : NO_ANSWER
    case "dung-sai":
      return typeof response === "boolean" ? (response ? "Đúng" : "Sai") : NO_ANSWER
    case "dien-cho-trong":
      return Array.isArray(response)
        ? q.answers
            .map((_, i) => {
              const text = String(response[i] ?? "").trim()
              return text ? answerAsRichText(q, text) : "(trống)"
            })
            .join(" · ")
        : NO_ANSWER
    case "tra-loi-ngan":
      return typeof response === "string" && response.trim() ? answerAsRichText(q, response.trim()) : NO_ANSWER
    case "noi": {
      if (typeof response !== "object" || Array.isArray(response) || isEssayValue(response)) return NO_ANSWER
      const map = response as Record<string, number>
      const lines = q.pairs.flatMap((p, i) => (map[String(i)] === undefined ? [] : [`${p.left} → ${q.pairs[map[String(i)]]?.right ?? "?"}`]))
      return lines.length ? lines.join(" · ") : NO_ANSWER
    }
    case "sap-xep":
      return Array.isArray(response) && response.length ? (response as number[]).map((i) => q.tokens[i] ?? "?").join(" ") : NO_ANSWER
    case "tu-luan": {
      if (!isEssayValue(response)) return NO_ANSWER
      // A handwriting-only essay has no text; the handwriting is shown instead.
      return response.text?.trim() || (response.drawing || essayInk(response) ? "" : NO_ANSWER)
    }
  }
}

/** Handwriting image of an essay answer, only when it is an inline PNG/JPEG data URL. */
export function essayDrawing(response: Response | null | undefined): string | undefined {
  if (!isEssayValue(response) || !response.drawing) return undefined
  return /^data:image\/(png|jpeg|webp);base64,/.test(response.drawing) ? response.drawing : undefined
}

/** Handwriting pages of an essay answer, only when they are valid and not blank. */
export function essayInk(response: Response | null | undefined): Ink | undefined {
  if (!isEssayValue(response) || !response.ink) return undefined
  const parsed = inkSchema.safeParse(response.ink)
  return parsed.success && !isInkEmpty(parsed.data) ? parsed.data : undefined
}
