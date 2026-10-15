"use server"

import { and, eq, sql } from "drizzle-orm"
import { refresh } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { loadRewardFacts } from "@/db/reward-facts"
import { runAction, type ActionResult } from "@/lib/action-result"
import { canRedeem } from "@/lib/rewards/stars"
import { computeRewards } from "@/lib/views/rewards"
import { assertAccess } from "../access"
import { isUuid } from "../queries"
import { assertRedemptionInScope, assertRewardInHousehold } from "../ownership"

const { rewards, rewardRedemptions, starAdjustments, badgeSeen } = schema

/** Serializes redemption requests so a double tap can't overspend. */
const REDEEM_LOCK = 4_812_001

const rewardSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Phần thưởng cần có tên").max(100),
  emoji: z.string().trim().min(1, "Chọn một biểu tượng").max(16),
  cost: z.number({ error: "Nhập số sao" }).int("Số sao phải là số nguyên").min(1, "Ít nhất 1 sao").max(10_000),
  active: z.boolean(),
})
export type RewardInput = z.input<typeof rewardSchema>

const checkId = (id: string) => {
  if (!isUuid(id)) throw new Error("Mã không hợp lệ")
}

export async function saveReward(input: RewardInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const { id, ...data } = rewardSchema.parse(input)
    if (id) {
      const [row] = await db.update(rewards).set(data).where(and(eq(rewards.id, id), eq(rewards.householdId, ctx.householdId))).returning({ id: rewards.id })
      if (!row) throw new Error("Không tìm thấy phần thưởng")
      refresh()
      return row
    }
    const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${rewards.position}) + 1, 0)::int` }).from(rewards).where(eq(rewards.householdId, ctx.householdId))
    const [row] = await db.insert(rewards).values({ ...data, householdId: ctx.householdId, position: next }).returning({ id: rewards.id })
    refresh()
    return row
  })
}

/** Deletes a reward that was never requested; otherwise hides it so history keeps its link. */
export async function deleteReward(id: string): Promise<ActionResult<{ hidden: boolean }>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    await assertRewardInHousehold(ctx, id)
    checkId(id)
    const [used] = await db.select({ id: rewardRedemptions.id }).from(rewardRedemptions).where(eq(rewardRedemptions.rewardId, id)).limit(1)
    if (used) await db.update(rewards).set({ active: false }).where(eq(rewards.id, id))
    else await db.delete(rewards).where(eq(rewards.id, id))
    refresh()
    return { hidden: !!used }
  })
}

export async function reorderRewards(ids: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const list = z.array(z.uuid()).max(200).parse(ids)
    for (const id of list) await assertRewardInHousehold(ctx, id)
    await db.transaction(async (tx) => {
      for (const [position, id] of list.entries()) await tx.update(rewards).set({ position }).where(eq(rewards.id, id))
    })
    refresh()
    return null
  })
}

/** The child asks for a reward; its stars are held until the parent decides. */
export async function requestRedemption(rewardId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("student")
    await assertRewardInHousehold(ctx, rewardId)
    checkId(rewardId)
    const studentId = ctx.studentId!
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REDEEM_LOCK}, hashtext(${studentId}))`)
      const [reward] = await tx.select().from(rewards).where(eq(rewards.id, rewardId))
      if (!reward) throw new Error("Không tìm thấy phần thưởng")
      const { facts, seen } = await loadRewardFacts(tx, { studentId, serial: true })
      const balance = computeRewards(facts, seen, new Date()).ledger.balance
      const hasPending = facts.redemptions.some((r) => r.rewardId === rewardId && r.status === "pending")
      const problem = canRedeem(balance, reward, hasPending)
      if (problem) throw new Error(problem)
      await tx.insert(rewardRedemptions).values({ studentId, rewardId, name: reward.name, emoji: reward.emoji, cost: reward.cost })
    })
    refresh()
    return null
  })
}

/** The child changed their mind: a pending request disappears and the stars come back. */
export async function cancelRedemption(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("student")
    await assertRedemptionInScope(ctx, id)
    checkId(id)
    const [row] = await db
      .delete(rewardRedemptions)
      .where(and(eq(rewardRedemptions.id, id), eq(rewardRedemptions.status, "pending")))
      .returning({ id: rewardRedemptions.id })
    if (!row) throw new Error("Bố mẹ đã xử lý yêu cầu này rồi")
    refresh()
    return null
  })
}

export async function decideRedemption(id: string, decision: "given" | "declined"): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    await assertRedemptionInScope(ctx, id)
    checkId(id)
    const status = z.enum(["given", "declined"]).parse(decision)
    const [row] = await db
      .update(rewardRedemptions)
      .set({ status, decidedAt: new Date() })
      .where(and(eq(rewardRedemptions.id, id), eq(rewardRedemptions.status, "pending")))
      .returning({ id: rewardRedemptions.id })
    if (!row) throw new Error("Yêu cầu này đã được xử lý hoặc con đã hủy")
    refresh()
    return null
  })
}

const adjustSchema = z.object({
  amount: z.number({ error: "Nhập số sao" }).int("Số sao phải là số nguyên").min(-1000).max(1000).refine((n) => n !== 0, "Số sao phải khác 0"),
  reason: z.string().trim().min(1, "Ghi lý do để con hiểu nhé").max(200),
})

export async function adjustStars(amount: number, reason: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    if (!ctx.studentId) throw new Error("Chưa có học sinh nào.")
    await db.insert(starAdjustments).values({ ...adjustSchema.parse({ amount, reason }), studentId: ctx.studentId })
    refresh()
    return null
  })
}

/** Called after the child saw the celebration for these badges/milestones. */
export async function markBadgesSeen(ids: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("student")
    const studentId = ctx.studentId!
    const list = z.array(z.string().min(1).max(100)).max(100).parse(ids)
    if (list.length) await db.insert(badgeSeen).values(list.map((badgeId) => ({ studentId, badgeId }))).onConflictDoNothing()
    return null
  })
}
