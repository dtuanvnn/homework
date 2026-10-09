import { deriveAssignmentState } from "./assignment-status"
import { addDays, startOfDay, startOfWeek } from "./dates"
import { SUBJECTS } from "./subjects"
import type { ExerciseKind, ExerciseSetStatus, SubjectId } from "./types"

/*
 * Pure analytics for the parent dashboard and reports. Inputs are plain,
 * serializable facts (ISO date strings) built by server/analytics.ts, so the
 * same functions run on the server and in the browser. Day and week
 * boundaries use local time (Vietnam, see instrumentation.ts).
 */

export const SUBJECT_IDS: SubjectId[] = ["toan", "tieng-viet", "tieng-anh"]

/** A skill needs at least this many graded answers before it is judged. */
export const MIN_SKILL_SAMPLES = 3
/** Skills at or above this accuracy (%) are not flagged as weak. */
export const WEAK_SKILL_BELOW = 80

const DAY_MS = 86_400_000

/* ---------- Inputs ---------- */

export interface AttemptFact {
  attemptNo: number
  submittedAt: string | null
  gradedAt: string | null
  /** 10-point scale; null until graded. */
  score: number | null
  durationSeconds: number | null
  retryAllowed: boolean
}

export interface AssignmentFact {
  id: string
  setId: string
  title: string
  subject: SubjectId
  availableFrom: string
  dueAt: string
  maxAttempts: number
  /** Sorted by attempt number. */
  attempts: AttemptFact[]
}

/** One graded answer, flattened for skill analytics. */
export interface AnswerFact {
  /** Identifies the attempt the answer belongs to. */
  attemptKey: string
  subject: SubjectId
  setId: string
  skills: string[]
  points: number
  earned: number
  correct: boolean
  gradedAt: string
}

export interface SetSkills {
  id: string
  title: string
  subject: SubjectId
  status: ExerciseSetStatus
  kind: ExerciseKind
  skills: string[]
}

/** Half-open time range [from, to). */
export interface Period {
  from: Date
  to: Date
}

/* ---------- Small helpers ---------- */

const time = (iso: string) => new Date(iso).getTime()

