import { asc, eq, sql } from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import type { RewardFacts } from "@/lib/rewards/stars"
import * as schema from "./schema"

/*
 * Loads what stars, streaks and badges are computed from. Takes the Drizzle
 * instance so the app (node-postgres) and the seed (postgres-js) share it.
 */

const { assignments, attempts, answers, exerciseSets, starAdjustments, rewardRedemptions, badgeSeen } = schema

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>

type Results<T extends readonly (() => PromiseLike<unknown>)[]> = { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }

/** Runs queries in parallel, or one by one on a single connection (pg warns about overlapping queries there). */
async function runAll<const T extends readonly (() => PromiseLike<unknown>)[]>(queries: T, serial: boolean): Promise<Results<T>> {
  if (!serial) return (await Promise.all(queries.map((q) => q()))) as Results<T>
  const out: unknown[] = []
  for (const q of queries) out.push(await q())
  return out as Results<T>
}

/** `serial`: inside a transaction (one connection), run the queries one after another. */
export async function loadRewardFacts(db: AnyDb, { serial = false } = {}): Promise<{ facts: RewardFacts; seen: Set<string> }> {
  const [assignmentRows, attemptRows, inkRows, adjustments, redemptions, seenRows] = await runAll([
    () => db
      .select({ id: assignments.id, availableFrom: assignments.availableFrom, dueAt: assignments.dueAt, title: exerciseSets.title, subject: exerciseSets.subject })
      .from(assignments)
      .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId)),
    () => db
      .select({ id: attempts.id, assignmentId: attempts.assignmentId, attemptNo: attempts.attemptNo, submittedAt: attempts.submittedAt, gradedAt: attempts.gradedAt, score: attempts.score })
      .from(attempts)
      .orderBy(asc(attempts.attemptNo)),
    () => db.selectDistinct({ attemptId: answers.attemptId }).from(answers).where(sql`${answers.response} -> 'ink' is not null`),
    () => db.select().from(starAdjustments),
    () => db.select().from(rewardRedemptions),
    () => db.select({ id: badgeSeen.badgeId }).from(badgeSeen),
  ], serial)
  const withInk = new Set(inkRows.map((r) => r.attemptId))
  const byAssignment = Map.groupBy(attemptRows, (a) => a.assignmentId)
  return {
    facts: {
      assignments: assignmentRows.map((a) => ({
        ...a,
        attempts: (byAssignment.get(a.id) ?? []).map(({ assignmentId: _, ...t }) => ({ ...t, hasInk: withInk.has(t.id) })),
      })),
      adjustments,
      redemptions,
    },
    seen: new Set(seenRows.map((r) => r.id)),
  }
}
