import { describe, expect, it } from "vitest"
import {
  activityGrid,
  averageMinutes,
  averageScore,
  buildReport,
  completedCount,
  dueOn,
  lastWeeks,
  onTimeRate,
  previousPeriod,
  rangePeriod,
  retryGain,
  retryPairs,
  semesterStart,
  skillAccuracy,
  suggestPracticeSet,
  summarize,
  summarizeWeek,
  weakestSkills,
  weekPeriod,
  weeklySubjectScores,
  type AnswerFact,
  type AssignmentFact,
  type AttemptFact,
  type SetSkills,
} from "./analytics"
import { startOfWeek } from "./dates"

// Day/week boundaries are local time; the app runs in Vietnam time (UTC+7, no DST).
process.env.TZ = "Asia/Ho_Chi_Minh"

/** Thursday 15 Oct 2026, 15:00 Vietnam time. Week = Mon 12 – Sun 18 Oct. */
const now = new Date("2026-10-15T15:00:00+07:00")
const vn = (local: string) => new Date(`${local}+07:00`).toISOString()

let seq = 0
const attempt = (attemptNo: number, submitted: string | null, graded: string | null, score: number | null, minutes = 15): AttemptFact => ({
  attemptNo,
  submittedAt: submitted && vn(submitted),
  gradedAt: graded && vn(graded),
  score,
  durationSeconds: submitted ? minutes * 60 : null,
  retryAllowed: true,
})
const assignment = (due: string, attempts: AttemptFact[], extra: Partial<AssignmentFact> = {}): AssignmentFact => ({
  id: `a${++seq}`,
  setId: "s1",
  title: `Bài ${seq}`,
  subject: "toan",
  availableFrom: vn("2026-09-01T06:00:00"),
  dueAt: vn(due),
  maxAttempts: 2,
  attempts,
  ...extra,
})

describe("summarizeWeek", () => {
  const list = [
    // Due this week, graded.
    assignment("2026-10-13T20:00:00", [attempt(1, "2026-10-13T18:00:00", "2026-10-13T19:00:00", 8)]),
    // Due this week, submitted, awaiting grading.
    assignment("2026-10-14T20:00:00", [attempt(1, "2026-10-14T18:00:00", null, null)]),
    // Due this week (later today), not started.
    assignment("2026-10-15T20:00:00", []),
    // Overdue last week, never submitted (most overdue).
    assignment("2026-10-08T20:00:00", [], { title: "Trễ lâu" }),
    // Overdue this week, started but not submitted.
    assignment("2026-10-12T20:00:00", [attempt(1, null, null, null)], { title: "Trễ mới" }),
    // Last week, retry submitted and waiting: counts as awaiting grading.
    assignment("2026-10-07T20:00:00", [attempt(1, "2026-10-07T18:00:00", "2026-10-07T19:00:00", 5), attempt(2, "2026-10-09T18:00:00", null, null)]),
  ]

  it("counts this week's assignments, awaiting grading and overdue", () => {
    expect(summarizeWeek(list, now)).toEqual({ total: 4, done: 2, awaitingGrading: 2, overdue: 2, overdueTitle: "Trễ lâu" })
  })

  it("handles no assignments", () => {
    expect(summarizeWeek([], now)).toEqual({ total: 0, done: 0, awaitingGrading: 0, overdue: 0, overdueTitle: undefined })
  })

  it("lists today's assignments by due time", () => {
    const early = assignment("2026-10-15T08:00:00", [])
    const late = assignment("2026-10-15T21:00:00", [])
    const tomorrow = assignment("2026-10-16T08:00:00", [])
    expect(dueOn([late, tomorrow, early], now).map((a) => a.id)).toEqual([early.id, late.id])
  })
})

describe("averages and week bucketing", () => {
  const list = [
    assignment("2026-10-13T20:00:00", [attempt(1, "2026-10-13T18:00:00", "2026-10-13T19:00:00", 8)]),
    assignment("2026-10-14T20:00:00", [attempt(1, "2026-10-14T18:00:00", "2026-10-14T19:00:00", 9)], { subject: "tieng-anh" }),
    // Graded at 00:30 Monday local time: belongs to this week, not the previous one.
    assignment("2026-10-11T20:00:00", [attempt(1, "2026-10-11T23:00:00", "2026-10-12T00:30:00", 6)]),
    assignment("2026-10-06T20:00:00", [attempt(1, "2026-10-06T18:00:00", "2026-10-06T19:00:00", 7)]),
    // Submitted but not graded: ignored.
    assignment("2026-10-15T08:00:00", [attempt(1, "2026-10-15T07:00:00", null, null)]),
  ]
  const week = weekPeriod(startOfWeek(now))

  it("averages attempts graded in the week", () => {
    expect(averageScore(list, week)).toBeCloseTo((8 + 9 + 6) / 3)
    expect(averageScore(list, previousPeriod(week))).toBe(7)
  })

  it("returns null without data", () => {
    expect(averageScore([], week)).toBeNull()
    expect(averageScore(list, weekPeriod(new Date(2026, 0, 5)))).toBeNull()
  })

  it("buckets per subject for the last N weeks, oldest first", () => {
    const points = weeklySubjectScores(list, lastWeeks(now, 6))
    expect(points).toHaveLength(6)
    expect(new Date(points[0].weekStart)).toEqual(new Date(2026, 8, 7))
    expect(new Date(points[5].weekStart)).toEqual(new Date(2026, 9, 12))
    expect(points[5]).toMatchObject({ toan: 7, "tieng-anh": 9 })
    expect(points[4]).toMatchObject({ toan: 7 })
    expect(points[4]["tieng-anh"]).toBeUndefined()
    expect(points[0]).toEqual({ weekStart: points[0].weekStart })
  })
})

