import "server-only"
import { asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { db, schema } from "@/db"
import { starsFor } from "@/lib/grading"
import type { Attachment, Difficulty, ExerciseSet, Question, Student } from "@/lib/types"
import { attachmentUrl } from "./storage"

/*
 * Read-side data access. Returns the UI's own types (see lib/types.ts) so
 * page components stay unaware of the database. Only one student exists.
 */

const { students, exerciseSets, questions, assignments, attempts, answers, attachments } = schema

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

export async function getStudent(): Promise<Student & { id: string }> {
  const row = await db.query.students.findFirst({ orderBy: asc(students.createdAt) })
  if (!row) throw new Error("No student found. Run `pnpm db:seed`.")
  const graded = await db.select({ score: attempts.score }).from(attempts).where(isNotNull(attempts.gradedAt))
  const totalStars = graded.reduce((sum, a) => sum + starsFor(a.score ?? 0), 0)
  return { id: row.id, name: row.name, grade: row.grade, avatarEmoji: row.avatarEmoji, totalStars }
}

/* ---------- Library ---------- */

export async function listExerciseSets(): Promise<ExerciseSet[]> {
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
    .orderBy(desc(exerciseSets.createdAt))
  return rows.map((r) => toExerciseSet(r.set, Number(r.questionCount ?? 0), Number(r.timesAssigned ?? 0)))
}

export async function getQuestions(setId: string): Promise<Question[]> {
  const rows = await db.select().from(questions).where(eq(questions.setId, setId)).orderBy(asc(questions.position))
  return rows.map((r) => ({ ...r.content, id: r.id }) as Question)
}

export async function getExerciseSetDetail(id: string) {
  if (!isUuid(id)) return null
  const row = await db.query.exerciseSets.findFirst({ where: eq(exerciseSets.id, id) })
  if (!row) return null
  const [qs, files, [{ n: timesAssigned }]] = await Promise.all([
    getQuestions(id),
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
  const rows = await db
    .select({ assignment: assignments, set: exerciseSets })
    .from(assignments)
    .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId))
    .where(filter?.ids ? inArray(assignments.id, filter.ids) : undefined)
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
  const attempt = await db.query.attempts.findFirst({ where: eq(attempts.id, attemptId) })
  if (!attempt) return null
  const [assignment, answerRows, scanRows] = await Promise.all([
    getAssignment(attempt.assignmentId),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)).orderBy(asc(answers.position)),
    db.select().from(attachments).where(eq(attachments.attemptId, attemptId)).orderBy(asc(attachments.position)),
  ])
  if (!assignment) return null
  return { attempt, assignment, answers: answerRows, scans: await Promise.all(scanRows.map(toAttachment)) }
}

/** Answer rows of graded attempts, for skill analytics. */
export async function listGradedAnswers() {
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
    .where(isNotNull(attempts.gradedAt))
}

/** Counts shown as badges in the navigation. */
export async function getNavCounts(now = new Date()) {
  const [row] = await db.execute<{ awaiting: number; open: number }>(sql`
    with latest as (
      select distinct on (t.assignment_id) t.assignment_id, t.submitted_at, t.graded_at
      from ${attempts} t order by t.assignment_id, t.attempt_no desc
    )
    select
      count(*) filter (where l.submitted_at is not null and l.graded_at is null)::int as awaiting,
      count(*) filter (where l.submitted_at is null and a.available_from <= ${now.toISOString()})::int as open
    from ${assignments} a left join latest l on l.assignment_id = a.id
  `)
  return { awaitingGrading: row?.awaiting ?? 0, openAssignments: row?.open ?? 0 }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: string) => UUID.test(value)
