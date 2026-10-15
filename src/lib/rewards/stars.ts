import { starsFor } from "@/lib/grading"
import type { SubjectId } from "@/lib/types"
import type { StreakSummary } from "./streak"

/*
 * Star balance, computed rather than stored: score stars come from the
 * *current* score of attempt 1 (a regrade changes them; attempt 2 never earns
 * any), plus streak milestone bonuses and the parent's adjustments, minus
 * rewards that are requested or handed over.
 */

export interface RewardAttempt {
  id: string
  attemptNo: number
  submittedAt: Date | null
  gradedAt: Date | null
  score: number | null
  /** The child wrote at least one essay by hand. */
  hasInk: boolean
}

export interface RewardAssignment {
  id: string
  title: string
  subject: SubjectId
  availableFrom: Date
  dueAt: Date
  /** Sorted by attempt number. */
  attempts: RewardAttempt[]
}

export interface StarAdjustment {
  id: string
  amount: number
  reason: string
  createdAt: Date
}

export type RedemptionStatus = "pending" | "given" | "declined"

export interface Redemption {
  id: string
  rewardId: string | null
  name: string
  emoji: string
  cost: number
  status: RedemptionStatus
  requestedAt: Date
  decidedAt: Date | null
}

export interface RewardFacts {
  assignments: RewardAssignment[]
  adjustments: StarAdjustment[]
  redemptions: Redemption[]
}

export interface LedgerEntry {
  id: string
  at: Date
  amount: number
  label: string
  kind: "score" | "streak" | "adjust" | "redeem"
  /** Redemptions only. */
  status?: RedemptionStatus
}

export interface StarLedger {
  balance: number
  /** Everything ever earned (score + streak + adjustments). */
  earned: number
  /** Newest first. Declined redemptions are listed but cost nothing. */
  entries: LedgerEntry[]
}

/** Stars an attempt earns: only the first attempt, from its current score. */
export const attemptStars = (attemptNo: number, score: number): 0 | 1 | 2 | 3 => (attemptNo === 1 ? starsFor(score) : 0)

export function starLedger(facts: RewardFacts, streak: StreakSummary): StarLedger {
  const entries: LedgerEntry[] = []
  for (const a of facts.assignments) {
    const first = a.attempts.find((t) => t.attemptNo === 1)
    if (!first?.gradedAt || first.score === null) continue
    const amount = attemptStars(1, first.score)
    if (amount) entries.push({ id: `score-${first.id}`, at: first.gradedAt, amount, label: a.title, kind: "score" })
  }
  for (const m of streak.milestones) {
    entries.push({ id: `streak-${m.days}-${m.reachedOn.getTime()}`, at: m.reachedOn, amount: m.bonus, label: `Chuỗi ${m.days} ngày`, kind: "streak" })
  }
  for (const a of facts.adjustments) {
    entries.push({ id: `adjust-${a.id}`, at: a.createdAt, amount: a.amount, label: a.reason, kind: "adjust" })
  }
  for (const r of facts.redemptions) {
    entries.push({ id: `redeem-${r.id}`, at: r.requestedAt, amount: r.status === "declined" ? 0 : -r.cost, label: `${r.emoji} ${r.name}`, kind: "redeem", status: r.status })
  }
  entries.sort((a, b) => b.at.getTime() - a.at.getTime())
  const earned = entries.filter((e) => e.kind !== "redeem").reduce((s, e) => s + e.amount, 0)
  const balance = entries.reduce((s, e) => s + e.amount, 0)
  return { balance, earned, entries }
}

/** Why a reward can't be requested right now, or null if it can. */
export function canRedeem(balance: number, reward: { active: boolean; cost: number }, hasPending: boolean): string | null {
  if (!reward.active) return "Phần thưởng này đang tạm ẩn"
  if (hasPending) return "Con đã gửi yêu cầu này rồi, chờ bố mẹ nhé"
  if (balance < reward.cost) return "Con chưa đủ sao"
  return null
}