export function inPeriod(iso: string | null | undefined, period: Period): boolean {
  if (!iso) return false
  const t = time(iso)
  return t >= period.from.getTime() && t < period.to.getTime()
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export function weekPeriod(weekStart: Date): Period {
  return { from: weekStart, to: addDays(weekStart, 7) }
}

export function previousPeriod(period: Period): Period {
  const length = period.to.getTime() - period.from.getTime()
  return { from: new Date(period.from.getTime() - length), to: period.from }
}

function toAttemptLike(a: AttemptFact) {
  return {
    attemptNo: a.attemptNo,
    submittedAt: a.submittedAt ? new Date(a.submittedAt) : null,
    gradedAt: a.gradedAt ? new Date(a.gradedAt) : null,
    score: a.score,
    retryAllowed: a.retryAllowed,
  }
}

export function stateOfFact(a: AssignmentFact, now: Date) {
  return deriveAssignmentState(
    { availableFrom: new Date(a.availableFrom), dueAt: new Date(a.dueAt), maxAttempts: a.maxAttempts },
    a.attempts.map(toAttemptLike),
    now,
  )
}

const latestAttempt = (a: AssignmentFact) => a.attempts.at(-1)

/** Graded attempts, each with its assignment. */
export function gradedAttempts(list: AssignmentFact[]) {
  return list.flatMap((assignment) =>
    assignment.attempts
      .filter((a): a is AttemptFact & { gradedAt: string; score: number } => a.gradedAt !== null && a.score !== null)
      .map((attempt) => ({ assignment, attempt })),
  )
}

/* ---------- Dashboard ---------- */

export interface WeekSummary {
  /** Assignments due this week (Mon–Sun). */
  total: number
  /** Of those, submitted (awaiting grading or graded). */
  done: number
  /** Latest attempt submitted and not graded yet (same rule as the nav badge). */
  awaitingGrading: number
  /** Past due without a submission. */
  overdue: number
  /** Title of the most overdue assignment. */
  overdueTitle?: string
}

export function summarizeWeek(list: AssignmentFact[], now: Date): WeekSummary {
  const week = weekPeriod(startOfWeek(now))
  const thisWeek = list.filter((a) => inPeriod(a.dueAt, week))
  const overdue = list.filter((a) => stateOfFact(a, now).overdue).sort((a, b) => time(a.dueAt) - time(b.dueAt))
  return {
    total: thisWeek.length,
    done: thisWeek.filter((a) => latestAttempt(a)?.submittedAt).length,
    awaitingGrading: list.filter((a) => {
      const latest = latestAttempt(a)
      return latest?.submittedAt && !latest.gradedAt
    }).length,
    overdue: overdue.length,
    overdueTitle: overdue[0]?.title,
  }
}

/** Average score of attempts graded in the period, or null without data. */
export function averageScore(list: AssignmentFact[], period: Period): number | null {
  return average(gradedAttempts(list).filter(({ attempt }) => inPeriod(attempt.gradedAt, period)).map(({ attempt }) => attempt.score))
}

/** Assignments due on the given local day, by due time. */
export function dueOn(list: AssignmentFact[], day: Date): AssignmentFact[] {
  const period = { from: startOfDay(day), to: addDays(startOfDay(day), 1) }
  return list.filter((a) => inPeriod(a.dueAt, period)).sort((a, b) => time(a.dueAt) - time(b.dueAt))
}

export type WeeklySubjectPoint = { weekStart: string } & Partial<Record<SubjectId, number>>

/**
 * Average score per subject for each week overlapping the period (oldest
 * first), bucketed by grading time. Weeks without data leave the subject out.
 */
export function weeklySubjectScores(list: AssignmentFact[], period: Period): WeeklySubjectPoint[] {
  const graded = gradedAttempts(list)
  const points: WeeklySubjectPoint[] = []
  for (let weekStart = startOfWeek(period.from); weekStart < period.to; weekStart = addDays(weekStart, 7)) {
    const week = weekPeriod(weekStart)
    const inWeek = graded.filter(({ attempt }) => inPeriod(attempt.gradedAt, week) && inPeriod(attempt.gradedAt, period))
    const point: WeeklySubjectPoint = { weekStart: weekStart.toISOString() }
    for (const subject of SUBJECT_IDS) {
      const avg = average(inWeek.filter(({ assignment }) => assignment.subject === subject).map(({ attempt }) => attempt.score))
      if (avg !== null) point[subject] = round1(avg)
    }
    points.push(point)
  }
  return points
}

/** The last `weeks` whole weeks up to and including the current one. */
export function lastWeeks(now: Date, weeks: number): Period {
  const current = startOfWeek(now)
  return { from: addDays(current, -7 * (weeks - 1)), to: addDays(current, 7) }
}

/* ---------- Skills ---------- */

export interface SkillStat {
  subject: SubjectId
  skill: string
  /** Earned points / possible points, 0–100. */
  accuracy: number
  wrongCount: number
  totalCount: number
  /** Distinct attempts the skill appeared in. */
  attempts: number
}

/** Accuracy per (subject, skill), weakest first. */
export function skillAccuracy(answers: AnswerFact[], minSamples = 1): SkillStat[] {
  const groups = new Map<string, { subject: SubjectId; skill: string; earned: number; points: number; wrong: number; total: number; attempts: Set<string> }>()
  for (const answer of answers) {
    for (const skill of new Set(answer.skills)) {
      const key = `${answer.subject}|${skill}`
      const g = groups.get(key) ?? { subject: answer.subject, skill, earned: 0, points: 0, wrong: 0, total: 0, attempts: new Set<string>() }
      g.earned += answer.earned
      g.points += answer.points
      g.total += 1
      if (!answer.correct) g.wrong += 1
      g.attempts.add(answer.attemptKey)
      groups.set(key, g)
    }
  }
  return [...groups.values()]
    .filter((g) => g.total >= minSamples && g.points > 0)
    .map((g) => ({
      subject: g.subject,
      skill: g.skill,
      accuracy: Math.round((Math.min(g.earned, g.points) / g.points) * 100),
      wrongCount: g.wrong,
      totalCount: g.total,
      attempts: g.attempts.size,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.totalCount - a.totalCount || a.skill.localeCompare(b.skill, "vi"))
}

/**
 * A ready set of the subject that practises the skill; else any ready set of
 * the subject; else any set of it. Focused practice beats tests: exams go
 * last, then sets covering fewer skills first.
 */
export function suggestPracticeSet(sets: SetSkills[], subject: SubjectId, skill: string): SetSkills | undefined {
  const sameSubject = sets
    .filter((s) => s.subject === subject)
    .sort((a, b) => Number(a.kind === "de-thi") - Number(b.kind === "de-thi") || a.skills.length - b.skills.length)
  const ready = sameSubject.filter((s) => s.status === "san-sang")
  return ready.find((s) => s.skills.includes(skill)) ?? ready[0] ?? sameSubject.find((s) => s.skills.includes(skill)) ?? sameSubject[0]
}

export interface WeakSkill extends SkillStat {
  id: string
  practiceSetId?: string
  practiceTitle?: string
}

export function weakestSkills(
  answers: AnswerFact[],
  sets: SetSkills[],
  { limit = 3, minSamples = MIN_SKILL_SAMPLES }: { limit?: number; minSamples?: number } = {},
): WeakSkill[] {
  return skillAccuracy(answers, minSamples)
    .filter((s) => s.accuracy < WEAK_SKILL_BELOW)
    .slice(0, limit)
    .map((s) => {
      const practice = suggestPracticeSet(sets, s.subject, s.skill)
      return { ...s, id: `${s.subject}|${s.skill}`, practiceSetId: practice?.id, practiceTitle: practice?.title }
    })
}

/* ---------- Reports ---------- */

export type RangeId = "4w" | "3m" | "hk" | "custom"

/** First day of the current semester: 5 Sep (HK I) or 15 Jan (HK II). */
export function semesterStart(now: Date): Date {
  const year = now.getFullYear()
  const hk1 = new Date(year, 8, 5)
  const hk2 = new Date(year, 0, 15)
  if (now >= hk1) return hk1
  if (now >= hk2) return hk2
  return new Date(year - 1, 8, 5)
}

/** "yyyy-mm-dd" (from a date input) to local midnight. */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** The report period for a range; `to` is the end of today (or of the custom end day). */
export function rangePeriod(range: RangeId, now: Date, custom?: { from: string; to: string }): Period {
  const endOfToday = addDays(startOfDay(now), 1)
  const thisWeek = startOfWeek(now)
  switch (range) {
    case "4w":
      return { from: addDays(thisWeek, -21), to: endOfToday }
    case "3m":
      return { from: addDays(thisWeek, -12 * 7), to: endOfToday }
    case "hk":
      return { from: semesterStart(now), to: endOfToday }
    case "custom": {
      if (!custom) return { from: addDays(thisWeek, -7 * 7), to: endOfToday }
      const from = parseDateInput(custom.from)
      const to = addDays(parseDateInput(custom.to), 1)
      return to > from ? { from, to } : { from, to: addDays(from, 1) }
    }
  }
}

/** Assignments with a graded attempt in the period. */
export function completedCount(list: AssignmentFact[], period: Period): number {
  return new Set(gradedAttempts(list).filter(({ attempt }) => inPeriod(attempt.gradedAt, period)).map(({ assignment }) => assignment.id)).size
}

/**
 * Share (0–100) of assignments due in the period whose first attempt was
 * submitted by the due time. Assignments not yet due and not submitted are
 * left out; past-due ones without a submission count as late.
 */
export function onTimeRate(list: AssignmentFact[], period: Period, now: Date): number | null {
  const relevant = list.filter((a) => inPeriod(a.dueAt, period) && (time(a.dueAt) <= now.getTime() || a.attempts[0]?.submittedAt))
  if (!relevant.length) return null
  const onTime = relevant.filter((a) => {
    const first = a.attempts[0]?.submittedAt
    return first !== null && first !== undefined && time(first) <= time(a.dueAt)
  }).length
  return Math.round((onTime / relevant.length) * 100)
}

export interface RetryPair {
  assignmentId: string
  title: string
  subject: SubjectId
  first: number
  second: number
  /** When the second attempt was graded. */
  gradedAt: string
}

/** Assignments where both attempts are graded; the second graded in the period. Newest first. */
export function retryPairs(list: AssignmentFact[], period?: Period): RetryPair[] {
  return list
    .flatMap((a) => {
      const first = a.attempts.find((t) => t.attemptNo === 1)
      const second = a.attempts.find((t) => t.attemptNo === 2)
      if (first?.score == null || !first.gradedAt || second?.score == null || !second.gradedAt) return []
      if (period && !inPeriod(second.gradedAt, period)) return []
      return [{ assignmentId: a.id, title: a.title, subject: a.subject, first: first.score, second: second.score, gradedAt: second.gradedAt }]
    })
    .sort((a, b) => time(b.gradedAt) - time(a.gradedAt))
}

/** Average of (attempt 2 − attempt 1), or null without retries. */
export function retryGain(pairs: RetryPair[]): number | null {
  return average(pairs.map((p) => p.second - p.first))
}

export interface ActivityCell {
  /** Local midnight, ISO. */
  date: string
  /** Submissions that day; -1 outside the period or in the future. */
  count: number
}

/** Submissions per day as Monday-first weeks, at most `maxWeeks` (the latest ones). */
export function activityGrid(list: AssignmentFact[], period: Period, now: Date, maxWeeks = 18): ActivityCell[][] {
  const perDay = new Map<number, number>()
  for (const a of list) {
    for (const t of a.attempts) {
      if (!t.submittedAt || !inPeriod(t.submittedAt, period)) continue
      const day = startOfDay(new Date(t.submittedAt)).getTime()
      perDay.set(day, (perDay.get(day) ?? 0) + 1)
    }
  }
  const lastDay = new Date(Math.min(period.to.getTime() - 1, now.getTime()))
  const lastWeek = startOfWeek(lastDay < period.from ? period.from : lastDay)
  const firstWeek = startOfWeek(period.from)
  const weeks = Math.min(maxWeeks, Math.round((lastWeek.getTime() - firstWeek.getTime()) / (7 * DAY_MS)) + 1)
  const start = addDays(lastWeek, -7 * (weeks - 1))
  const today = startOfDay(now)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d)
      const outside = date > today || date < startOfDay(period.from) || date >= period.to
      return { date: date.toISOString(), count: outside ? -1 : (perDay.get(date.getTime()) ?? 0) }
    }),
  )
}

