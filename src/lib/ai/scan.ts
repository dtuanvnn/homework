import { z } from "zod"
import { MATH_NOTATION_RULES, aiQuestionSchema, toQuestion } from "@/lib/ai/question-format"
import type { Difficulty, ExerciseKind, Question, SubjectId } from "@/lib/types"
import type { Box } from "@/lib/figure-crop"

/*
 * AI document scan ("Tải lên tài liệu" → "Quét bằng AI"): prompt pieces, the
 * response schema and the mapping to the review step. Pure, so it is unit
 * tested; the Server Action in src/server/actions/ai-scan.ts does the I/O.
 */

/** Most files one scan may send (photos are ~0.3–1 MB after shrinkImage). */
export const MAX_SCAN_FILES = 20
/** Total base64 payload per scan; the Claude API caps a request at 32 MB. */
export const MAX_SCAN_BASE64_BYTES = 24 * 1024 * 1024

export interface ScanMeta {
  subject: SubjectId
  grade: number
  kind: ExerciseKind
  /**
   * The document prints its answers and worked solutions: read them into the
   * questions. Otherwise the scan only transcribes and answers come later
   * ("Giải đáp án" on the set).
   */
  withSolutions?: boolean
}

/** One question as returned by the scanner, before the parent reviews it. */
export interface ScannedQuestion {
  question: Question
  /** 0–1 */
  confidence: number
  /** 1-based index of the uploaded file the question comes from. */
  page: number
  note?: string
  figure?: { page: number; box: Box }
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

const SCAN_INTRO = `You turn photos and PDFs of Vietnamese primary-school homework (worksheets, tests, textbook pages) into questions for a homework app. A parent uploaded them; their child answers the questions in the app.

Transcribe every exercise in the document into questions:
- Keep the document's wording and language exactly (Vietnamese or English), with every diacritic. Do not translate, simplify or fix the content; drop only the numbering ("Câu 1.", "Bài 2:", "a)").
- Split multi-part exercises into one question per part when each part has its own answer; repeat shared context (e.g. the word problem's facts or the instruction) in each part's prompt so it stands alone.
- Keep the layout of reading passages, poems, letters and dialogues: put a line break (\\n) wherever the document starts a new line or paragraph, and give each dialogue turn its own line, keeping its dash ("– ") or speaker name.
- Choose the question type that matches how the child answers. tra-loi-ngan is only for an answer that is one short value checked exactly (a number with its unit, a word, a phrase, one short sentence) — e.g. "Điền đáp số", "Viết kết quả". When the child must write out working or a full answer — word problems in a "Tự luận"/"Bài giải" part, "Đặt tính rồi tính", "Tìm x" with steps, "Trình bày", explaining, writing sentences, paragraphs or essays — use tu-luan.
- Skip headers, names/date lines, general instructions and example items that are not questions.
- Report low confidence and a short note when text is hard to read, cut off or ambiguous. Never invent questions that are not in the document.
${MATH_NOTATION_RULES}
- When the child needs a picture, diagram, drawn table or chart to answer (geometry figures, objects to count, clocks, charts), fill figure with its box on that page: [x0, y0, x1, y1] from 0 to 1000 of the page's width and height, tight around the drawing and its labels (lengths, letters, numbers), leaving out the question text and the answer choices below it. Parts of one exercise that share a picture repeat the same box. Use null when no picture is needed.
- page is the number N of the "Tệp N" label above the file the question comes from.`

const TRANSCRIBE_ONLY = `Answers:
- Do not solve anything and do not look for answers: the parent adds answer keys later. Leave correctIndex, trueFalseAnswer, answers, answer, rubric and solution null, even when the document shows answers.
- noi: give the pairs as printed, row by row (the left item and the right item on the same row). sap-xep: give the tokens in the printed order.
- Still set math (and simplest) from what the child is asked to write.`

const READ_SOLUTIONS = `Answers:
- The document includes its answers and worked solutions (an answer key, "Đáp án", "Lời giải", "Hướng dẫn giải", often after the questions or on later pages). Read them; do not solve anything yourself. Do not turn the answer key or the solutions into questions.
- Fill each question's answer fields from the document: correctIndex, trueFalseAnswer, answers, answer; noi with the correctly matched pairs; sap-xep with the tokens in the correct order; tu-luan rubric with what the document expects (e.g. "Đáp số: …").
- Copy the document's worked solution for the question into solution, keeping its wording and lines (\\n) and writing formulas in LaTeX between dollar signs. Use null when it gives only the answer.
- When the document has no answer for a question, leave its answer fields null and say so in the note. Handwritten or circled marks may be a child's work, not the key: use only printed or clearly marked answers.`

const SCAN_OUTRO = "Write the title, topic, description, skill tags and notes in Vietnamese."

/** System prompt of a scan: transcription only, or also reading the answers and solutions the document prints. */
export function scanSystemPrompt(withSolutions = false): string {
  return [SCAN_INTRO, withSolutions ? READ_SOLUTIONS : TRANSCRIBE_ONLY, SCAN_OUTRO].join("\n\n")
}

/** Label shown to Claude above each file; `page` in the response refers to its number. */
export function scanFileLabel(index: number, file: { name: string; kind: "image" | "pdf" }): string {
  return `Tệp ${index + 1} (${file.kind === "pdf" ? "PDF" : "ảnh"}: ${file.name})`
}

/**
 * Files per scan request. Batches run in parallel: one request for a whole
 * many-page document outlasts the 300 s function limit, and pages share the
 * output cap (solving while scanning once took ~60k tokens of thinking for one
 * page, after which the model dropped the later pages; scans no longer solve).
 */
export const SCAN_BATCH_FILES = 1

/** A range of file indexes, end exclusive. */
export interface ScanBatch {
  start: number
  end: number
}

export function scanBatches(fileCount: number): ScanBatch[] {
  const batches: ScanBatch[] = []
  for (let start = 0; start < fileCount; start += SCAN_BATCH_FILES) {
    batches.push({ start, end: Math.min(fileCount, start + SCAN_BATCH_FILES) })
  }
  return batches
}

/** Opening text of the user message: who the questions are for, and which files this request holds. */
export function scanRequestText(meta: ScanMeta, fileCount: number, batch?: ScanBatch): string {
  const files =
    batch && batch.end - batch.start < fileCount
      ? `This request holds ${batch.end - batch.start > 1 ? `files ${batch.start + 1}–${batch.end}` : `file ${batch.end}`} of a ${fileCount}-file document, preceded by its "Tệp N" label; the other files are scanned separately. Transcribe all exercises in this part into questions; when an exercise starts on an earlier file, transcribe the part shown here.`
      : `${fileCount} file${fileCount > 1 ? "s" : ""} follow${fileCount > 1 ? "" : "s"}, each preceded by its "Tệp N" label. Transcribe all exercises into questions.`
  return [`Subject: ${SUBJECT_NAMES[meta.subject]}. Grade ${meta.grade} (Vietnamese primary school). The parent says this is ${KIND_NAMES[meta.kind]}.`, files].join("\n")
}

const clampInt = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback

/** Maps Claude's response to what the review step shows; `newId` makes question ids. */
export function toScanResult(res: ScanResponse, meta: ScanMeta, fileCount: number, newId: () => string): ScanResult {
  const items = res.questions
    .filter((q) => q.prompt.trim() || q.type === "sap-xep" || q.type === "noi")
    .map((q): ScannedQuestion => {
      const converted = toQuestion(q, newId(), { answers: meta.withSolutions ? "document" : "none" })
      const note = converted.notes.join(" · ")
      return {
        question: converted.question,
        confidence: converted.confidence,
        page: Math.min(Math.max(1, fileCount), converted.page),
        ...(note ? { note } : {}),
        ...(converted.figure ? { figure: { page: Math.min(Math.max(1, fileCount), converted.figure.page), box: converted.figure.box } } : {}),
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

/** Joins the results of a document's batches, in file order, into one scan result. */
export function mergeScanResults(parts: ScanResult[]): ScanResult {
  const withItems = parts.filter((p) => p.items.length)
  const scored = withItems.length ? withItems : parts
  const lead = scored[0]
  return {
    ...lead,
    difficulty: clampInt(scored.reduce((sum, p) => sum + p.difficulty, 0) / scored.length, 1, 5, 3) as Difficulty,
    estimatedMinutes: Math.min(240, scored.reduce((sum, p) => sum + p.estimatedMinutes, 0)),
    items: parts.flatMap((p) => p.items),
  }
}
