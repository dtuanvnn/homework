process.env.TZ = "Asia/Ho_Chi_Minh"

import { describe, expect, it } from "vitest"
import { badgeStatuses, milestoneSeenId, newCelebrations } from "./badges"
import { canRedeem, starLedger, type Redemption, type RewardAssignment, type RewardAttempt, type RewardFacts } from "./stars"
import { milestoneBonus, nextMilestone, streakRuns, type StreakSummary } from "./streak"

const now = new Date("2026-10-15T15:00:00+07:00") // Thursday
/** Vietnam local time `day` days from 15/10/2026. */
const at = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 15 + day, hour - 7, minute))

let seq = 0
function attempt(over: Partial<RewardAttempt> = {}): RewardAttempt {
  return { id: `t${++seq}`, attemptNo: 1, submittedAt: null, gradedAt: null, score: null, hasInk: false, ...over }
}

/** An assignment due at 20:00 on `day`; `submitHour` submits attempt 1 that day. */
function due(day: number, submitHour?: number, over: Partial<RewardAssignment> = {}): RewardAssignment {
  return {
    id: `a${++seq}`,
    title: `Bài ${seq}`,
    subject: "toan",
    availableFrom: at(day - 1, 6),
    dueAt: at(day, 20),
    attempts: submitHour === undefined ? [] : [attempt({ submittedAt: at(day, submitHour) })],
    ...over,
  }
}

describe("streakRuns", () => {
  it("skips days with nothing due", () => {
    // Fri, Mon, Tue, Wed — the weekend has no homework.
    const s = streakRuns([due(-6, 19), due(-3, 19), due(-2, 19), due(-1, 19)], now)
    expect(s.current).toBe(4)
  })

  it("breaks on a late or missing submission", () => {
    expect(streakRuns([due(-3, 19), due(-2, 21), due(-1, 19)], now).current).toBe(1)
    expect(streakRuns([due(-3, 19), due(-2), due(-1, 19)], now).current).toBe(1)
  })

  it("needs every assignment due that day", () => {
    expect(streakRuns([due(-2, 19), due(-1, 19), due(-1)], now).current).toBe(0)
  })

  it("counts only attempt 1 for being on time", () => {
    const a = due(-1, undefined, { attempts: [attempt({ attemptNo: 2, submittedAt: at(-1, 19) })] })
    expect(streakRuns([due(-2, 19), a], now).current).toBe(0)
  })

  it("keeps today open until something is late", () => {
    const history = [due(-2, 19), due(-1, 19)]
    expect(streakRuns([...history, due(0)], now).current).toBe(2)
    expect(streakRuns([...history, due(0, 14)], now).current).toBe(3)
    const lateToday = due(0, undefined, { dueAt: at(0, 12) })
    expect(streakRuns([...history, lateToday], now).current).toBe(0)
  })

  it("ignores future assignments", () => {
    expect(streakRuns([due(-1, 19), due(2)], now).current).toBe(1)
  })

  it("uses Vietnam days: a 23:30 due belongs to that evening", () => {
    const late = due(-1, undefined, { dueAt: at(-1, 23, 30), attempts: [attempt({ submittedAt: at(-1, 23) })] })
    expect(streakRuns([due(-2, 19), late], now).current).toBe(2)
  })

  it("tracks the longest run and re-earns milestones after a break", () => {
    const run = (from: number, n: number) => Array.from({ length: n }, (_, i) => due(from + i, 19))
    const s = streakRuns([...run(-20, 7), due(-13), ...run(-12, 3)], now)
    expect(s.longest).toBe(7)
    expect(s.current).toBe(3)
    expect(s.milestones.map((m) => [m.days, m.bonus])).toEqual([[3, 5], [7, 10], [3, 5]])
    expect(s.milestones[1].reachedOn).toEqual(at(-14, 0))
  })
})

describe("milestones", () => {
  it("pays 3/7/14/30 then every 30 days", () => {
    expect([3, 7, 14, 30, 60, 90].map(milestoneBonus)).toEqual([5, 10, 20, 50, 50, 50])
    expect([1, 2, 4, 31, 45].map(milestoneBonus)).toEqual([null, null, null, null, null])
  })

  it("finds the next milestone", () => {
    expect(nextMilestone(0)).toEqual({ days: 3, bonus: 5 })
    expect(nextMilestone(5)).toEqual({ days: 7, bonus: 10 })
    expect(nextMilestone(30)).toEqual({ days: 60, bonus: 50 })
  })
})

const graded = (attemptNo: number, score: number, day = -1) =>
  attempt({ attemptNo, score, submittedAt: at(day, 19), gradedAt: at(day, 21) })

function redemption(over: Partial<Redemption> = {}): Redemption {
  return { id: `r${++seq}`, rewardId: "w1", name: "Xem TV", emoji: "📺", cost: 4, status: "pending", requestedAt: at(0, 10), decidedAt: null, ...over }
}

const facts = (over: Partial<RewardFacts> = {}): RewardFacts => ({ assignments: [], adjustments: [], redemptions: [], ...over })
const noStreak: StreakSummary = { current: 0, longest: 0, milestones: [] }

