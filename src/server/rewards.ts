import "server-only"
import { asc } from "drizzle-orm"
import { cache } from "react"
import { db, schema } from "@/db"
import { loadRewardFacts } from "@/db/reward-facts"
import { settleExpiredAttempts } from "./attempt-finalize"
import { computeRewards, type RewardRow } from "@/lib/views/rewards"

/** Temporary until Task 4: the oldest child. */
export async function firstStudentRow() {
  const row = await db.query.students.findFirst({ orderBy: asc(schema.students.createdAt) })
  if (!row) throw new Error("No student found. Run `pnpm db:seed`.")
  return row
}

/** Stars, streak, badges and celebrations, computed once per request. */
export const loadRewards = cache(async () => {
  await settleExpiredAttempts()
  const now = new Date()
  const { id: studentId } = await firstStudentRow()
  const { facts, seen } = await loadRewardFacts(db, { studentId })
  return { now, facts, state: computeRewards(facts, seen, now) }
})

export async function listRewards(): Promise<RewardRow[]> {
  const rows = await db.select().from(schema.rewards).orderBy(asc(schema.rewards.position), asc(schema.rewards.cost))
  return rows.map(({ createdAt: _, ...r }) => r)
}
