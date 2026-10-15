import "server-only"
import { asc } from "drizzle-orm"
import { cache } from "react"
import { db, schema } from "@/db"
import { loadRewardFacts } from "@/db/reward-facts"
import { settleExpiredAttempts } from "./attempt-finalize"
import { computeRewards, type RewardRow } from "@/lib/views/rewards"
import { getContext } from "./access"

/** Stars, streak, badges and celebrations, computed once per request. */
export const loadRewards = cache(async () => {
  await settleExpiredAttempts()
  const now = new Date()
  const { studentId } = await getContext()
  const { facts, seen } = studentId
    ? await loadRewardFacts(db, { studentId })
    : { facts: { assignments: [], adjustments: [], redemptions: [] }, seen: new Set<string>() }
  return { now, facts, state: computeRewards(facts, seen, now) }
})

export async function listRewards(): Promise<RewardRow[]> {
  const rows = await db.select().from(schema.rewards).orderBy(asc(schema.rewards.position), asc(schema.rewards.cost))
  return rows.map(({ createdAt: _, ...r }) => r)
}
