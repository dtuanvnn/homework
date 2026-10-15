import type { SubjectId } from "@/lib/types"
import type { RewardAssignment } from "./stars"
import type { StreakSummary } from "./streak"

/*
 * Fixed badge catalog, awarded automatically from the same facts as stars.
 * `badge_seen` remembers which badges (and streak milestones) the child has
 * already celebrated.
 */

export interface BadgeFacts {
  assignments: RewardAssignment[]
  streak: StreakSummary
}

export interface BadgeDef {
  id: string
  name: string
  emoji: string
  description: string
  /** How to earn it, shown on a locked badge. */
  hint: string
  earnedAt: (facts: BadgeFacts) => Date | null
}

/** Date of the n-th (1-based) event, or null if there are fewer. */
function nth(dates: (Date | null)[], n: number): Date | null {
  const sorted = dates.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())
  return sorted[n - 1] ?? null
}

const submits = (f: BadgeFacts) => f.assignments.flatMap((a) => a.attempts.map((t) => t.submittedAt))
/** When each assignment was first handed in. */
const doneAssignments = (f: BadgeFacts, subject?: SubjectId) =>
  f.assignments.filter((a) => !subject || a.subject === subject).map((a) => nth(a.attempts.map((t) => t.submittedAt), 1))
const tens = (f: BadgeFacts) => f.assignments.flatMap((a) => a.attempts.map((t) => (t.score === 10 ? t.gradedAt : null)))

const streakBadge = (days: number): BadgeDef => ({
  id: `streak-${days}`,
  name: `Chuỗi ${days} ngày`,
  emoji: days >= 30 ? "🌋" : days >= 7 ? "🔥" : "✨",
  description: `Làm đủ bài đúng hạn ${days} ngày liền.`,
  hint: `Làm đủ bài đúng hạn ${days} ngày liền`,
  earnedAt: (f) => f.streak.milestones.find((m) => m.days === days)?.reachedOn ?? null,
})

const subjectBadge = (subject: SubjectId, subjectName: string, emoji: string): BadgeDef => ({
  id: `${subject}-20`,
  name: `Chăm ${subjectName}`,
  emoji,
  description: `Hoàn thành 20 bài ${subjectName}.`,
  hint: `Hoàn thành 20 bài ${subjectName}`,
  earnedAt: (f) => nth(doneAssignments(f, subject), 20),
})

export const BADGES: BadgeDef[] = [
  { id: "first-submit", name: "Bài đầu tiên", emoji: "🎒", description: "Nộp bài đầu tiên.", hint: "Nộp bài đầu tiên", earnedAt: (f) => nth(submits(f), 1) },
  streakBadge(3),
  streakBadge(7),
  streakBadge(30),
  { id: "first-ten", name: "Điểm 10 đầu tiên", emoji: "💯", description: "Đạt điểm 10 lần đầu.", hint: "Đạt điểm 10 một bài", earnedAt: (f) => nth(tens(f), 1) },
  { id: "ten-tens", name: "10 lần điểm 10", emoji: "🏆", description: "Đạt điểm 10 mười lần.", hint: "Đạt điểm 10 mười lần", earnedAt: (f) => nth(tens(f), 10) },
  subjectBadge("toan", "Toán", "🔢"),
  subjectBadge("tieng-viet", "Tiếng Việt", "📖"),
  subjectBadge("tieng-anh", "Tiếng Anh", "🌍"),
  {
    id: "comeback",
    name: "Tiến bộ",
    emoji: "📈",
    description: "Làm lại lần 2 cao hơn lần 1 từ 2 điểm.",
    hint: "Làm lại lần 2 cao hơn lần 1 từ 2 điểm",
    earnedAt: (f) =>
      nth(
        f.assignments.map((a) => {
          const first = a.attempts.find((t) => t.attemptNo === 1)
          const second = a.attempts.find((t) => t.attemptNo === 2)
          return first?.score != null && second?.score != null && second.score >= first.score + 2 ? second.gradedAt : null
        }),
        1,
      ),
  },
  {
    id: "pen-10",
    name: "Ngòi bút chăm chỉ",
    emoji: "✍️",
    description: "Viết tay 10 bài.",
    hint: "Viết tay 10 bài",
    earnedAt: (f) => nth(f.assignments.flatMap((a) => a.attempts.map((t) => (t.hasInk ? t.submittedAt : null))), 10),
  },
  { id: "fifty", name: "50 bài hoàn thành", emoji: "🌟", description: "Hoàn thành 50 bài.", hint: "Hoàn thành 50 bài", earnedAt: (f) => nth(doneAssignments(f), 50) },
]

export interface BadgeStatus {
  id: string
  name: string
  emoji: string
  description: string
  hint: string
  earnedAt: Date | null
}

export function badgeStatuses(facts: BadgeFacts): BadgeStatus[] {
  return BADGES.map(({ earnedAt, ...b }) => ({ ...b, earnedAt: earnedAt(facts) }))
}

export interface Celebration {
  /** Key stored in `badge_seen`. */
  id: string
  emoji: string
  title: string
  description: string
}

/** Streak milestones older than this are history, not news (e.g. right after this feature ships). */
const MILESTONE_NEWS_DAYS = 3

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const milestoneSeenId = (days: number, reachedOn: Date) => `streak-${days}@${dayKey(reachedOn)}`

/** Badges and recent streak milestones the child hasn't celebrated yet. */
export function newCelebrations(badges: BadgeStatus[], streak: StreakSummary, seen: Set<string>, now: Date): Celebration[] {
  const out: Celebration[] = []
  const recent = now.getTime() - MILESTONE_NEWS_DAYS * 86_400_000
  for (const m of streak.milestones) {
    const id = milestoneSeenId(m.days, m.reachedOn)
    if (m.reachedOn.getTime() >= recent && !seen.has(id)) {
      out.push({ id, emoji: "🔥", title: `Chuỗi ${m.days} ngày!`, description: `Em được thưởng ${m.bonus} sao.` })
    }
  }
  for (const b of badges) {
    if (b.earnedAt && !seen.has(b.id)) out.push({ id: b.id, emoji: b.emoji, title: `Huy hiệu mới: ${b.name}`, description: b.description })
  }
  return out
}
