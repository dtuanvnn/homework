"use server"

import { asc, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { runAction, type ActionResult } from "@/lib/action-result"
import {
  ESSAY_SYSTEM,
  essayGradesSchema,
  essayQuestionText,
  mapEssayGrades,
  mapPaperGrades,
  PAPER_SYSTEM,
  paperGradesSchema,
  paperQuestionList,
  parseImageDataUrl,
  type AiMark,
  type AiPaperResult,
} from "@/lib/ai/grading"
import type { Response } from "@/lib/grading"
import type { Question } from "@/lib/types"
import { essayDrawing, isEssayValue } from "@/lib/views/grading"
import { assertAccess } from "../access"
import { ask, storageFileBlocks, type ContentBlock } from "../ai/claude"
import { isUuid } from "../queries"

/*
 * AI suggestions for the grading screen. These actions only read: they
 * return marks for the parent to review, and grading is saved by
 * gradeAttempt when the parent presses "Hoàn tất chấm bài".
 */

const { answers, attempts, attachments } = schema

type AnswerRow = { id: string; position: number; question: Question; response: Response | null }

async function submittedAttempt(attemptId: string) {
  if (!isUuid(attemptId)) throw new Error("Mã bài làm không hợp lệ")
  const attempt = await db.query.attempts.findFirst({ where: eq(attempts.id, attemptId) })
  if (!attempt) throw new Error("Không tìm thấy bài làm")
  if (!attempt.submittedAt) throw new Error("Bài làm chưa được nộp")
  return attempt
}

async function answerRows(attemptId: string): Promise<AnswerRow[]> {
  return db
    .select({ id: answers.id, position: answers.position, question: answers.question, response: answers.response })
    .from(answers)
    .where(eq(answers.attemptId, attemptId))
    .orderBy(asc(answers.position))
}

/** Text + handwriting blocks of essays; `number` is the question number on the grading screen. */
function essayBlocks(items: { row: AnswerRow; number: number }[]): ContentBlock[] {
  const blocks: ContentBlock[] = []
  for (const { row, number } of items) {
    const typed = isEssayValue(row.response) ? (row.response.text ?? "") : ""
    blocks.push({ type: "text", text: essayQuestionText(row.question, number, typed) })
    const drawing = essayDrawing(row.response)
    const image = drawing ? parseImageDataUrl(drawing) : null
    if (image) {
      blocks.push({ type: "text", text: `Chữ viết tay của con cho câu ${number}:` })
      blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } })
    } else if (!typed.trim()) {
      blocks.push({ type: "text", text: `(Câu ${number}: con không viết gì.)` })
    }
  }
  return blocks
}

async function gradeEssays(items: { row: AnswerRow; number: number }[]): Promise<Record<string, AiMark>> {
  const result = await ask({
    system: ESSAY_SYSTEM,
    content: [
      ...essayBlocks(items),
      { type: "text", text: `Hãy chấm ${items.length === 1 ? "câu tự luận trên" : `${items.length} câu tự luận trên`} (số câu: ${items.map((i) => i.number).join(", ")}).` },
    ],
    schema: essayGradesSchema,
    effort: "medium",
    maxTokens: 8000,
  })
  return mapEssayGrades(
    items.map(({ row, number }) => ({ id: row.id, number, question: row.question })),
    result,
  )
}

/** Suggested mark for one essay answer (web attempts): points on the screen's step, isCorrect, a short comment for the child. */
export async function suggestEssayGrade(answerId: string): Promise<ActionResult<AiMark>> {
  return runAction(async () => {
    await assertAccess()
    if (!isUuid(answerId)) throw new Error("Mã câu trả lời không hợp lệ")
    const [answer] = await db.select({ attemptId: answers.attemptId }).from(answers).where(eq(answers.id, answerId))
    if (!answer) throw new Error("Không tìm thấy câu trả lời")
    await submittedAttempt(answer.attemptId)
    const rows = await answerRows(answer.attemptId)
    const index = rows.findIndex((r) => r.id === answerId)
    const row = rows[index]
    if (row.question.type !== "tu-luan") throw new Error("AI gợi ý chỉ dùng cho câu tự luận")
    const marks = await gradeEssays([{ row, number: index + 1 }])
    const mark = marks[answerId]
    if (!mark) throw new Error("AI chưa chấm được câu này. Vui lòng thử lại.")
    return mark
  })
}

/** Suggested marks for every essay of a web attempt in one request, by answer id. */
export async function suggestAllEssayGrades(attemptId: string): Promise<ActionResult<Record<string, AiMark>>> {
  return runAction(async () => {
    await assertAccess()
    await submittedAttempt(attemptId)
    const rows = await answerRows(attemptId)
    const items = rows.flatMap((row, i) => (row.question.type === "tu-luan" ? [{ row, number: i + 1 }] : []))
    if (!items.length) throw new Error("Bài này không có câu tự luận")
    const marks = await gradeEssays(items)
    if (!Object.keys(marks).length) throw new Error("AI chưa chấm được câu nào. Vui lòng thử lại.")
    return marks
  })
}

/**
 * Reads the scanned pages of a paper attempt and suggests a mark, the
 * transcribed answer and a confidence for every question, plus an overall
 * feedback draft.
 */
export async function gradePaperWithAI(attemptId: string): Promise<ActionResult<AiPaperResult>> {
  return runAction(async () => {
    await assertAccess()
    const attempt = await submittedAttempt(attemptId)
    if (attempt.mode !== "paper") throw new Error("Chỉ chấm bằng ảnh scan cho bài làm trên giấy")
    const [rows, scans] = await Promise.all([
      answerRows(attemptId),
      db.select().from(attachments).where(eq(attachments.attemptId, attemptId)).orderBy(asc(attachments.position)),
    ])
    if (!rows.length) throw new Error("Bài làm không có câu hỏi nào")
    if (!scans.length) throw new Error("Bài làm chưa có ảnh scan")
    if (scans.length > 20) throw new Error("Quá nhiều trang scan để AI đọc một lần (tối đa 20)")

    const pages = await Promise.all(
      scans.map(async (scan, i): Promise<ContentBlock[]> => {
        const label = `Trang ${i + 1}/${scans.length} bài làm của con:`
        if (scan.storagePath) return storageFileBlocks(scan.storagePath, label)
        if (scan.externalUrl) return [{ type: "text", text: label }, { type: "image", source: { type: "url", url: scan.externalUrl } }]
        return []
      }),
    )
    const result = await ask({
      system: PAPER_SYSTEM,
      content: [
        ...pages.flat(),
        { type: "text", text: paperQuestionList(rows) },
        { type: "text", text: `Hãy đọc bài làm trên ảnh và chấm đủ ${rows.length} câu.` },
      ],
      schema: paperGradesSchema,
      effort: "high",
      maxTokens: 32000,
    })
    return mapPaperGrades(rows, result)
  })
}