/** Average minutes per subject over submitted attempts with a recorded duration. */
export function averageMinutes(list: AssignmentFact[], period: Period): Partial<Record<SubjectId, number>> {
  const result: Partial<Record<SubjectId, number>> = {}
  for (const subject of SUBJECT_IDS) {
    const durations = list
      .filter((a) => a.subject === subject)
      .flatMap((a) => a.attempts)
      .filter((t) => t.durationSeconds !== null && inPeriod(t.submittedAt, period))
      .map((t) => t.durationSeconds! / 60)
    const avg = average(durations)
    if (avg !== null) result[subject] = Math.round(avg)
  }
  return result
}

/** Average score per subject over attempts graded in the period. */
export function subjectAverages(list: AssignmentFact[], period: Period): Partial<Record<SubjectId, number>> {
  const result: Partial<Record<SubjectId, number>> = {}
  for (const subject of SUBJECT_IDS) {
    const avg = averageScore(list.filter((a) => a.subject === subject), period)
    if (avg !== null) result[subject] = round1(avg)
  }
  return result
}

export interface ReportKpis {
  completed: number
  average: number | null
  onTime: number | null
  retryGain: number | null
}

export function reportKpis(list: AssignmentFact[], period: Period, now: Date): ReportKpis {
  return {
    completed: completedCount(list, period),
    average: averageScore(list, period),
    onTime: onTimeRate(list, period, now),
    retryGain: retryGain(retryPairs(list, period)),
  }
}

