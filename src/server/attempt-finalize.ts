import "server-only"
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { cache } from "react"
import { db, schema } from "@/db"
import { gradeAttempt, type Response } from "@/lib/grading"
import { SUBMIT_GRACE_SECONDS, deadlineOf } from "@/lib/timer"
import type { Question } from "@/lib/types"
import { autoFeedback } from "@/lib/views/student"

/*
 * Handing in attempts: the normal submit and timed attempts whose time ran out.
 * Kept apart from server/queries.ts (which awaits settleExpiredAttempts before
 * reading attempts) so the two modules don't import each other.
 */

const { assignments, attempts, answers, questions } = schema

/** Answer rows with a snapshot of each question as stored in the database. */
export function answerRows(attemptId: string, qs: Question[], responses: Record<string, Response>, onlyAnswered: boolean) {
  return qs
    .map((q, position) => ({ attemptId, questionId: q.id, position, question: q, response: responses[q.id] ?? null }))
    .filter((row) => !onlyAnswered || row.response !== null)
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function savedResponses(tx: Tx, attemptId: string): Promise<Record<string, Response>> {
  const rows = await tx
    .select({ questionId: answers.questionId, response: answers.response })
    .from(answers)
    .where(and(eq(answers.attemptId, attemptId), isNotNull(answers.response)))
  return Object.fromEntries(rows.map((r) => [r.questionId, r.response as Response]))
}

/**
 * Grades and closes an open attempt, with these answers or the ones saved so far.
 * The attempt row is locked first, so a racing autosave, submit or expiry sweep
 * waits and then finds it closed (closed: false) instead of overwriting answers.
 */
export async function closeAttempt(input: {
  attemptId: string
  questions: Question[]
  responses: Record<string, Response> | "saved"
  submittedAt: Date
  durationSeconds: number | null
  /** Handed in offline and synced now; a changed set leaves every answer for the parent. */
  offline?: { offlineId: string; setChanged: boolean }
  /** Replaces the answers of an attempt the expiry sweep already handed in (offline copy arrived late). */
  reopen?: boolean
  /** Handed in by the expiry sweep. */
  autoSettled?: boolean
}): Promise<{ closed: boolean; graded: boolean; score: number | null }> {
  const { attemptId, submittedAt, questions: qs, offline } = input
  return db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), input.reopen ? undefined : isNull(attempts.submittedAt)))
      .for("update")
    if (!open) return { closed: false, graded: false, score: null }
    const marks = {
      ...(input.reopen ? { gradedAt: null, gradedBy: null, score: null, feedback: null, autoSettled: false } : {}),
      ...(input.autoSettled ? { autoSettled: true } : {}),
      ...(offline ? { offlineId: offline.offlineId, submittedOffline: true, offlineSetChanged: offline.setChanged } : {}),
    }
    if (!qs.length) {
      // A set emptied after the attempt started: just close it.
      await tx.update(attempts).set({ ...marks, submittedAt, durationSeconds: input.durationSeconds }).where(eq(attempts.id, attemptId))
      return { closed: true, graded: false, score: null }
    }
    const responses = input.responses === "saved" ? await savedResponses(tx, attemptId) : input.responses
    const grade = gradeAttempt(qs, responses)
    // The child answered an older version of the set: the parent grades it by hand.
    const auto = !grade.needsReview && !offline?.setChanged
    await tx
      .update(attempts)
      .set({
        ...marks,
        submittedAt,
        durationSeconds: input.durationSeconds,
        ...(auto ? { gradedAt: submittedAt, gradedBy: "auto" as const, score: grade.score, feedback: autoFeedback(grade.score ?? 0) } : {}),
      })
      .where(eq(attempts.id, attemptId))
    await tx.delete(answers).where(eq(answers.attemptId, attemptId))
    await tx.insert(answers).values(
      answerRows(attemptId, qs, responses, false).map((r, i) => ({
        ...r,
        isCorrect: offline?.setChanged ? null : grade.grades[i].isCorrect,
        pointsAwarded: offline?.setChanged ? null : grade.grades[i].pointsAwarded,
      })),
    )
    return { closed: true, graded: auto, score: auto ? grade.score : null }
  })
}

/** Hands in a timed attempt as saved, at its deadline, with the full limit as its duration. */
export async function settleAttempt(a: { id: string; setId: string; startedAt: Date; timeLimitMinutes: number }): Promise<void> {
  const questionRows = await db.select().from(questions).where(eq(questions.setId, a.setId)).orderBy(asc(questions.position))
  await closeAttempt({
    attemptId: a.id,
    questions: questionRows.map((r) => ({ ...r.content, id: r.id }) as Question),
    responses: "saved",
    submittedAt: deadlineOf(a.startedAt, a.timeLimitMinutes),
    durationSeconds: a.timeLimitMinutes * 60,
    // An offline copy of this attempt may still arrive and replace these answers (see syncOfflineAttempt).
    autoSettled: true,
  })
}

/**
 * Hands in every timed attempt whose time (plus grace) ran out, e.g. because the
 * child closed the app mid-way. Runs before attempts are read, once per request.
 */
export const settleExpiredAttempts = cache(async (): Promise<void> => {
  const expired = await db
    .select({ id: attempts.id, setId: assignments.setId, startedAt: attempts.startedAt, timeLimitMinutes: assignments.timeLimitMinutes })
    .from(attempts)
    .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
    .where(
      and(
        isNull(attempts.submittedAt),
        isNotNull(assignments.timeLimitMinutes),
        sql`${attempts.startedAt} + ${assignments.timeLimitMinutes} * interval '1 minute' + ${SUBMIT_GRACE_SECONDS} * interval '1 second' < now()`,
      ),
    )
  for (const a of expired) {
    // One broken attempt must not take every page down with it; the next request retries it.
    try {
      await settleAttempt({ ...a, timeLimitMinutes: a.timeLimitMinutes! })
    } catch (e) {
      console.error(`Could not hand in expired attempt ${a.id}`, e)
    }
  }
})
