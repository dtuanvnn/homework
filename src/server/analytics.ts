import "server-only"
import { sql } from "drizzle-orm"
import { db, schema } from "@/db"
import {
  averageScore,
  dueOn,
  lastWeeks,
  previousPeriod,
  summarizeWeek,
  weakestSkills,
  weekPeriod,
  weeklySubjectScores,
  inPeriod,
  type AnswerFact,
  type AssignmentFact,
  type ReportInput,
  type SetSkills,
  type WeakSkill,
  type WeekSummary,
  type WeeklySubjectPoint,
} from "@/lib/analytics"
import { startOfWeek } from "@/lib/dates"
import type { AssignmentStatus, SubjectId } from "@/lib/types"
import { listAssignments, listExerciseSets, listGradedAnswers, type AssignmentRecord } from "./queries"
import { toAssignment } from "./views"
import { getContext } from "./access"

/*
 * Loads the facts the analytics in lib/analytics.ts work on. Everything
 * returned is plain JSON (ISO dates) so it can cross into client components.
 */

const iso = (d: Date | null) => (d ? d.toISOString() : null)

function toFact(r: AssignmentRecord): AssignmentFact {
  return {
    id: r.id,
    setId: r.setId,
    title: r.set.title,
    subject: r.set.subject,
    availableFrom: r.availableFrom.toISOString(),
    dueAt: r.dueAt.toISOString(),
    maxAttempts: r.maxAttempts,
    attempts: r.attempts.map((t) => ({
      attemptNo: t.attemptNo,
      submittedAt: iso(t.submittedAt),
      gradedAt: iso(t.gradedAt),
      score: t.score,
      durationSeconds: t.durationSeconds,
      retryAllowed: t.retryAllowed,
    })),
  }
}

async function loadAnswers(): Promise<AnswerFact[]> {
  const rows = await listGradedAnswers()
  return rows.flatMap((r) => {
    if (!r.gradedAt) return []
    const points = r.question.points ?? 0
    return [
      {
        // listGradedAnswers has no attempt id; set + grading time + attempt number identifies the attempt.
        attemptKey: `${r.setId}|${r.gradedAt.toISOString()}|${r.attemptNo}`,
        subject: r.subject,
        setId: r.setId,
        skills: r.question.skills ?? [],
        points,
        earned: r.pointsAwarded ?? (r.isCorrect ? points : 0),
        correct: r.isCorrect === true,
        gradedAt: r.gradedAt.toISOString(),
      },
    ]
  })
}

async function loadSetSkills(): Promise<SetSkills[]> {
  const { questions, exerciseSets } = schema
  const { householdId } = await getContext()
  const [sets, skillRows] = await Promise.all([
    listExerciseSets(),
    db.execute<{ set_id: string; skills: string[] }>(sql`
      select q.set_id, array_agg(distinct s.skill) as skills
      from ${questions} q
      join ${exerciseSets} es on es.id = q.set_id and es.household_id = ${householdId},
      jsonb_array_elements_text(coalesce(q.content->'skills', '[]'::jsonb)) as s(skill)
      group by q.set_id
    `),
  ])
  const skillsBySet = new Map(skillRows.rows.map((r) => [r.set_id, r.skills]))
  return sets.map((s) => ({ id: s.id, title: s.title, subject: s.subject, status: s.status, kind: s.kind, skills: skillsBySet.get(s.id) ?? [] }))
}

export interface TodayItem {
  id: string
  title: string
  subject: SubjectId
  dueDate: string
  status: AssignmentStatus
}

export interface DashboardData {
  /** Server time the data was computed at (ISO). */
  now: string
  summary: WeekSummary
  average: number | null
  previousAverage: number | null
  today: TodayItem[]
  chart: WeeklySubjectPoint[]
  weakSkills: WeakSkill[]
}

export async function loadDashboard(now: Date): Promise<DashboardData> {
  const [records, answers, sets] = await Promise.all([listAssignments(), loadAnswers(), loadSetSkills()])
  const facts = records.map(toFact)
  const byId = new Map(records.map((r) => [r.id, r]))
  const week = weekPeriod(startOfWeek(now))
  const chartPeriod = lastWeeks(now, 6)

  return {
    now: now.toISOString(),
    summary: summarizeWeek(facts, now),
    average: averageScore(facts, week),
    previousAverage: averageScore(facts, previousPeriod(week)),
    today: dueOn(facts, now).map((f) => ({
      id: f.id,
      title: f.title,
      subject: f.subject,
      dueDate: f.dueAt,
      status: toAssignment(byId.get(f.id)!, now).status,
    })),
    chart: weeklySubjectScores(facts, chartPeriod),
    // "Recent" = the same 6 weeks as the chart.
    weakSkills: weakestSkills(
      answers.filter((a) => inPeriod(a.gradedAt, chartPeriod)),
      sets,
    ),
  }
}

/** Raw facts for the reports page, which filters and aggregates them per range on the client. */
export async function loadReportInput(): Promise<ReportInput> {
  const [records, answers, sets] = await Promise.all([listAssignments(), loadAnswers(), loadSetSkills()])
  return { assignments: records.map(toFact), answers, sets }
}