export interface Report {
  kpis: ReportKpis
  previous: ReportKpis
  weekly: WeeklySubjectPoint[]
  subjectAverages: Partial<Record<SubjectId, number>>
  skills: SkillStat[]
  weakSkills: WeakSkill[]
  retries: RetryPair[]
  activity: ActivityCell[][]
  minutes: Partial<Record<SubjectId, number>>
}

export interface ReportInput {
  assignments: AssignmentFact[]
  answers: AnswerFact[]
  sets: SetSkills[]
}

/** Everything the reports page shows, for one period and subject filter. */
export function buildReport(input: ReportInput, period: Period, now: Date, subjects: SubjectId[] = SUBJECT_IDS): Report {
  const list = input.assignments.filter((a) => subjects.includes(a.subject))
  const answers = input.answers.filter((a) => subjects.includes(a.subject) && inPeriod(a.gradedAt, period))
  return {
    kpis: reportKpis(list, period, now),
    previous: reportKpis(list, previousPeriod(period), now),
    weekly: weeklySubjectScores(list, period),
    subjectAverages: subjectAverages(list, period),
    skills: skillAccuracy(answers, MIN_SKILL_SAMPLES),
    weakSkills: weakestSkills(answers, input.sets),
    retries: retryPairs(list, period),
    activity: activityGrid(list, period, now),
    minutes: averageMinutes(list, period),
  }
}

