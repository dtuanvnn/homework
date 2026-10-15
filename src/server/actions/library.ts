"use server"

import { and, eq, inArray, notInArray, sql, type AnyColumn } from "drizzle-orm"
import { refresh } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { figureOwner, figurePaths, unusedFigures } from "@/lib/figures"
import { editedQuestionSchema } from "@/lib/question-schema"
import type { Assignment, Attachment, ExerciseSet, Question } from "@/lib/types"
import { runAction, type ActionResult } from "@/lib/action-result"
import { assertAccess } from "../access"
import { getExerciseSetDetail, getQuestions, getQuestionsWithImages, getStudent, isUuid, toExerciseSet } from "../queries"
import { attachmentUrl, createUploadTargets, isUploaded, listFolder, removeFromStorage, type UploadTarget } from "../storage"

const { exerciseSets, questions, attachments, assignments, attempts, answers } = schema

const setMetaSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Bộ bài cần có tên").max(200),
  subject: z.enum(["toan", "tieng-viet", "tieng-anh"]),
  grade: z.number().int().min(1).max(12),
  topic: z.string().max(200),
  description: z.string().max(2000),
  estimatedMinutes: z.number().int().min(1).max(240),
  difficulty: z.number().int().min(1).max(5),
  kind: z.enum(["de-thi", "chu-de", "luyen-tap"]),
  source: z.enum(["thu-cong", "tai-len", "ai"]),
  status: z.enum(["nhap", "san-sang"]),
})

const newFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(200),
  kind: z.enum(["image", "pdf"]),
  sizeKb: z.number().int().min(0),
  pages: z.number().int().positive().optional(),
})

const savePayloadSchema = z.object({
  set: setMetaSchema,
  questions: z.array(editedQuestionSchema).max(200),
  keepAttachmentIds: z.array(z.string()),
  newFiles: z.array(newFileSchema).max(30),
})

export type NewFile = z.infer<typeof newFileSchema>
export type SavePayload = z.input<typeof savePayloadSchema>

/** Questions of one set, fetched lazily by the library store. */
export async function loadQuestions(setId: string): Promise<ActionResult<Question[]>> {
  return runAction(async () => {
    await assertAccess("parent")
    return isUuid(setId) ? getQuestionsWithImages(setId) : []
  })
}

/** Creates an empty draft set (the "Soạn thủ công" entry point). */
export async function createExerciseSet(): Promise<ActionResult<ExerciseSet>> {
  return runAction(async () => {
    await assertAccess("parent")
    const student = await getStudent()
    const [row] = await db
      .insert(exerciseSets)
      .values({ title: "Bộ bài tập mới", subject: "toan", grade: student.grade, kind: "luyen-tap", source: "thu-cong", status: "nhap" })
      .returning()
    refresh()
    return toExerciseSet(row, 0, 0)
  })
}

/** One-time upload URLs for files of a (possibly not yet saved) set. */
export async function requestSetUploads(setId: string, names: string[]): Promise<ActionResult<UploadTarget[]>> {
  return runAction(async () => {
    await assertAccess("parent")
    if (!isUuid(setId)) throw new Error("Mã bộ bài không hợp lệ")
    return createUploadTargets("sets", setId, names.slice(0, 30))
  })
}

/**
 * Creates or replaces a set with its questions and files. Used by the editor,
 * the upload flow and AI generation (new sets carry a client-made UUID).
 */
