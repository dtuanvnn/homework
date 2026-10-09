import "server-only"
import { asc, eq, isNotNull, sql } from "drizzle-orm"
import { db, schema } from "@/db"
import type { QuestionType } from "@/lib/types"
import { buildGradingQueue, type GradingDetail } from "@/lib/views/grading"
import { getAttemptDetail, listAssignments, toAttachment } from "@/server/queries"

/*
 * Loaders of the grading screens. They could move to server/queries.ts; they
 * live here because only these pages use them.
 */

const { answers, attempts, attachments } = schema

export async function loadGradingQueue() {
  const [records, stats, scanRows] = await Promise.all([
    listAssignments(),
    db
      .select({ attemptId: answers.attemptId, isCorrect: answers.isCorrect, type: sql<QuestionType>`${answers.question}->>'type'` })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .where(isNotNull(attempts.submittedAt)),
    db.select().from(attachments).where(isNotNull(attachments.attemptId)).orderBy(asc(attachments.position)),
  ])
  // First scanned page of each attempt, as a thumbnail.
  const firstScans = [...Map.groupBy(scanRows, (r) => r.attemptId!).values()].map((rows) => rows[0])
  const scanUrls = new Map(
    await Promise.all(firstScans.map(async (r) => [r.attemptId!, (await toAttachment(r)).url] as const)),
  )
  return buildGradingQueue(records, stats, scanUrls)
}

export async function loadGradingDetail(attemptId: string): Promise<GradingDetail | null> {
  const detail = await getAttemptDetail(attemptId)
  if (!detail?.attempt.submittedAt) return null
  const { attempt, assignment, scans } = detail
  return {
    attemptId: attempt.id,
    assignmentId: assignment.id,
    subject: assignment.set.subject,
    title: assignment.set.title,
    attemptNo: attempt.attemptNo as 1 | 2,
    maxAttempts: assignment.maxAttempts,
    mode: attempt.mode,
    submittedAt: attempt.submittedAt!.toISOString(),
    gradedAt: attempt.gradedAt?.toISOString() ?? null,
    gradedBy: attempt.gradedBy,
    durationSeconds: attempt.durationSeconds,
    feedback: attempt.feedback ?? "",
    retryAllowed: attempt.retryAllowed,
    retryUsed: assignment.attempts.some((t) => t.attemptNo > attempt.attemptNo),
    answers: detail.answers.map((a) => ({
      id: a.id,
      position: a.position,
      question: a.question,
      response: a.response,
      isCorrect: a.isCorrect,
      pointsAwarded: a.pointsAwarded,
      comment: a.comment,
    })),
    scans,
  }
}
