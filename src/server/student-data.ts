import "server-only"
import { and, count, eq, inArray, isNotNull } from "drizzle-orm"
import { db, schema } from "@/db"
import type { Response } from "@/lib/grading"
import type { DraftCounts } from "@/lib/views/student"
import type { AssignmentRecord } from "./queries"

const { answers } = schema

/** Saved-answer counts of the unsubmitted (draft) attempts among these assignments. */
export async function getDraftCounts(records: AssignmentRecord[]): Promise<DraftCounts> {
  const ids = records.flatMap((r) => {
    const latest = r.attempts.at(-1)
    return latest && !latest.submittedAt ? [latest.id] : []
  })
  if (!ids.length) return {}
  const rows = await db
    .select({ attemptId: answers.attemptId, n: count() })
    .from(answers)
    .where(and(inArray(answers.attemptId, ids), isNotNull(answers.response)))
    .groupBy(answers.attemptId)
  return Object.fromEntries(rows.map((r) => [r.attemptId, r.n]))
}

/** Responses saved in a draft attempt, keyed by question id. */
export async function getDraftResponses(attemptId: string): Promise<Record<string, Response>> {
  const rows = await db
    .select({ questionId: answers.questionId, response: answers.response })
    .from(answers)
    .where(and(eq(answers.attemptId, attemptId), isNotNull(answers.response)))
  return Object.fromEntries(rows.map((r) => [r.questionId, r.response as Response]))
}