describe("skills", () => {
  const answer = (skills: string[], earned: number, points = 1, extra: Partial<AnswerFact> = {}): AnswerFact => ({
    attemptKey: "t1",
    subject: "toan",
    setId: "s1",
    skills,
    points,
    earned,
    correct: earned === points,
    gradedAt: vn("2026-10-10T19:00:00"),
    ...extra,
  })
  const answers = [
    answer(["Toán có lời văn"], 0, 2),
    answer(["Toán có lời văn"], 1, 2, { attemptKey: "t2" }),
    answer(["Toán có lời văn", "Bảng nhân 7"], 2, 2, { attemptKey: "t2" }),
    answer(["Bảng nhân 7"], 1),
    answer(["Bảng nhân 7"], 1),
    answer(["Bảng nhân 7"], 0),
    answer(["Một phần mấy"], 0),
    answer(["Dấu hỏi/ngã"], 0, 1, { subject: "tieng-viet" }),
    answer(["Dấu hỏi/ngã"], 1, 1, { subject: "tieng-viet" }),
    answer(["Dấu hỏi/ngã"], 0, 1, { subject: "tieng-viet" }),
  ]

  it("computes accuracy from points, weakest first, honouring the minimum sample", () => {
    const stats = skillAccuracy(answers, 3)
    expect(stats.map((s) => [s.skill, s.accuracy])).toEqual([
      ["Dấu hỏi/ngã", 33],
      ["Toán có lời văn", 50],
      ["Bảng nhân 7", 80],
    ])
    expect(stats[1]).toMatchObject({ wrongCount: 2, totalCount: 3, attempts: 2 })
    expect(skillAccuracy(answers).some((s) => s.skill === "Một phần mấy")).toBe(true)
    expect(skillAccuracy([])).toEqual([])
  })

  const sets: SetSkills[] = [
    { id: "exam", title: "Đề kiểm tra", subject: "toan", status: "san-sang", kind: "de-thi", skills: ["Toán có lời văn", "Chu vi"] },
    { id: "draft", title: "Nháp", subject: "toan", status: "nhap", kind: "luyen-tap", skills: ["Toán có lời văn"] },
    { id: "other", title: "Đồng hồ", subject: "toan", status: "san-sang", kind: "chu-de", skills: ["Xem đồng hồ"] },
    { id: "loi-van", title: "Lời văn", subject: "toan", status: "san-sang", kind: "chu-de", skills: ["Toán có lời văn"] },
  ]

  it("suggests a focused ready set with the skill, then any ready set of the subject", () => {
    expect(suggestPracticeSet(sets, "toan", "Toán có lời văn")?.id).toBe("loi-van")
    expect(suggestPracticeSet(sets, "toan", "Bảng nhân 7")?.id).toBe("other")
    expect(suggestPracticeSet(sets, "toan", "Chu vi")?.id).toBe("exam")
    expect(suggestPracticeSet(sets, "tieng-anh", "Grammar: to be")).toBeUndefined()
  })

  it("picks the weakest skills below the threshold with a practice set", () => {
    const weak = weakestSkills(answers, sets, { limit: 2 })
    expect(weak.map((w) => [w.skill, w.practiceSetId])).toEqual([
      ["Dấu hỏi/ngã", undefined],
      ["Toán có lời văn", "loi-van"],
    ])
    const strong = [answer(["A"], 1), answer(["A"], 1), answer(["A"], 1)]
    expect(weakestSkills(strong, sets)).toEqual([])
  })
})

