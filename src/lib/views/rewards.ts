import { formatShortDate } from "@/lib/format"
import { badgeStatuses, newCelebrations, type BadgeStatus, type Celebration } from "@/lib/rewards/badges"
import { starLedger, type LedgerEntry, type Redemption, type RedemptionStatus, type RewardFacts, type StarLedger } from "@/lib/rewards/stars"
import { nextMilestone, streakRuns, type StreakSummary } from "@/lib/rewards/streak"

/* ---------- Computed state ---------- */

export interface RewardState {
  streak: StreakSummary
  ledger: StarLedger
  badges: BadgeStatus[]
  celebrations: Celebration[]
}

export function computeRewards(facts: RewardFacts, seen: Set<string>, now: Date): RewardState {
  const streak = streakRuns(facts.assignments, now)
  const badges = badgeStatuses({ assignments: facts.assignments, streak })
  return { streak, ledger: starLedger(facts, streak), badges, celebrations: newCelebrations(badges, streak, seen, now) }
}

/* ---------- Serializable views ---------- */

export interface RewardRow {
  id: string
  name: string
  emoji: string
  cost: number
  active: boolean
  position: number
}

export interface RewardItem extends RewardRow {
  /** A request for it waits for the parent. */
  pending: boolean
  /** Times it was handed over. */
  given: number
}

export interface RedemptionItem {
  id: string
  name: string
  emoji: string
  cost: number
  status: RedemptionStatus
  requestedLabel: string
  decidedLabel?: string
}

export interface LedgerItem {
  id: string
  dateLabel: string
  amount: number
  label: string
  kind: LedgerEntry["kind"]
  status?: RedemptionStatus
}

export interface BadgeItem {
  id: string
  name: string
  emoji: string
  description: string
  hint: string
  earnedLabel?: string
}

export interface StreakView {
  current: number
  longest: number
  next: { days: number; bonus: number }
}

export interface StudentRewardsView {
  balance: number
  streak: StreakView
  /** Active rewards in the parent's order. */
  rewards: RewardItem[]
  pending: RedemptionItem[]
  badges: BadgeItem[]
  history: LedgerItem[]
}

export interface ParentRewardsView {
  balance: number
  earned: number
  streak: StreakView
  rewards: RewardItem[]
  pending: RedemptionItem[]
  /** Given and declined, newest first. */
  decided: RedemptionItem[]
  history: LedgerItem[]
}

/** The dashboard card. */
export interface RewardSummary {
  balance: number
  streak: number
  pending: RedemptionItem[]
}

const toStreakView = (s: StreakSummary): StreakView => ({ current: s.current, longest: s.longest, next: nextMilestone(s.current) })

function toRedemptionItem(r: Redemption): RedemptionItem {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    cost: r.cost,
    status: r.status,
    requestedLabel: formatShortDate(r.requestedAt),
    decidedLabel: r.decidedAt ? formatShortDate(r.decidedAt) : undefined,
  }
}

const toLedgerItem = (e: LedgerEntry): LedgerItem => ({ id: e.id, dateLabel: formatShortDate(e.at), amount: e.amount, label: e.label, kind: e.kind, status: e.status })

const newestFirst = (a: Redemption, b: Redemption) => b.requestedAt.getTime() - a.requestedAt.getTime()

function rewardItems(rows: RewardRow[], redemptions: Redemption[]): RewardItem[] {
  return [...rows]
    .sort((a, b) => a.position - b.position || a.cost - b.cost)
    .map((r) => ({
      ...r,
      pending: redemptions.some((x) => x.rewardId === r.id && x.status === "pending"),
      given: redemptions.filter((x) => x.rewardId === r.id && x.status === "given").length,
    }))
}

export function buildStudentRewards(state: RewardState, rows: RewardRow[], redemptions: Redemption[]): StudentRewardsView {
  return {
    balance: state.ledger.balance,
    streak: toStreakView(state.streak),
    rewards: rewardItems(rows.filter((r) => r.active), redemptions),
    pending: redemptions.filter((r) => r.status === "pending").sort(newestFirst).map(toRedemptionItem),
    badges: state.badges.map(({ earnedAt, ...b }) => ({ ...b, earnedLabel: earnedAt ? formatShortDate(earnedAt) : undefined })),
    history: state.ledger.entries.map(toLedgerItem),
  }
}

export function buildParentRewards(state: RewardState, rows: RewardRow[], redemptions: Redemption[]): ParentRewardsView {
  const sorted = [...redemptions].sort(newestFirst)
  return {
    balance: state.ledger.balance,
    earned: state.ledger.earned,
    streak: toStreakView(state.streak),
    rewards: rewardItems(rows, redemptions),
    pending: sorted.filter((r) => r.status === "pending").map(toRedemptionItem),
    decided: sorted.filter((r) => r.status !== "pending").map(toRedemptionItem),
    history: state.ledger.entries.map(toLedgerItem),
  }
}

export function buildRewardSummary(state: RewardState, redemptions: Redemption[]): RewardSummary {
  return {
    balance: state.ledger.balance,
    streak: state.streak.current,
    pending: redemptions.filter((r) => r.status === "pending").sort(newestFirst).map(toRedemptionItem),
  }
}
