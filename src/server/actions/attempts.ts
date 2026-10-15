"use server"

import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "@/db"
import type { Response } from "@/lib/grading"
import { inkSchema } from "@/lib/ink"
import { deadlineOf, isExpired, mergeActiveSeconds, timedDuration } from "@/lib/timer"
import { canTake, stateOf } from "@/lib/views/student"
import { runAction, type ActionResult } from "@/lib/action-result"
import { assertAccess } from "../access"
import { answerRows, closeAttempt, settleAttempt } from "../attempt-finalize"
import { getAssignment, getQuestions, isUuid, type AssignmentRecord, type AttemptRecord } from "../queries"
import { createUploadTargets, isUploaded, type UploadTarget } from "../storage"
import type { NewFile } from "./library"

/*
 * The student's side of an assignment: autosaving a draft, submitting web
 * work (auto-graded here, never in the browser) and handing in paper work.
 *
 * These actions don't call refresh(): the take/paper pages leave the route
 * themselves after their closing animation and refresh the router then.
 */

const { attempts, answers, attachments } = schema

/** `expired`: the timed attempt is already handed in (time ran out, or an earlier submit got through); leave the page. */
type Result<T> = ({ ok: true } & T) | { ok: false; error: string; expired?: boolean }

const MAX_RESPONSE_CHARS = 2_000_000

/** Loose shapes of what the question components store (see lib/grading.ts). */
const responseSchema = z.union([
  z.number(),
  z.boolean(),
  z.string().max(5000),
  z.array(z.union([z.string().max(500), z.number()])).max(100),
  z.record(z.string().max(4), z.number()),
  z.object({ text: z.string().max(20_000), drawing: z.string().startsWith("data:image/").optional(), ink: inkSchema.optional() }),
])

const responsesSchema = z
  .record(z.string(), responseSchema.nullable())
  .refine((r) => Object.keys(r).length <= 300, "Quá nhiều câu trả lời")
  .refine((r) => JSON.stringify(r).length <= MAX_RESPONSE_CHARS, "Bài làm quá lớn")

const ERR_CLOSED = "Bài này không làm tiếp được nữa."
const ERR_TIME_UP = "Đã hết giờ làm bài. Bài của em đã được nộp."
const ERR_HANDED_IN = "Bài của em đã được nộp."

/** Access check for the Result-returning actions: a refusal (PIN, lock) becomes an error result. */
async function studentGate(): Promise<{ ok: false; error: string } | null> {
  try {
    await assertAccess("student")
    return null
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Cần mã PIN để tiếp tục." }
  }
}

function parseResponses(input: unknown): Record<string, Response> | null {
  const parsed = responsesSchema.safeParse(input)
  if (!parsed.success) return null
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== null)) as Record<string, Response>
}

async function loadWebAssignment(assignmentId: string): Promise<{ record: AssignmentRecord } | { error: string }> {
  if (!isUuid(assignmentId)) return { error: "Không tìm thấy bài." }
  const record = await getAssignment(assignmentId)
  if (!record) return { error: "Không tìm thấy bài." }
  if (record.mode !== "web") return { error: "Bài này làm trên giấy." }
  return { record }
}

/**
 * The attempt the student is working on: the open draft, or a new attempt
 * (next number) when the assignment is not started or a retry is allowed.
 * Timed assignments only get a new attempt from startAttempt ("Bắt đầu"), so a
 * late autosave can never open the retry after time ran out.
 */
async function openAttempt(record: AssignmentRecord, { create }: { create: boolean }): Promise<AttemptRecord | null> {
  const latest = record.attempts.at(-1)
  if (latest && !latest.submittedAt) return latest
  if (!create) return null
  const state = stateOf(record, new Date())
  if (!canTake(state)) return null
  const attemptNo = (latest?.attemptNo ?? 0) + 1
  if (attemptNo > record.maxAttempts) return null
  const [created] = await db
    .insert(attempts)
    .values({ assignmentId: record.id, attemptNo, mode: record.mode })
    .onConflictDoNothing({ target: [attempts.assignmentId, attempts.attemptNo] })
    .returning()
  if (created) return created
  // Another request created it first.
  const existing = await db.query.attempts.findFirst({
    where: and(eq(attempts.assignmentId, record.id), eq(attempts.attemptNo, attemptNo), isNull(attempts.submittedAt)),
  })
  return existing ?? null
}