/* ---------- Rule-based summary (placeholder until the AI review in Phase 2) ---------- */

const num = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })

export interface NextStep {
  text: string
  detail: string
  subject: SubjectId
  setId?: string
}

export function summarize(report: Report, studentName: string): { summary: string; steps: NextStep[] } {
  const { kpis, previous } = report
  if (kpis.completed === 0 || kpis.average === null) {
    return { summary: `Chưa có bài nào của ${studentName} được chấm trong khoảng thời gian này.`, steps: [] }
  }

  const parts: string[] = []
  let first = `Trong kỳ này ${studentName} đã hoàn thành ${kpis.completed} bài, điểm trung bình ${num(round1(kpis.average))}/10`
  if (previous.average !== null) {
    const delta = round1(kpis.average - previous.average)
    first += delta > 0 ? `, tăng ${num(delta)} điểm so với kỳ trước` : delta < 0 ? `, giảm ${num(-delta)} điểm so với kỳ trước` : ", giữ nguyên so với kỳ trước"
  }
  parts.push(`${first}.`)

  const ranked = SUBJECT_IDS.filter((s) => report.subjectAverages[s] !== undefined).sort(
    (a, b) => report.subjectAverages[b]! - report.subjectAverages[a]!,
  )
  if (ranked.length > 1) parts.push(`${SUBJECTS[ranked[0]].name} đang là môn tốt nhất (${num(report.subjectAverages[ranked[0]]!)} điểm).`)

  if (kpis.onTime !== null) {
    parts.push(kpis.onTime >= 90 ? `Con nộp bài rất đúng hạn (${kpis.onTime}%).` : `Tỷ lệ nộp đúng hạn là ${kpis.onTime}%, cần nhắc con làm bài sớm hơn.`)
  }
  if (kpis.retryGain !== null && kpis.retryGain > 0) {
    parts.push(`Khi làm lại lần 2, điểm của con tăng trung bình ${num(round1(kpis.retryGain))} điểm.`)
  }

  const weak = report.weakSkills
  if (weak.length) {
    const names = weak.slice(0, 2).map((s) => `${s.skill} (${s.accuracy}% đúng)`)
    parts.push(`Cần chú ý: ${names.join(" và ")}.`)
  } else {
    parts.push("Không có kỹ năng nào dưới 80% đúng, con đang làm tốt.")
  }

  const steps = weak.map((s) => ({
    text: `Luyện thêm: ${s.skill}`,
    detail: s.practiceTitle ? `Đúng ${s.accuracy}% · gợi ý bài “${s.practiceTitle}”` : `Đúng ${s.accuracy}% · chưa có bài ${SUBJECTS[s.subject].name} phù hợp`,
    subject: s.subject,
    setId: s.practiceSetId,
  }))
  return { summary: parts.join(" "), steps }
}
