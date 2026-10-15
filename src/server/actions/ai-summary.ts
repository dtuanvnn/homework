"use server"

import { and, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "@/db"
import { runAction, type ActionResult } from "@/lib/action-result"
import { candidateList, candidateSets, SUMMARY_SYSTEM, summaryFacts, summaryResultSchema, validateSummary, type AiSummary } from "@/lib/ai/summary"
import { buildReport, rangePeriod } from "@/lib/analytics"
import { dateInput } from "@/lib/schedule"
import { assertAccess } from "../access"
import { ask } from "../ai/llm"
import { loadReportInput } from "../analytics"
import { getViewingStudent } from "../queries"

const { attempts, assignments, exerciseSets } = schema

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
const inputSchema = z.object({
  rangeId: z.enum(["4w", "3m", "hk", "custom"]),
  subjects: z.array(z.enum(["toan", "tieng-viet", "tieng-anh"])).min(1, "Chọn ít nhất một môn").max(3),
  custom: z.object({ from: dateString, to: dateString }).optional(),
})
export type SummarizeInput = z.input<typeof inputSchema>

/**
 * AI progress review for the Reports page: the same analytics as the page
 * (same range and subject filter), computed here, summarized by Claude with
 * up to 3 next steps linked to existing practice sets.
 */
export async function summarizeProgress(input: SummarizeInput): Promise<ActionResult<AiSummary>> {
  return runAction(async () => {
    await assertAccess("parent")
    const { rangeId, subjects, custom } = inputSchema.parse(input)
    const now = new Date()
    const period = rangePeriod(rangeId, now, rangeId === "custom" ? custom : undefined)
    const [reportInput, maybeStudent, feedbackRows] = await Promise.all([
      loadReportInput(),
      getViewingStudent(),
      db
        .select({ title: exerciseSets.title, subject: exerciseSets.subject, gradedAt: attempts.gradedAt, score: attempts.score, feedback: attempts.feedback })
        .from(attempts)
        .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId))
        .where(
          and(
            isNotNull(attempts.feedback),
            gte(attempts.gradedAt, period.from),
            lt(attempts.gradedAt, period.to),
            inArray(exerciseSets.subject, subjects),
          ),
        )
        .orderBy(desc(attempts.gradedAt))
        .limit(5),
    ])
    const student = maybeStudent
    if (!student) throw new Error("Chưa có học sinh nào.")
    const report = buildReport(reportInput, period, now, subjects)
    const candidates = candidateSets(reportInput.sets, report, subjects)
    const facts = summaryFacts({
      studentName: student.name,
      grade: student.grade,
      period: { from: dateInput(period.from), to: dateInput(new Date(period.to.getTime() - 1)) },
      subjects,
      report,
      feedback: feedbackRows.flatMap((r) =>
        r.feedback?.trim() && r.gradedAt ? [{ title: r.title, subject: r.subject, gradedAt: r.gradedAt.toISOString(), score: r.score, feedback: r.feedback.trim() }] : [],
      ),
    })
    const result = await ask({
      system: SUMMARY_SYSTEM,
      content: [
        { type: "text", text: `Thống kê học tập (JSON):\n${JSON.stringify(facts, null, 1)}` },
        { type: "text", text: `Bộ bài luyện tập có thể giao (JSON):\n${JSON.stringify(candidateList(candidates), null, 1)}` },
      ],
      schema: summaryResultSchema,
      effort: "medium",
      maxTokens: 8000,
    })
    return validateSummary(result, candidates, new Date().toISOString())
  })
}