/** Handed in by the timer: the stored duration is the whole limit. */
const timedOut = (attempt: AttemptRecord | undefined, limit: number) =>
  Boolean(attempt?.submittedAt && attempt.durationSeconds !== null && attempt.durationSeconds >= limit * 60)

/**
 * The attempt a save or submit writes to. A timed attempt past its deadline
 * (plus grace) is handed in as saved instead, and the caller is told so.
 */
async function writableAttempt(record: AssignmentRecord): Promise<{ attempt: AttemptRecord } | { error: string; expired?: true }> {
  const limit = record.timeLimitMinutes
  const attempt = await openAttempt(record, { create: limit === null })
  if (!attempt) {
    // getAssignment already handed in the expired attempt: tell the page time is up.
    // A timed attempt is already handed in (by the timer, or a submit whose reply was lost): leave the take page.
    const latest = record.attempts.at(-1)
    if (limit !== null && latest?.submittedAt) return { error: timedOut(latest, limit) ? ERR_TIME_UP : ERR_HANDED_IN, expired: true }
    return { error: ERR_CLOSED }
  }
  if (limit !== null && isExpired(attempt.startedAt, limit, new Date())) {
    await settleAttempt({ id: attempt.id, setId: record.setId, startedAt: attempt.startedAt, timeLimitMinutes: limit })
    return { error: ERR_TIME_UP, expired: true }
  }
  return { attempt }
}

/** "Bắt đầu" on a timed assignment: starts (or resumes) the attempt and returns its deadline. */
export async function startAttempt(assignmentId: string): Promise<Result<{ deadline: string; serverNow: string }>> {
  const denied = await studentGate()
  if (denied) return denied
  const loaded = await loadWebAssignment(assignmentId)
  if ("error" in loaded) return { ok: false, error: loaded.error }
  const limit = loaded.record.timeLimitMinutes
  if (limit === null) return { ok: false, error: "Bài này không giới hạn thời gian." }
  const attempt = await openAttempt(loaded.record, { create: true })
  if (!attempt) return { ok: false, error: ERR_CLOSED }
  const now = new Date()
  if (isExpired(attempt.startedAt, limit, now)) {
    await settleAttempt({ id: attempt.id, setId: loaded.record.setId, startedAt: attempt.startedAt, timeLimitMinutes: limit })
    return { ok: false, error: ERR_TIME_UP, expired: true }
  }
  return { ok: true, deadline: deadlineOf(attempt.startedAt, limit).toISOString(), serverNow: now.toISOString() }
}

/**
 * Autosave: replaces the draft's answers. Creates an untimed attempt on first
 * save; `activeSeconds` is the untimed work time so far (ignored when timed).
 */
export async function saveDraft(assignmentId: string, responses: Record<string, unknown>, activeSeconds?: number): Promise<Result<{ attemptId: string }>> {
  const denied = await studentGate()
  if (denied) return denied
  const parsed = parseResponses(responses)
  if (!parsed) return { ok: false, error: "Bài làm không hợp lệ." }
  const loaded = await loadWebAssignment(assignmentId)
  if ("error" in loaded) return { ok: false, error: loaded.error }
  const open = await writableAttempt(loaded.record)
  if ("error" in open) return { ok: false, error: open.error, expired: open.expired }
  const attemptId = open.attempt.id
  const timed = loaded.record.timeLimitMinutes !== null

  const questions = await getQuestions(loaded.record.setId)
  const rows = answerRows(attemptId, questions, parsed, true)
  await db.transaction(async (tx) => {
    // Re-check inside the transaction so a late autosave can't rewrite a submitted attempt.
    const [row] = await tx
      .select({ id: attempts.id, durationSeconds: attempts.durationSeconds })
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), isNull(attempts.submittedAt)))
      .for("update")
    if (!row) return
    if (!timed) await tx.update(attempts).set({ durationSeconds: mergeActiveSeconds(row.durationSeconds, activeSeconds) }).where(eq(attempts.id, attemptId))
    await tx.delete(answers).where(eq(answers.attemptId, attemptId))
    if (rows.length) await tx.insert(answers).values(rows)
  })
  return { ok: true, attemptId }
}