export async function saveExerciseSet(payload: SavePayload): Promise<ActionResult<{ set: ExerciseSet; attachments: Attachment[] }>> {
  return runAction(async () => {
    await assertAccess("parent")
    const { set, questions: qs, keepAttachmentIds, newFiles } = savePayloadSchema.parse(payload)
    for (const f of newFiles) {
      if (!(await isUploaded("sets", set.id, f.path))) throw new Error(`Tệp “${f.name}” chưa tải lên xong`)
    }
    // Figures the set didn't have yet must really be in Storage (their paths are checked by the schema).
    const known = new Set((await getQuestions(set.id)).flatMap(figurePaths))
    for (const path of new Set(qs.flatMap(figurePaths))) {
      if (known.has(path)) continue
      const owner = figureOwner(path)
      if (!owner || !(await isUploaded("sets", owner, path))) throw new Error("Hình minh họa chưa tải lên xong. Hãy thử lại.")
    }
    const { id, ...meta } = set

    const removedPaths = await db.transaction(async (tx) => {
      await tx
        .insert(exerciseSets)
        .values({ id, ...meta })
        .onConflictDoUpdate({ target: exerciseSets.id, set: { ...meta, updatedAt: new Date() } })

      await tx.delete(questions).where(eq(questions.setId, id))
      if (qs.length) {
        await tx.insert(questions).values(
          qs.map(({ id: qid, ...content }, position) => ({ ...(isUuid(qid) ? { id: qid } : {}), setId: id, position, content })),
        )
      }

      const keep = keepAttachmentIds.filter(isUuid)
      const removed = await tx
        .delete(attachments)
        .where(and(eq(attachments.setId, id), keep.length ? notInArray(attachments.id, keep) : undefined))
        .returning({ path: attachments.storagePath })
      if (newFiles.length) {
        const start = keep.length
        await tx.insert(attachments).values(
          newFiles.map((f, i) => ({ setId: id, name: f.name, kind: f.kind, sizeKb: f.sizeKb, pages: f.pages, storagePath: f.path, position: start + i })),
        )
      }
      return removed.flatMap((r) => (r.path ? [r.path] : []))
    })

    await removeUnreferenced(removedPaths)
    await removeUnusedFigures(id)
    refresh()
    const saved = await getExerciseSetDetail(id)
    if (!saved) throw new Error("Không lưu được bộ bài")
    return { set: saved.set, attachments: saved.attachments }
  })
}

export async function duplicateExerciseSet(id: string): Promise<ActionResult<ExerciseSet>> {
  return runAction(async () => {
    await assertAccess("parent")
    if (!isUuid(id)) throw new Error("Mã bộ bài không hợp lệ")
    const original = await db.query.exerciseSets.findFirst({ where: eq(exerciseSets.id, id) })
    if (!original) throw new Error("Không tìm thấy bộ bài")
    const { id: _id, createdAt: _created, updatedAt: _updated, ...meta } = original
    const sourceQuestions = await getQuestions(id)

    const copy = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(exerciseSets)
        .values({ ...meta, title: `${meta.title} (bản sao)`, status: "nhap" })
        .returning()
      if (sourceQuestions.length) {
        await tx.insert(questions).values(sourceQuestions.map(({ id: _q, ...content }, position) => ({ setId: row.id, position, content })))
      }
      // Files are shared by reference: demo files keep their URL, Storage files keep their path.
      const files = await tx.select().from(attachments).where(eq(attachments.setId, id))
      if (files.length) {
        await tx.insert(attachments).values(files.map(({ id: _f, createdAt: _c, ...f }) => ({ ...f, setId: row.id })))
      }
      return row
    })
    refresh()
    return toExerciseSet(copy, sourceQuestions.length, 0)
  })
}

export async function deleteExerciseSet(id: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await assertAccess("parent")
    if (!isUuid(id)) throw new Error("Mã bộ bài không hợp lệ")
    const used = await db.$count(assignments, eq(assignments.setId, id))
    if (used > 0) throw new Error("Bộ bài đã được giao nên không thể xóa. Hãy chuyển về Nháp nếu không dùng nữa.")
    const files = await db.select({ path: attachments.storagePath }).from(attachments).where(eq(attachments.setId, id))
    await db.delete(exerciseSets).where(eq(exerciseSets.id, id))
    await removeUnreferenced(files.flatMap((f) => (f.path ? [f.path] : [])))
    await removeUnusedFigures(id)
    refresh()
  })
}

