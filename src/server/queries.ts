import "server-only"
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { db, schema } from "@/db"
import { isUuid } from "@/lib/ids"
import { withLaterAnswerKey } from "@/lib/answer-key"
import type { Attachment, Difficulty, ExerciseSet, Question, Student } from "@/lib/types"
import { settleExpiredAttempts } from "./attempt-finalize"
import { withImageUrls } from "./question-images"
import { loadRewards } from "./rewards"
import { attachmentUrl } from "./storage"
import { getContext } from "./access"
import { toStudent } from "./students"

/*
 * Read-side data access. Returns the UI's own types (see lib/types.ts) so
 * page components stay unaware of the database. Scoped by the request context
 * (server/access.ts): sets by household, assignments and attempts by child.
 */

const { students, exerciseSets, questions, assignments, attempts, answers, attachments, rewardRedemptions } = schema

type SetRow = typeof exerciseSets.$inferSelect
type AttemptRow = typeof attempts.$inferSelect
type AttachmentRow = typeof attachments.$inferSelect

export type AttemptRecord = Omit<AttemptRow, "assignmentId">

export interface AssignmentRecord {
  id: string
  setId: string
  availableFrom: Date
  dueAt: Date
  mode: "web" | "paper"
  maxAttempts: 1 | 2
  timeLimitMinutes: number | null
  parentNote: string | null
  createdAt: Date
  set: ExerciseSet
  /** Sorted by attempt number. */
  attempts: AttemptRecord[]
}

export function toExerciseSet(row: SetRow, questionCount: number, timesAssigned: number): ExerciseSet {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: row.grade,
    topic: row.topic,
    description: row.description,
    questionCount,
    estimatedMinutes: row.estimatedMinutes,
    difficulty: row.difficulty as Difficulty,
    kind: row.kind,
    source: row.source,
    status: row.status,
    timesAssigned,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function toAttachment(row: AttachmentRow): Promise<Attachment> {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    sizeKb: row.sizeKb,
    pages: row.pages ?? undefined,
    url: await attachmentUrl(row),
  }
}

/* ---------- Student ---------- */

/** The child this request is about (device child or the parent's viewing child); null when the household has none. */
export async function getViewingStudent(): Promise<Student | null> {
  const { studentId } = await getContext()
  if (!studentId) return null
  const row = await db.query.students.findFirst({ where: eq(students.id, studentId) })
  if (!row) return null
  return toStudent(row, (await loadRewards()).state.ledger.balance)
}

/* ---------- Library ---------- */

export async function listExerciseSets(): Promise<ExerciseSet[]> {
  const { householdId } = await getContext()
  const questionCounts = db
    .select({ setId: questions.setId, n: count().as("question_count") })
    .from(questions)
    .groupBy(questions.setId)
    .as("qc")
  const assignedCounts = db
    .select({ setId: assignments.setId, n: count().as("assigned_count") })
    .from(assignments)
    .groupBy(assignments.setId)
    .as("ac")
  const rows = await db
    .select({ set: exerciseSets, questionCount: questionCounts.n, timesAssigned: assignedCounts.n })
    .from(exerciseSets)
    .leftJoin(questionCounts, eq(questionCounts.setId, exerciseSets.id))
    .leftJoin(assignedCounts, eq(assignedCounts.setId, exerciseSets.id))
    .where(eq(exerciseSets.householdId, householdId))
    .orderBy(desc(exerciseSets.createdAt))
  return rows.map((r) => toExerciseSet(r.set, Number(r.questionCount ?? 0), Number(r.timesAssigned ?? 0)))
}

export async function getQuestions(setId: string): Promise<Question[]> {
  const rows = await db.select().from(questions).where(eq(questions.setId, setId)).orderBy(asc(questions.position))
  return rows.map((r) => ({ ...r.content, id: r.id }) as Question)
}

/** Questions with signed figure URLs, for display. Use getQuestions() for anything that gets stored. */
export async function getQuestionsWithImages(setId: string): Promise<Question[]> {
  return withImageUrls(await getQuestions(setId))
}

/** The set's last edit (ISO): offline hand-ins carry it, so a set edited after the download goes to the parent. */
export async function getSetVersion(setId: string): Promise<string | null> {
  const [row] = await db.select({ updatedAt: exerciseSets.updatedAt }).from(exerciseSets).where(eq(exerciseSets.id, setId))
  return row ? row.updatedAt.toISOString() : null
}

export async function getExerciseSetDetail(id: string) {
  if (!isUuid(id)) return null
  const { householdId } = await getContext()
  const row = await db.query.exerciseSets.findFirst({ where: and(eq(exerciseSets.id, id), eq(exerciseSets.householdId, householdId)) })
  if (!row) return null
  const [qs, files, [{ n: timesAssigned }]] = await Promise.all([
    getQuestionsWithImages(id),
    db.select().from(attachments).where(eq(attachments.setId, id)).orderBy(asc(attachments.position)),
    db.select({ n: count() }).from(assignments).where(eq(assignments.setId, id)),
  ])
  return {
    set: toExerciseSet(row, qs.length, timesAssigned),
    questions: qs,
    attachments: await Promise.all(files.map(toAttachment)),
  }
}

/* ---------- Assignments & attempts ---------- */

