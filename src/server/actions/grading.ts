"use server"

import { asc, eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { z } from "zod"
import { db, schema } from "@/db"
import { formatScoreValue } from "@/lib/format"
import { scoreOutOf10 } from "@/lib/grading"
import { runAction, type ActionResult } from "@/lib/action-result"
import { assertAccess } from "../access"
import { isUuid } from "../queries"
import { assertAttemptInScope } from "../ownership"

const { assignments, attempts, answers } = schema

const gradeInputSchema = z.object({
  answers: z
    .array(
      z.object({
        answerId: z.uuid(),
        isCorrect: z.boolean({ error: "Còn câu chưa chấm" }),
        pointsAwarded: z.number({ error: "Còn câu chưa chấm" }).min(0, "Điểm không được âm"),
        comment: z.string().trim().max(1000).nullish(),
      }),
    )
    .min(1)
    .max(200),
  feedback: z.string().trim().max(2000).optional(),
  retryAllowed: z.boolean(),
})
export type GradeInput = z.input<typeof gradeInputSchema>

/**
 * Saves the parent's marks for a submitted attempt (first grading or edits):
 * every answer needs a mark, points stay within the question snapshot's
 * points, and the score is recomputed here.
 */
export async function gradeAttempt(attemptId: string, input: GradeInput): Promise<ActionResult<{ score: number }>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    await assertAttemptInScope(ctx, attemptId)
    if (!isUuid(attemptId)) throw new Error("Mã bài làm không hợp lệ")
    const parsed = gradeInputSchema.safeParse(input)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu chấm bài không hợp lệ")
    const data = parsed.data

    const [row] = await db
      .select({ attempt: attempts, maxAttempts: assignments.maxAttempts })
      .from(attempts)
      .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .where(eq(attempts.id, attemptId))
    if (!row) throw new Error("Không tìm thấy bài làm")
    if (!row.attempt.submittedAt) throw new Error("Bài làm chưa được nộp")

    const stored = await db.select({ id: answers.id, question: answers.question }).from(answers).where(eq(answers.attemptId, attemptId)).orderBy(asc(answers.position))
    const marks = new Map(data.answers.map((a) => [a.answerId, a]))
    if (marks.size !== data.answers.length || stored.length !== marks.size || stored.some((s) => !marks.has(s.id))) {
      throw new Error("Hãy chấm đủ tất cả các câu trước khi hoàn tất")
    }
    for (const [i, s] of stored.entries()) {
      const points = marks.get(s.id)!.pointsAwarded
      if (points > s.question.points + 1e-9) throw new Error(`Câu ${i + 1}: điểm tối đa là ${formatScoreValue(s.question.points)}`)
    }

    const total = stored.reduce((sum, s) => sum + s.question.points, 0)
    const awarded = data.answers.reduce((sum, a) => sum + a.pointsAwarded, 0)
    const score = scoreOutOf10(awarded, total)
    const retryAllowed = data.retryAllowed && row.attempt.attemptNo < row.maxAttempts

    await db.transaction(async (tx) => {
      for (const a of data.answers) {
        await tx
          .update(answers)
          .set({ isCorrect: a.isCorrect, pointsAwarded: a.pointsAwarded, comment: a.comment || null })
          .where(eq(answers.id, a.answerId))
      }
      await tx
        .update(attempts)
        .set({ score, gradedAt: new Date(), gradedBy: "parent", feedback: data.feedback || null, retryAllowed })
        .where(eq(attempts.id, attemptId))
    })
    refresh()
    return { score }
  })
}