/** Duplicated sets can share a Storage object, so only delete paths no row references any more. */
async function removeUnreferenced(paths: string[]) {
  if (!paths.length) return
  const stillUsed = await db.select({ path: attachments.storagePath }).from(attachments).where(inArray(attachments.storagePath, paths))
  const used = new Set(stillUsed.map((r) => r.path))
  await removeFromStorage(paths.filter((p) => !used.has(p))).catch(() => {})
}

const imagePath = (column: AnyColumn) => sql<string>`${column}->'image'->>'path'`
const solutionImagePath = (column: AnyColumn) => sql<string>`${column}->'solutionImage'->>'path'`

/** Figure objects in a set's folder that no question, answer snapshot or attachment uses any more. */
async function removeUnusedFigures(setId: string) {
  try {
    const candidates = unusedFigures(await listFolder("sets", setId), [])
    if (!candidates.length) return
    const [inQuestions, inAnswers, inQuestionSolutions, inAnswerSolutions, inAttachments] = await Promise.all([
      db.select({ path: imagePath(questions.content) }).from(questions).where(inArray(imagePath(questions.content), candidates)),
      db.select({ path: imagePath(answers.question) }).from(answers).where(inArray(imagePath(answers.question), candidates)),
      db.select({ path: solutionImagePath(questions.content) }).from(questions).where(inArray(solutionImagePath(questions.content), candidates)),
      db.select({ path: solutionImagePath(answers.question) }).from(answers).where(inArray(solutionImagePath(answers.question), candidates)),
      db.select({ path: attachments.storagePath }).from(attachments).where(inArray(attachments.storagePath, candidates)),
    ])
    const used = [...inQuestions, ...inAnswers, ...inQuestionSolutions, ...inAnswerSolutions, ...inAttachments].flatMap((r) => (r.path ? [r.path] : []))
    await removeFromStorage(unusedFigures(candidates, used))
  } catch {
    // Best effort: a leftover figure only costs storage.
  }
}

/* ---------- Assigning ---------- */

const newAssignmentSchema = z.object({
  setId: z.uuid(),
  availableFrom: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }),
  mode: z.enum(["web", "paper"]),
  maxAttempts: z.union([z.literal(1), z.literal(2)]),
  timeLimitMinutes: z.number().int().min(1).max(240).nullable().optional(),
  note: z.string().max(500).optional(),
})
export type NewAssignment = z.input<typeof newAssignmentSchema>

/** Time limits only apply to web work. */
const limitFor = (i: { mode: "web" | "paper"; timeLimitMinutes?: number | null }) => (i.mode === "web" ? (i.timeLimitMinutes ?? null) : null)

async function insertAssignments(items: NewAssignment[]): Promise<Assignment[]> {
  const parsed = z.array(newAssignmentSchema).min(1).max(14).parse(items)
  for (const item of parsed) {
    if (new Date(item.dueAt) <= new Date(item.availableFrom)) throw new Error("Hạn nộp phải sau thời điểm giao bài")
    const n = await db.$count(questions, eq(questions.setId, item.setId))
    if (n === 0) throw new Error("Hãy chọn bộ bài có ít nhất một câu hỏi.")
  }
  const student = await getStudent()
  const rows = await db
    .insert(assignments)
    .values(
      parsed.map((i) => ({
        studentId: student.id,
        setId: i.setId,
        availableFrom: new Date(i.availableFrom),
        dueAt: new Date(i.dueAt),
        mode: i.mode,
        maxAttempts: i.maxAttempts,
        timeLimitMinutes: limitFor(i),
        parentNote: i.note?.trim() || null,
      })),
    )
    .returning()
  refresh()
  return rows.map((r) => ({
    id: r.id,
    exerciseSetId: r.setId,
    assignedDate: r.availableFrom.toISOString(),
    dueDate: r.dueAt.toISOString(),
    status: "chua-lam",
    parentNote: r.parentNote ?? undefined,
    mode: r.mode,
    maxAttempts: r.maxAttempts as 1 | 2,
    timeLimitMinutes: r.timeLimitMinutes ?? undefined,
    attemptCount: 0,
  }))
}

export async function createAssignments(items: NewAssignment[]): Promise<ActionResult<Assignment[]>> {
  return runAction(async () => {
    await assertAccess("parent")
    return insertAssignments(items)
  })
}

