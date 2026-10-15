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

/**
 * Grades and closes an open attempt with these answers. Does nothing (closed:
 * false) when the attempt was already handed in, so racing callers are safe.
 */
export async function closeAttempt(input: {
  attemptId: string
  questions: Question[]
  responses: Record<string, Response>
  submittedAt: Date
  durationSeconds: number | null
}): Promise<{ closed: boolean; graded: boolean; score: number | null }> {
  const { attemptId, submittedAt } = input
  const grade = gradeAttempt(input.questions, input.responses)
  const closed = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(attempts)
      .set({
        submittedAt,
        durationSeconds: input.durationSeconds,
        ...(grade.needsReview ? {} : { gradedAt: submittedAt, gradedBy: "auto" as const, score: grade.score, feedback: autoFeedback(grade.score ?? 0) }),
      })
      .where(and(eq(attempts.id, attemptId), isNull(attempts.submittedAt)))
      .returning({ id: attempts.id })
    if (!row) return false
    await tx.delete(answers).where(eq(answers.attemptId, attemptId))
    await tx.insert(answers).values(
      answerRows(attemptId, input.questions, input.responses, false).map((r, i) => ({
        ...r,
        isCorrect: grade.grades[i].isCorrect,
        pointsAwarded: grade.grades[i].pointsAwarded,
      })),
    )
    return true
  })
  return { closed, graded: !grade.needsReview, score: grade.score }
}

/** Hands in a timed attempt as saved, at its deadline, with the full limit as its duration. */
export async function settleAttempt(a: { id: string; setId: string; startedAt: Date; timeLimitMinutes: number }): Promise<void> {
  const [questionRows, saved] = await Promise.all([
    db.select().from(questions).where(eq(questions.setId, a.setId)).orderBy(asc(questions.position)),
    db
      .select({ questionId: answers.questionId, response: answers.response })
      .from(answers)
      .where(and(eq(answers.attemptId, a.id), isNotNull(answers.response))),
  ])
  if (!questionRows.length) return
  await closeAttempt({
    attemptId: a.id,
    questions: questionRows.map((r) => ({ ...r.content, id: r.id }) as Question),
    responses: Object.fromEntries(saved.map((r) => [r.questionId, r.response as Response])),
    submittedAt: deadlineOf(a.startedAt, a.timeLimitMinutes),
    durationSeconds: a.timeLimitMinutes * 60,
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
  for (const a of expired) await settleAttempt({ ...a, timeLimitMinutes: a.timeLimitMinutes! })
})