/** Hands in web work: saves every answer, grades on the server and closes the attempt. */
export async function submitAttempt(
  assignmentId: string,
  responses: Record<string, unknown>,
  durationSeconds: number,
): Promise<Result<{ attemptId: string; graded: boolean; score: number | null }>> {
  const denied = await studentGate()
  if (denied) return denied
  const parsed = parseResponses(responses)
  if (!parsed) return { ok: false, error: "Bài làm không hợp lệ." }
  const loaded = await loadWebAssignment(assignmentId)
  if ("error" in loaded) return { ok: false, error: loaded.error }
  const open = await writableAttempt(loaded.record)
  if ("error" in open) return { ok: false, error: open.error, expired: open.expired }
  const { attempt } = open

  const questions = await getQuestions(loaded.record.setId)
  if (!questions.length) return { ok: false, error: "Bài này chưa có câu hỏi." }
  const now = new Date()
  const limit = loaded.record.timeLimitMinutes
  // Timed: measured on the server. Untimed: the visible-page seconds the browser counted.
  const duration = limit !== null ? timedDuration(attempt.startedAt, limit, now) : mergeActiveSeconds(attempt.durationSeconds, durationSeconds)
  const result = await closeAttempt({ attemptId: attempt.id, questions, responses: parsed, submittedAt: now, durationSeconds: duration })
  // Lost a race with the expiry sweep (timed) or a double tap.
  if (!result.closed) return limit !== null ? { ok: false, error: ERR_HANDED_IN, expired: true } : { ok: false, error: "Bài này đã được nộp rồi." }
  return { ok: true, attemptId: attempt.id, graded: result.graded, score: result.score }
}

/* ---------- Paper work ---------- */

async function loadPaperAssignment(assignmentId: string) {
  if (!isUuid(assignmentId)) return null
  const record = await getAssignment(assignmentId)
  if (!record || record.mode !== "paper") return null
  return record
}

/** One-time upload URLs for photographed pages (stored under the assignment until the attempt exists). */
export async function requestAttemptUploads(assignmentId: string, names: string[]): Promise<ActionResult<UploadTarget[]>> {
  return runAction(async () => {
    await assertAccess("student")
    const record = await loadPaperAssignment(assignmentId)
    if (!record || !canTake(stateOf(record, new Date()))) throw new Error(ERR_CLOSED)
    return createUploadTargets("attempts", assignmentId, z.array(z.string().max(200)).max(30).parse(names))
  })
}

const newFilesSchema = z
  .array(
    z.object({
      path: z.string().min(1).max(500),
      name: z.string().min(1).max(200),
      kind: z.enum(["image", "pdf"]),
      sizeKb: z.number().int().min(0),
      pages: z.number().int().positive().optional(),
    }),
  )
  .min(1)
  .max(30)

/** Hands in paper work: a submitted attempt with empty answers (the parent marks them) and the page photos. */
export async function submitPaper(assignmentId: string, files: NewFile[]): Promise<Result<{ attemptId: string }>> {
  const denied = await studentGate()
  if (denied) return denied
  const parsed = newFilesSchema.safeParse(files)
  if (!parsed.success) return { ok: false, error: "Em cần chụp ít nhất một trang." }
  const record = await loadPaperAssignment(assignmentId)
  if (!record) return { ok: false, error: "Không tìm thấy bài." }
  const state = stateOf(record, new Date())
  const latest = record.attempts.at(-1)
  const attemptNo = (latest?.attemptNo ?? 0) + 1
  if (!canTake(state) || (latest && !latest.submittedAt) || attemptNo > record.maxAttempts) return { ok: false, error: ERR_CLOSED }
  for (const f of parsed.data) {
    if (!(await isUploaded("attempts", assignmentId, f.path))) return { ok: false, error: `Ảnh “${f.name}” chưa tải lên xong, em thử lại nhé.` }
  }

  const questions = await getQuestions(record.setId)
  const now = new Date()
  const attemptId = await db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(attempts)
      .values({ assignmentId, attemptNo, mode: "paper", startedAt: now, submittedAt: now })
      .onConflictDoNothing({ target: [attempts.assignmentId, attempts.attemptNo] })
      .returning({ id: attempts.id })
    if (!attempt) return null
    if (questions.length) await tx.insert(answers).values(answerRows(attempt.id, questions, {}, false).map((r) => ({ ...r, isCorrect: null })))
    await tx.insert(attachments).values(
      parsed.data.map((f, position) => ({ attemptId: attempt.id, name: f.name, kind: f.kind, sizeKb: f.sizeKb, pages: f.pages, storagePath: f.path, position })),
    )
    return attempt.id
  })
  if (!attemptId) return { ok: false, error: "Bài này đã được nộp rồi." }
  return { ok: true, attemptId }
}
