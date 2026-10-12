import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import type { Question, QuestionContent } from "@/lib/types"
import type { Response } from "@/lib/grading"

/*
 * Every table has RLS enabled with no policies: the app talks to Postgres
 * directly from the server, so nothing is reachable through Supabase's
 * public REST API.
 */

export const subject = pgEnum("subject", ["toan", "tieng-viet", "tieng-anh"])
export const exerciseKind = pgEnum("exercise_kind", ["de-thi", "chu-de", "luyen-tap"])
export const exerciseSource = pgEnum("exercise_source", ["thu-cong", "tai-len", "ai"])
export const exerciseStatus = pgEnum("exercise_status", ["nhap", "san-sang"])
export const workMode = pgEnum("work_mode", ["web", "paper"])
export const gradedBy = pgEnum("graded_by", ["auto", "ai", "parent"])
export const attachmentKind = pgEnum("attachment_kind", ["image", "pdf"])

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

export const students = pgTable("students", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  grade: smallint().notNull(),
  /** Class label shown in the UI, e.g. "3C1"; `grade` stays numeric for filtering. */
  className: text("class_name"),
  avatarEmoji: text("avatar_emoji").notNull().default("🦊"),
  createdAt: createdAt(),
}).enableRLS()

export const exerciseSets = pgTable(
  "exercise_sets",
  {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    subject: subject().notNull(),
    grade: smallint().notNull(),
    topic: text().notNull().default(""),
    description: text().notNull().default(""),
    estimatedMinutes: smallint("estimated_minutes").notNull().default(15),
    difficulty: smallint().notNull().default(2),
    kind: exerciseKind().notNull(),
    source: exerciseSource().notNull(),
    status: exerciseStatus().notNull().default("nhap"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("difficulty_range", sql`${t.difficulty} between 1 and 5`),
    index("exercise_sets_subject_grade_idx").on(t.subject, t.grade),
  ],
).enableRLS()

/** `content` is the full question as edited in the UI (type-specific fields included). */
export const questions = pgTable(
  "questions",
  {
    id: uuid().primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => exerciseSets.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    content: jsonb().$type<QuestionContent>().notNull(),
  },
  (t) => [uniqueIndex("questions_set_position_idx").on(t.setId, t.position)],
).enableRLS()

export const assignments = pgTable(
  "assignments",
  {
    id: uuid().primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    setId: uuid("set_id")
      .notNull()
      .references(() => exerciseSets.id, { onDelete: "restrict" }),
    /** When the assignment becomes visible to the student. */
    availableFrom: timestamp("available_from", { withTimezone: true }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    mode: workMode().notNull().default("web"),
    maxAttempts: smallint("max_attempts").notNull().default(2),
    parentNote: text("parent_note"),
    createdAt: createdAt(),
  },
  (t) => [
    check("max_attempts_range", sql`${t.maxAttempts} between 1 and 2`),
    index("assignments_student_due_idx").on(t.studentId, t.dueAt),
  ],
).enableRLS()

/**
 * One row per try at an assignment. Lifecycle: started (draft answers saved) →
 * submitted → graded. `score` is on the 10-point scale.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid().primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    attemptNo: smallint("attempt_no").notNull(),
    mode: workMode().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    gradedBy: gradedBy("graded_by"),
    durationSeconds: integer("duration_seconds"),
    score: doublePrecision(),
    feedback: text(),
    /** Parent allowed a second attempt after grading this one. */
    retryAllowed: boolean("retry_allowed").notNull().default(true),
  },
  (t) => [
    uniqueIndex("attempts_assignment_no_idx").on(t.assignmentId, t.attemptNo),
    check("attempt_no_range", sql`${t.attemptNo} between 1 and 2`),
  ],
).enableRLS()

/**
 * The student's answer to one question. `question` snapshots the question at
 * submit time so results and analytics survive later edits to the set.
 */
export const answers = pgTable(
  "answers",
  {
    id: uuid().primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull(),
    position: integer().notNull(),
    question: jsonb().$type<Question>().notNull(),
    response: jsonb().$type<Response>(),
    /** null = needs the parent (essays, paper work). */
    isCorrect: boolean("is_correct"),
    pointsAwarded: doublePrecision("points_awarded"),
    comment: text(),
    /** AI guidance for a wrong answer, shown to the child instead of the answer while a retry is open. */
    hint: text(),
  },
  (t) => [uniqueIndex("answers_attempt_question_idx").on(t.attemptId, t.questionId)],
).enableRLS()

/** Files in Storage: source documents of a set, or scanned pages of a paper attempt. */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    setId: uuid("set_id").references(() => exerciseSets.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => attempts.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: attachmentKind().notNull(),
    sizeKb: integer("size_kb").notNull(),
    pages: smallint(),
    /** Object path inside the storage bucket; null for external demo URLs. */
    storagePath: text("storage_path"),
    externalUrl: text("external_url"),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("attachment_owner", sql`(${t.setId} is null) <> (${t.attemptId} is null)`),
    index("attachments_set_idx").on(t.setId),
    index("attachments_attempt_idx").on(t.attemptId),
  ],
).enableRLS()
