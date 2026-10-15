"use server"

import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "@/db"
import { gradeAttempt, type Response } from "@/lib/grading"
import { inkSchema } from "@/lib/ink"
import type { Question } from "@/lib/types"
import { autoFeedback, canTake, stateOf } from "@/lib/views/student"
import { runAction, type ActionResult } from "@/lib/action-result"
import { assertAccess } from "../access"
import { getAssignment, getQuestions, isUuid, type AssignmentRecord } from "../queries"
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

type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

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
 */
async function openAttempt(record: AssignmentRecord): Promise<string | null> {
  const latest = record.attempts.at(-1)
  if (latest && !latest.submittedAt) return latest.id
  const state = stateOf(record, new Date())
  if (!canTake(state)) return null
  const attemptNo = (latest?.attemptNo ?? 0) + 1
  if (attemptNo > record.maxAttempts) return null
  const [created] = await db
    .insert(attempts)
    .values({ assignmentId: record.id, attemptNo, mode: record.mode })
    .onConflictDoNothing({ target: [attempts.assignmentId, attempts.attemptNo] })
    .returning({ id: attempts.id })
  if (created) return created.id
  // Another request created it first.
  const existing = await db.query.attempts.findFirst({
    where: and(eq(attempts.assignmentId, record.id), eq(attempts.attemptNo, attemptNo), isNull(attempts.submittedAt)),
  })
  return existing?.id ?? null
}

/** Answer rows with a snapshot of each question as stored in the database. */
function answerRows(attemptId: string, questions: Question[], responses: Record<string, Response>, onlyAnswered: boolean) {
  return questions
    .map((q, position) => ({ attemptId, questionId: q.id, position, question: q, response: responses[q.id] ?? null }))
    .filter((row) => !onlyAnswered || row.response !== null)
}

/** Autosave: replaces the draft's answers. Creates the attempt on first save. */
export async function saveDraft(assignmentId: string, responses: Record<string, unknown>): Promise<Result<{ attemptId: string }>> {
  await assertAccess("student")
  const parsed = parseResponses(responses)
  if (!parsed) return { ok: false, error: "Bài làm không hợp lệ." }
  const loaded = await loadWebAssignment(assignmentId)
  if ("error" in loaded) return { ok: false, error: loaded.error }
  const attemptId = await openAttempt(loaded.record)
  if (!attemptId) return { ok: false, error: ERR_CLOSED }

  const questions = await getQuestions(loaded.record.setId)
  const rows = answerRows(attemptId, questions, parsed, true)
  await db.transaction(async (tx) => {
    // Re-check inside the transaction so a late autosave can't rewrite a submitted attempt.
    const [open] = await tx.select({ id: attempts.id }).from(attempts).where(and(eq(attempts.id, attemptId), isNull(attempts.submittedAt))).for("update")
    if (!open) return
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
  await assertAccess("student")
  const parsed = parseResponses(responses)
  if (!parsed) return { ok: false, error: "Bài làm không hợp lệ." }
  const loaded = await loadWebAssignment(assignmentId)
  if ("error" in loaded) return { ok: false, error: loaded.error }
  const attemptId = await openAttempt(loaded.record)
  if (!attemptId) return { ok: false, error: ERR_CLOSED }

  const questions = await getQuestions(loaded.record.setId)
  if (!questions.length) return { ok: false, error: "Bài này chưa có câu hỏi." }
  const grade = gradeAttempt(questions, parsed)
  const now = new Date()
  const duration = Number.isFinite(durationSeconds) ? Math.min(Math.max(Math.round(durationSeconds), 0), 6 * 3600) : null

  const submitted = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(attempts)
      .set({
        submittedAt: now,
        durationSeconds: duration,
        ...(grade.needsReview ? {} : { gradedAt: now, gradedBy: "auto" as const, score: grade.score, feedback: autoFeedback(grade.score ?? 0) }),
      })
      .where(and(eq(attempts.id, attemptId), isNull(attempts.submittedAt)))
      .returning({ id: attempts.id })
    if (!row) return false
    await tx.delete(answers).where(eq(answers.attemptId, attemptId))
    await tx.insert(answers).values(
      answerRows(attemptId, questions, parsed, false).map((r, i) => ({
        ...r,
        isCorrect: grade.grades[i].isCorrect,
        pointsAwarded: grade.grades[i].pointsAwarded,
      })),
    )
    return true
  })
  if (!submitted) return { ok: false, error: "Bài này đã được nộp rồi." }
  return { ok: true, attemptId, graded: !grade.needsReview, score: grade.score }
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
  await assertAccess("student")
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