describe("starLedger", () => {
  it("gives stars from the current score of attempt 1 only", () => {
    const a = due(-2, undefined, { attempts: [graded(1, 7.5, -2), graded(2, 10, -1)] })
    expect(starLedger(facts({ assignments: [a] }), noStreak).balance).toBe(2)
    // The parent regrades attempt 1 up to 9: stars follow the new score.
    a.attempts[0].score = 9
    expect(starLedger(facts({ assignments: [a] }), noStreak).balance).toBe(3)
  })

  it("ignores ungraded attempts", () => {
    const a = due(-1, 19)
    expect(starLedger(facts({ assignments: [a] }), noStreak).entries).toEqual([])
  })

  it("adds milestones and adjustments, subtracts pending and given rewards", () => {
    const a = due(-1, undefined, { attempts: [graded(1, 9)] })
    const ledger = starLedger(
      facts({
        assignments: [a],
        adjustments: [{ id: "j1", amount: 5, reason: "Tự giác ôn bài", createdAt: at(0, 8) }, { id: "j2", amount: -2, reason: "Sửa nhầm", createdAt: at(0, 9) }],
        redemptions: [redemption({ status: "pending" }), redemption({ status: "given", cost: 3 }), redemption({ status: "declined", cost: 100 })],
      }),
      { current: 3, longest: 3, milestones: [{ days: 3, reachedOn: at(-1, 0), bonus: 5 }] },
    )
    expect(ledger.earned).toBe(3 + 5 + 5 - 2)
    expect(ledger.balance).toBe(11 - 4 - 3)
    expect(ledger.entries.map((e) => e.kind)).toContain("streak")
    expect(ledger.entries.find((e) => e.status === "declined")?.amount).toBe(0)
  })

  it("can go negative and sorts newest first", () => {
    const ledger = starLedger(facts({ adjustments: [{ id: "j", amount: -3, reason: "Trừ", createdAt: at(-1, 8) }], redemptions: [redemption({ cost: 2, requestedAt: at(0, 9) })] }), noStreak)
    expect(ledger.balance).toBe(-5)
    expect(ledger.entries[0].kind).toBe("redeem")
  })
})

describe("canRedeem", () => {
  it("explains why a reward can't be requested", () => {
    expect(canRedeem(10, { active: true, cost: 10 }, false)).toBeNull()
    expect(canRedeem(9, { active: true, cost: 10 }, false)).toBe("Con chưa đủ sao")
    expect(canRedeem(50, { active: false, cost: 10 }, false)).toBe("Phần thưởng này đang tạm ẩn")
    expect(canRedeem(50, { active: true, cost: 10 }, true)).toBe("Con đã gửi yêu cầu này rồi, chờ bố mẹ nhé")
  })
})

describe("badges", () => {
  const earned = (assignments: RewardAssignment[], streak = noStreak) =>
    Object.fromEntries(badgeStatuses({ assignments, streak }).map((b) => [b.id, b.earnedAt]))

  it("awards the first submission and first ten", () => {
    const b = earned([due(-3, 19), due(-1, undefined, { attempts: [graded(1, 10)] })])
    expect(b["first-submit"]).toEqual(at(-3, 19))
    expect(b["first-ten"]).toEqual(at(-1, 21))
    expect(b["ten-tens"]).toBeNull()
  })

  it("counts 20 assignments per subject, not attempts", () => {
    const many = Array.from({ length: 20 }, (_, i) => due(-30 + i, 19, { subject: "tieng-anh" }))
    expect(earned(many)["tieng-anh-20"]).toEqual(at(-11, 19))
    expect(earned(many)["toan-20"]).toBeNull()
    const retries = Array.from({ length: 10 }, (_, i) => due(-30 + i, undefined, { subject: "toan", attempts: [graded(1, 5, -30 + i), graded(2, 6, -30 + i)] }))
    expect(earned(retries)["toan-20"]).toBeNull()
  })

  it("awards comeback when attempt 2 beats attempt 1 by 2 points", () => {
    expect(earned([due(-2, undefined, { attempts: [graded(1, 6, -2), graded(2, 8)] })]).comeback).toEqual(at(-1, 21))
    expect(earned([due(-2, undefined, { attempts: [graded(1, 6, -2), graded(2, 7.75)] })]).comeback).toBeNull()
  })

  it("awards pen-10 on the 10th handwritten attempt", () => {
    const ink = Array.from({ length: 10 }, (_, i) => due(-20 + i, undefined, { attempts: [attempt({ submittedAt: at(-20 + i, 19), hasInk: true })] }))
    expect(earned(ink)["pen-10"]).toEqual(at(-11, 19))
  })

  it("takes streak badges from milestones", () => {
    expect(earned([], { current: 3, longest: 3, milestones: [{ days: 3, reachedOn: at(-1, 0), bonus: 5 }] })["streak-3"]).toEqual(at(-1, 0))
  })
})

describe("newCelebrations", () => {
  const streak = { current: 7, longest: 7, milestones: [{ days: 3, reachedOn: at(-10, 0), bonus: 5 }, { days: 7, reachedOn: at(-1, 0), bonus: 10 }] }
  const badges = badgeStatuses({ assignments: [due(-3, 19)], streak })

  it("lists unseen badges and recent milestones", () => {
    const ids = newCelebrations(badges, streak, new Set(), now).map((c) => c.id)
    expect(ids).toEqual([milestoneSeenId(7, at(-1, 0)), "first-submit", "streak-3", "streak-7"])
    expect(milestoneSeenId(7, at(-1, 0))).toBe("streak-7@2026-10-14")
  })

  it("skips what was already seen", () => {
    const seen = new Set(["first-submit", "streak-3", "streak-7", "streak-7@2026-10-14"])
    expect(newCelebrations(badges, streak, seen, now)).toEqual([])
  })
})
