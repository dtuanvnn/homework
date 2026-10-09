import { z } from "zod"
import { aiQuestionSchema, toQuestion } from "@/lib/ai/question-format"
import type { Difficulty, ExerciseKind, Question, SubjectId } from "@/lib/types"

/*
 * AI document scan ("Tải lên tài liệu" → "Quét bằng AI"): prompt pieces, the
 * response schema and the mapping to the review step. Pure, so it is unit
 * tested; the Server Action in src/server/actions/ai-scan.ts does the I/O.
 */

/** Most files one scan may send (photos are ~0.3–1 MB after shrinkImage). */
export const MAX_SCAN_FILES = 10
/** Total base64 payload per scan; the Claude API caps a request at 32 MB. */
export const MAX_SCAN_BASE64_BYTES = 24 * 1024 * 1024

export interface ScanMeta {
  subject: SubjectId
  grade: number
  kind: ExerciseKind
}

/** One question as returned by the scanner, before the parent reviews it. */
export interface ScannedQuestion {
  question: Question
  /** 0–1 */
  confidence: number
  /** 1-based index of the uploaded file the question comes from. */
  page: number
  note?: string
}

export interface ScanResult {
  title: string
  topic: string
  description: string
  difficulty: Difficulty
  estimatedMinutes: number
  items: ScannedQuestion[]
}

export const scanResponseSchema = z.object({
  title: z.string().describe("Short Vietnamese title for the exercise set, e.g. \"Ôn tập phép nhân – Tuần 6\""),
  topic: z.string().describe("Main topic in a few Vietnamese words, e.g. \"Bảng nhân 6, 7\""),
  description: z.string().describe("One or two Vietnamese sentences describing the set for the parent"),
  difficulty: z.number().int().describe("1 (very easy) to 5 (very hard) for a child of this grade"),
  estimatedMinutes: z.number().int().describe("Minutes the child needs to finish every question"),
  questions: z.array(aiQuestionSchema).describe("Every exercise in the document, in document order"),
})

export type ScanResponse = z.infer<typeof scanResponseSchema>

const SUBJECT_NAMES: Record<SubjectId, string> = {
  toan: "Math (Toán)",
  "tieng-viet": "Vietnamese language (Tiếng Việt)",
  "tieng-anh": "English as a foreign language (Tiếng Anh)",
}

const KIND_NAMES: Record<ExerciseKind, string> = {
  "de-thi": "a test/exam paper",
  "chu-de": "a topic lesson",
  "luyen-tap": "a practice worksheet",
}

export const SCAN_SYSTEM_PROMPT = `You turn photos and PDFs of Vietnamese primary-school homework (worksheets, tests, textbook pages) into questions for a homework app. A parent uploaded them; their child answers the questions in the app and the app grades objective answers automatically, so answers must be exact.

Transcribe every exercise in the document into questions:
- Keep the document's wording and language exactly (Vietnamese or English), with every diacritic. Do not translate, simplify or fix the content; drop only the numbering ("Câu 1.", "Bài 2:", "a)").
- Split multi-part exercises into one question per part when each part has its own answer; repeat shared context (e.g. the word problem's facts or the instruction) in each part's prompt so it stands alone.
- Choose the question type that matches how the child answers. Open-ended writing (essays, paragraphs, explaining in words) is tu-luan with a rubric for the parent.
- Skip headers, names/date lines, general instructions and example items that are not questions.
- If the document shows answers (answer key, filled-in answers, circled options), use them. Otherwise solve the exercise yourself as a teacher of this grade would expect, lower confidence to at most 0.7, and say in the note that you supplied the answer.
- Report low confidence and a short note when text is hard to read, cut off or ambiguous. Never invent questions that are not in the document.
- page is the number N of the "Tệp N" label above the file the question comes from.

Write the title, topic, description, skill tags and notes in Vietnamese.`

/** Label shown to Claude above each file; `page` in the response refers to its number. */
export function scanFileLabel(index: number, file: { name: string; kind: "image" | "pdf" }): string {
  return `Tệp ${index + 1} (${file.kind === "pdf" ? "PDF" : "ảnh"}: ${file.name})`
}

/** Opening text of the user message: who the questions are for. */
export function scanRequestText(meta: ScanMeta, fileCount: number): string {
  return [
    `Subject: ${SUBJECT_NAMES[meta.subject]}. Grade ${meta.grade} (Vietnamese primary school). The parent says this is ${KIND_NAMES[meta.kind]}.`,
    `${fileCount} file${fileCount > 1 ? "s" : ""} follow${fileCount > 1 ? "" : "s"}, each preceded by its "Tệp N" label. Transcribe all exercises into questions.`,
  ].join("\n")
}

const clampInt = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback

/** Maps Claude's response to what the review step shows; `newId` makes question ids. */
export function toScanResult(res: ScanResponse, meta: ScanMeta, fileCount: number, newId: () => string): ScanResult {
  const items = res.questions
    .filter((q) => q.prompt.trim() || q.type === "sap-xep" || q.type === "noi")
    .map((q): ScannedQuestion => {
      const converted = toQuestion(q, newId())
      const note = converted.notes.join(" · ")
      return {
        question: converted.question,
        confidence: converted.confidence,
        page: Math.min(Math.max(1, fileCount), converted.page),
        ...(note ? { note } : {}),
      }
    })
  const topic = res.topic.trim() || items[0]?.question.skills[0] || ""
  return {
    title: res.title.trim().slice(0, 200) || `Phiếu bài tập lớp ${meta.grade}`,
    topic: topic.slice(0, 200),
    description: res.description.trim().slice(0, 2000),
    difficulty: clampInt(res.difficulty, 1, 5, 3) as Difficulty,
    estimatedMinutes: clampInt(res.estimatedMinutes, 5, 240, Math.max(10, items.length * 3)),
    items,
  }
}
