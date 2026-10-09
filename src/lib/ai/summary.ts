import { z } from "zod"
import { round1, type Report, type SetSkills } from "@/lib/analytics"
import { SUBJECTS } from "@/lib/subjects"
import type { SubjectId } from "@/lib/types"

/*
 * Pure pieces of the AI progress summary on the Reports page: the system
 * prompt, the compact facts sent to Claude (numbers only, computed by
 * lib/analytics.ts), the candidate practice sets and the validation of
 * Claude's next steps. The action lives in server/actions/ai-summary.ts.
 */

export const SUMMARY_SYSTEM = `You write a short progress review for a Vietnamese parent about their child, a grade-3 primary-school student in Vietnam who does homework in Toán (maths), Tiếng Việt and Tiếng Anh in a homework app.

You get compact statistics for one period (JSON): KPIs (completed assignments, average score on a 10-point scale, on-time submission rate, average gain when redoing an assignment) with the previous period for comparison, weekly averages per subject, subject averages, skills with accuracy (% of points earned) and sample size (number of graded answers), and recent feedback the parent wrote. You also get a list of candidate practice sets.

Write in Vietnamese, for the parent (refer to the child by name or as "con"):
- summary: 3–5 sentences. Use the specific numbers (e.g. "điểm trung bình 8,2/10, tăng 0,6 điểm so với kỳ trước"). Mention what is going well, then what needs attention, with the evidence. Warm and honest: no exaggeration, no alarm, no generic filler. Do not claim trends from very small samples (a skill with fewer than 3 answers, or a single week); say so instead. Decimal numbers use a comma (8,5). Never invent numbers that are not in the data.
- steps: up to 3 concrete next steps for the parent, most useful first. text: a short action (≤ 8 words, e.g. "Luyện thêm bảng nhân 7"); detail: one short sentence with the reason (numbers) or how to do it. setId: the id of a candidate set that practises exactly this, or null when none fits — never make up an id. Prefer steps on weak skills with enough samples; habits (on-time submission, redoing assignments) are fine as steps without a set.
If there is no graded work in the period, say so briefly in the summary and return no steps.`

export const summaryResultSchema = z.object({
  summary: z.string().describe("3-5 Vietnamese sentences for the parent"),
  steps: z
    .array(
      z.object({
        text: z.string().describe("Short Vietnamese action, at most 8 words"),
        detail: z.string().describe("One short Vietnamese sentence: reason with numbers, or how"),
        setId: z.string().nullable().describe("id of a candidate practice set, or null"),
      }),
    )
    .describe("Up to 3 next steps"),
})
export type SummaryResult = z.infer<typeof summaryResultSchema>

export interface AiStep {
  text: string
  detail: string
  setId: string | null
  /** Subject of the linked set, for the step's colour. */
  subject: SubjectId | null
}

export interface AiSummary {
  summary: string
  steps: AiStep[]
  /** ISO time the summary was generated. */
  generatedAt: string
}

export interface FeedbackSnippet {
  title: string
  subject: SubjectId
  gradedAt: string
  score: number | null
  feedback: string
}

export const MAX_CANDIDATES = 20

/**
 * Ready sets of the selected subjects Claude may link a step to: sets that
 * practise a weak skill first, then focused practice before tests, then fewer skills.
 */
export function candidateSets(sets: SetSkills[], report: Report, subjects: SubjectId[], limit = MAX_CANDIDATES): SetSkills[] {
  const weak = new Set(report.skills.filter((s) => s.accuracy < 80).map((s) => `${s.subject}|${s.skill}`))
  const covers = (s: SetSkills) => s.skills.some((k) => weak.has(`${s.subject}|${k}`))
  return sets
    .filter((s) => subjects.includes(s.subject) && s.status === "san-sang")
    .sort(
      (a, b) =>
        Number(covers(b)) - Number(covers(a)) ||
        Number(a.kind === "de-thi") - Number(b.kind === "de-thi") ||
        a.skills.length - b.skills.length ||
        a.title.localeCompare(b.title, "vi"),
    )
    .slice(0, limit)
}

const r1 = (n: number | null) => (n === null ? null : round1(n))

/** The compact facts sent to Claude. Skills are limited to the 5 weakest and 3 strongest. */
export function summaryFacts(input: {
  studentName: string
  grade: number
  period: { from: string; to: string }
  subjects: SubjectId[]
  report: Report
  feedback: FeedbackSnippet[]
}) {
  const { report } = input
  const kpis = (k: Report["kpis"]) => ({
    completedAssignments: k.completed,
    averageScore: r1(k.average),
    onTimeRatePercent: k.onTime,
    averageRetryGain: r1(k.retryGain),
  })
  const skill = (s: Report["skills"][number]) => ({
    subject: SUBJECTS[s.subject].name,
    skill: s.skill,
    accuracyPercent: s.accuracy,
    answers: s.totalCount,
    wrong: s.wrongCount,
  })
  const strongest = [...report.skills].reverse().filter((s) => s.accuracy >= 80).slice(0, 3)
  return {
    student: { name: input.studentName, grade: input.grade },
    period: input.period,
    subjects: input.subjects.map((s) => SUBJECTS[s].name),
    kpis: kpis(report.kpis),
    previousPeriodKpis: kpis(report.previous),
    subjectAverages: Object.fromEntries(Object.entries(report.subjectAverages).map(([k, v]) => [SUBJECTS[k as SubjectId].name, v])),
    weeklyAverages: report.weekly.map((w) => ({
      weekStart: w.weekStart.slice(0, 10),
      ...Object.fromEntries(input.subjects.filter((s) => w[s] !== undefined).map((s) => [SUBJECTS[s].name, w[s]])),
    })),
    weakestSkills: report.skills.slice(0, 5).map(skill),
    strongestSkills: strongest.map(skill),
    retries: report.retries.slice(0, 5).map((r) => ({ title: r.title, first: r.first, second: r.second })),
    averageMinutesPerAssignment: Object.fromEntries(Object.entries(report.minutes).map(([k, v]) => [SUBJECTS[k as SubjectId].name, v])),
    recentParentFeedback: input.feedback.slice(0, 5).map((f) => ({
      title: f.title,
      subject: SUBJECTS[f.subject].name,
      date: f.gradedAt.slice(0, 10),
      score: f.score,
      feedback: f.feedback.length > 200 ? `${f.feedback.slice(0, 199)}…` : f.feedback,
    })),
  }
}

export function candidateList(sets: SetSkills[]) {
  return sets.map((s) => ({ id: s.id, title: s.title, subject: SUBJECTS[s.subject].name, skills: s.skills }))
}

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** Keeps up to 3 non-empty steps; set ids not among the candidates become null. */
export function validateSummary(result: SummaryResult, candidates: SetSkills[], generatedAt: string): AiSummary {
  const byId = new Map(candidates.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const steps = result.steps
    .map((s) => ({ text: clip(s.text, 80), detail: clip(s.detail, 240), setId: s.setId?.trim() ?? null }))
    .filter((s) => s.text)
    .slice(0, 3)
    .map((s) => {
      const set = s.setId ? byId.get(s.setId) : undefined
      // The same set twice gets one "Giao bài" button.
      const setId = set && !seen.has(set.id) ? set.id : null
      if (setId) seen.add(setId)
      return { ...s, setId, subject: set?.subject ?? null }
    })
  return { summary: clip(result.summary, 1500), steps, generatedAt }
}