/** "Giao bài" shortcut on a library card: available now, due tomorrow 20:00. */
export async function quickAssign(setId: string): Promise<ActionResult<Assignment>> {
  return runAction(async () => {
    const due = new Date()
    due.setDate(due.getDate() + 1)
    due.setHours(20, 0, 0, 0)
    await assertAccess("parent")
    const [created] = await insertAssignments([
      { setId, availableFrom: new Date().toISOString(), dueAt: due.toISOString(), mode: "web", maxAttempts: 2 },
    ])
    return created
  })
}

const assignmentChangesSchema = newAssignmentSchema.omit({ setId: true })
export type AssignmentChanges = z.input<typeof assignmentChangesSchema>

/** Reschedules an assignment or changes its settings; once the child has started, mode, time limit and a lower attempt cap are locked. */
export async function updateAssignment(id: string, changes: AssignmentChanges): Promise<ActionResult<void>> {
  return runAction(async () => {
    await assertAccess("parent")
    if (!isUuid(id)) throw new Error("Mã bài giao không hợp lệ")
    const c = assignmentChangesSchema.parse(changes)
    if (new Date(c.dueAt) <= new Date(c.availableFrom)) throw new Error("Hạn nộp phải sau thời điểm giao bài")
    const [current] = await db.select().from(assignments).where(eq(assignments.id, id))
    if (!current) throw new Error("Không tìm thấy bài giao")
    const started = await db.$count(attempts, eq(attempts.assignmentId, id))
    if (started > 0 && c.mode !== current.mode) throw new Error("Con đã bắt đầu làm nên không đổi được hình thức.")
    if (c.maxAttempts < started) throw new Error(`Con đã làm ${started} lần nên không giảm số lần được.`)
    if (started > 0 && limitFor(c) !== current.timeLimitMinutes) throw new Error("Con đã bắt đầu làm nên không đổi được giới hạn thời gian.")
    await db
      .update(assignments)
      .set({
        availableFrom: new Date(c.availableFrom),
        dueAt: new Date(c.dueAt),
        mode: c.mode,
        maxAttempts: c.maxAttempts,
        timeLimitMinutes: limitFor(c),
        parentNote: c.note?.trim() || null,
      })
      .where(eq(assignments.id, id))
    refresh()
  })
}

/** Deletes an assignment together with the child's attempts, answers and photographed pages. */
export async function deleteAssignment(id: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await assertAccess("parent")
    if (!isUuid(id)) throw new Error("Mã bài giao không hợp lệ")
    const [current] = await db.select({ setId: assignments.setId }).from(assignments).where(eq(assignments.id, id))
    if (!current) throw new Error("Không tìm thấy bài giao")
    const files = await db
      .select({ path: attachments.storagePath })
      .from(attachments)
      .innerJoin(attempts, eq(attachments.attemptId, attempts.id))
      .where(eq(attempts.assignmentId, id))
    await db.delete(assignments).where(eq(assignments.id, id))
    // Pages uploaded but never handed in also sit under the assignment's folder.
    const leftovers = await listFolder("attempts", id)
    await removeUnreferenced([...new Set([...files.flatMap((f) => (f.path ? [f.path] : [])), ...leftovers])])
    await removeUnusedFigures(current.setId)
    refresh()
  })
}

/** Preview URLs for files already uploaded under a not-yet-saved set (restoring an unsaved scan). */
export async function previewSetUploads(setId: string, paths: string[]): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => {
    await assertAccess("parent")
    if (!isUuid(setId)) throw new Error("Mã bộ bài không hợp lệ")
    const prefix = `sets/${setId}/`
    const own = paths.slice(0, 200).filter((p) => p.startsWith(prefix) && !p.includes(".."))
    const entries = await Promise.all(own.map(async (p) => [p, await attachmentUrl({ storagePath: p, externalUrl: null })] as const))
    return Object.fromEntries(entries.filter((e): e is readonly [string, string] => Boolean(e[1])))
  })
}