export async function listAssignments(filter?: { ids?: string[] }): Promise<AssignmentRecord[]> {
  await settleExpiredAttempts()
  const { studentId } = await getContext()
  if (!studentId) return []
  const rows = await db
    .select({ assignment: assignments, set: exerciseSets })
    .from(assignments)
    .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId))
    .where(and(eq(assignments.studentId, studentId), filter?.ids ? inArray(assignments.id, filter.ids) : undefined))
    .orderBy(asc(assignments.dueAt))
  if (!rows.length) return []

  const setIds = [...new Set(rows.map((r) => r.set.id))]
  const [attemptRows, qCounts, aCounts] = await Promise.all([
    db.select().from(attempts).where(inArray(attempts.assignmentId, rows.map((r) => r.assignment.id))).orderBy(asc(attempts.attemptNo)),
    db.select({ setId: questions.setId, n: count() }).from(questions).where(inArray(questions.setId, setIds)).groupBy(questions.setId),
    db.select({ setId: assignments.setId, n: count() }).from(assignments).where(inArray(assignments.setId, setIds)).groupBy(assignments.setId),
  ])
  const qCount = new Map(qCounts.map((r) => [r.setId, r.n]))
  const aCount = new Map(aCounts.map((r) => [r.setId, r.n]))
  const byAssignment = Map.groupBy(attemptRows, (a) => a.assignmentId)

  return rows.map(({ assignment: a, set }) => ({
    id: a.id,
    setId: a.setId,
    availableFrom: a.availableFrom,
    dueAt: a.dueAt,
    mode: a.mode,
    maxAttempts: a.maxAttempts as 1 | 2,
    timeLimitMinutes: a.timeLimitMinutes,
    parentNote: a.parentNote,
    createdAt: a.createdAt,
    set: toExerciseSet(set, qCount.get(set.id) ?? 0, aCount.get(set.id) ?? 0),
    attempts: (byAssignment.get(a.id) ?? []).map(({ assignmentId: _, ...rest }) => rest),
  }))
}

export async function getAssignment(id: string): Promise<AssignmentRecord | null> {
  if (!isUuid(id)) return null
  const [record] = await listAssignments({ ids: [id] })
  return record ?? null
}

export type AnswerRecord = typeof answers.$inferSelect

export async function getAttemptDetail(attemptId: string) {
  if (!isUuid(attemptId)) return null
  await settleExpiredAttempts()
  const attempt = await db.query.attempts.findFirst({ where: eq(attempts.id, attemptId) })
  if (!attempt) return null
  const [assignment, answerRows, scanRows] = await Promise.all([
    getAssignment(attempt.assignmentId),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)).orderBy(asc(answers.position)),
    db.select().from(attachments).where(eq(attachments.attemptId, attemptId)).orderBy(asc(attachments.position)),
  ])
  if (!assignment) return null
  // Answer keys solved after the child submitted fill in snapshots taken without one.
  const keyless = answerRows.some((a) => a.question.answerStatus === "missing")
  const current = keyless ? new Map((await getQuestions(assignment.setId)).map((q) => [q.id, q])) : undefined
  const signed = await withImageUrls(answerRows.map((a) => withLaterAnswerKey(a.question, current?.get(a.question.id))))
  return {
    attempt,
    assignment,
    answers: answerRows.map((a, i) => ({ ...a, question: signed[i] })),
    scans: await Promise.all(scanRows.map(toAttachment)),
  }
}

/** Answer rows of graded attempts, for skill analytics. */
export async function listGradedAnswers() {
  await settleExpiredAttempts()
  const { studentId } = await getContext()
  if (!studentId) return []
  return db
    .select({
      question: answers.question,
      isCorrect: answers.isCorrect,
      pointsAwarded: answers.pointsAwarded,
      subject: exerciseSets.subject,
      setId: exerciseSets.id,
      gradedAt: attempts.gradedAt,
      attemptNo: attempts.attemptNo,
    })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
    .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId))
    .where(and(isNotNull(attempts.gradedAt), eq(assignments.studentId, studentId)))
}

/** Counts shown as badges in the navigation. */
export async function getNavCounts(now = new Date()) {
  await settleExpiredAttempts()
  const { studentId } = await getContext()
  if (!studentId) return { awaitingGrading: 0, openAssignments: 0, pendingRedemptions: 0 }
  const {
    rows: [row],
  } = await db.execute<{ awaiting: number; open: number; redemptions: number }>(sql`
    with latest as (
      select distinct on (t.assignment_id) t.assignment_id, t.submitted_at, t.graded_at
      from ${attempts} t order by t.assignment_id, t.attempt_no desc
    )
    select
      count(*) filter (where l.submitted_at is not null and l.graded_at is null)::int as awaiting,
      count(*) filter (where l.submitted_at is null and a.available_from <= ${now.toISOString()})::int as open,
      (select count(*) from ${rewardRedemptions} r where r.status = 'pending' and r.student_id = ${studentId})::int as redemptions
    from ${assignments} a left join latest l on l.assignment_id = a.id
    where a.student_id = ${studentId}
  `)
  return { awaitingGrading: row?.awaiting ?? 0, openAssignments: row?.open ?? 0, pendingRedemptions: row?.redemptions ?? 0 }
}

export { isUuid }