describe("reports", () => {
  const list = [
    // On time, retried: 5 → 8.
    assignment("2026-10-05T20:00:00", [attempt(1, "2026-10-05T19:00:00", "2026-10-05T21:00:00", 5, 20), attempt(2, "2026-10-06T19:00:00", "2026-10-06T21:00:00", 8, 5)]),
    // Late submission.
    assignment("2026-10-07T20:00:00", [attempt(1, "2026-10-08T19:00:00", "2026-10-08T21:00:00", 9)], { subject: "tieng-viet" }),
    // Overdue, never submitted: counts as not on time.
    assignment("2026-10-09T20:00:00", []),
    // Not due yet and not submitted: left out of the on-time rate.
    assignment("2026-10-20T20:00:00", []),
    // Retry with a drop: 9 → 8.
    assignment("2026-10-13T20:00:00", [attempt(1, "2026-10-13T19:00:00", "2026-10-13T21:00:00", 9), attempt(2, "2026-10-14T19:00:00", "2026-10-14T21:00:00", 8)]),
    // Previous period.
    assignment("2026-09-10T20:00:00", [attempt(1, "2026-09-10T19:00:00", "2026-09-10T21:00:00", 6)]),
  ]
  const period = rangePeriod("4w", now)

  it("builds range periods", () => {
    expect(period).toEqual({ from: new Date(2026, 8, 21), to: new Date(2026, 9, 16) })
    expect(rangePeriod("3m", now).from).toEqual(new Date(2026, 6, 20))
    expect(rangePeriod("hk", now).from).toEqual(new Date(2026, 8, 5))
    expect(rangePeriod("custom", now, { from: "2026-10-01", to: "2026-10-10" })).toEqual({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 11) })
    expect(previousPeriod({ from: new Date(2026, 9, 11), to: new Date(2026, 9, 18) })).toEqual({ from: new Date(2026, 9, 4), to: new Date(2026, 9, 11) })
  })

  it("finds the semester start", () => {
    expect(semesterStart(new Date(2026, 9, 15))).toEqual(new Date(2026, 8, 5))
    expect(semesterStart(new Date(2027, 2, 1))).toEqual(new Date(2027, 0, 15))
    expect(semesterStart(new Date(2027, 0, 3))).toEqual(new Date(2026, 8, 5))
  })

  it("counts completed assignments and filters by range", () => {
    expect(completedCount(list, period)).toBe(3)
    expect(completedCount(list, previousPeriod(period))).toBe(1)
    expect(completedCount([], period)).toBe(0)
  })

  it("computes the on-time rate from first submissions", () => {
    // Due in range and relevant: a1 (on time), a2 (late), a3 (missed), a5 (on time).
    expect(onTimeRate(list, period, now)).toBe(50)
    expect(onTimeRate([], period, now)).toBeNull()
  })

  it("pairs graded retries and averages the gain", () => {
    const pairs = retryPairs(list, period)
    expect(pairs.map((p) => [p.first, p.second])).toEqual([
      [9, 8],
      [5, 8],
    ])
    expect(retryGain(pairs)).toBe(1)
    expect(retryGain([])).toBeNull()
    // A retry still waiting for grading is not a pair.
    expect(retryPairs([assignment("2026-10-13T20:00:00", [attempt(1, "2026-10-13T19:00:00", "2026-10-13T21:00:00", 5), attempt(2, "2026-10-14T19:00:00", null, null)])])).toEqual([])
  })

  it("averages minutes per subject", () => {
    expect(averageMinutes(list, period)).toEqual({ toan: 14, "tieng-viet": 15 })
  })

  it("builds an activity grid of Monday-first weeks", () => {
    const grid = activityGrid(list, period, now)
    expect(grid).toHaveLength(4)
    expect(grid.every((w) => w.length === 7)).toBe(true)
    const cell = (y: number, m: number, d: number) => grid.flat().find((c) => new Date(c.date).getTime() === new Date(y, m, d).getTime())
    expect(cell(2026, 9, 5)?.count).toBe(1)
    expect(cell(2026, 9, 4)?.count).toBe(0)
    expect(cell(2026, 9, 16)?.count).toBe(-1) // future
    expect(activityGrid(list, rangePeriod("hk", now), now, 3)).toHaveLength(3)
  })

  it("builds a full report and a summary, including with no data", () => {
    const report = buildReport({ assignments: list, answers: [], sets: [] }, period, now)
    expect(report.kpis).toEqual({ completed: 3, average: (5 + 8 + 9 + 9 + 8) / 5, onTime: 50, retryGain: 1 })
    expect(report.previous.completed).toBe(1)
    expect(report.subjectAverages).toEqual({ toan: 7.5, "tieng-viet": 9 })
    expect(summarize(report, "An").summary).toContain("An đã hoàn thành 3 bài")

    const filtered = buildReport({ assignments: list, answers: [], sets: [] }, period, now, ["tieng-anh"])
    expect(filtered.kpis).toEqual({ completed: 0, average: null, onTime: null, retryGain: null })
    expect(filtered.weekly.every((w) => Object.keys(w).length === 1)).toBe(true)
    expect(summarize(filtered, "An")).toEqual({ summary: expect.stringContaining("Chưa có bài nào"), steps: [] })
  })
})
