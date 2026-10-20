import { z } from "zod"
import { MATH_NOTATION_RULES, aiQuestionSchema, toQuestion } from "@/lib/ai/question-format"
import type { Difficulty, ExerciseKind, Question, QuestionGroup, SubjectId } from "@/lib/types"
import { repairBox, type Box } from "@/lib/figure-crop"
import { uid } from "@/lib/questions"

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
  /** The figure of the câu's bài, the same on every câu of it; cropped into `group.image`. */
  groupFigure?: { page: number; box: Box }
  /**
   * Stand-in for a passage that has no câu yet (cut off before its questions):
   * an empty tu-luan holding the bài. Joined away across pages or resolved by
   * the parent in review; never saved.
   */
  placeholder?: true
}

export interface ScanResult {
  title: string
  topic: string
  description: string
  difficulty: Difficulty
  estimatedMinutes: number
  items: ScannedQuestion[]
}

/**
 * One page's result plus what joining pages needs: the bài the page starts
 * with when it continues the previous page, and the page's last bài.
 */
export interface ScanPart extends ScanResult {
  lead?: { groupId: string; continues: boolean; label?: string; midParagraph: boolean }
  tail?: { groupId: string; empty: boolean }
}

export const scanGroupSchema = z.object({
  key: z.string().describe("Id of this bài, unique on this page; câu of the bài give it as groupKey"),
  label: z.string().nullable().describe('The bài\'s label as printed ("Bài 3", "Part 2", "Exercise 1"), or null'),
  layout: z
    .enum(["doan-van", "hoi-thoai"])
    .nullable()
    .describe("doan-van for a reading passage, story, letter or poem; hoi-thoai for a dialogue; null for a plain shared instruction"),
  prompt: z.string().describe("The shared part shown once above the bài's câu: instruction, title, passage or dialogue, with the layout marks"),
  figure: z.object({ box: z.array(z.number()) }).nullable().describe("Box of the picture shared by the bài's câu, or null"),
  continues: z.boolean().nullable().describe("True only for a bài at the top of this page that started on an earlier page"),
  midParagraph: z.boolean().nullable().describe("With continues: this page's text starts in the middle of a paragraph cut by the page break"),
})

export const scanResponseSchema = z.object({
  title: z.string().describe("Short Vietnamese title for the exercise set, e.g. \"Ôn tập phép nhân – Tuần 6\""),
  topic: z.string().describe("Main topic in a few Vietnamese words, e.g. \"Bảng nhân 6, 7\""),
  description: z.string().describe("One or two Vietnamese sentences describing the set for the parent"),
  difficulty: z.number().int().describe("1 (very easy) to 5 (very hard) for a child of this grade"),
  estimatedMinutes: z.number().int().describe("Minutes the child needs to finish every question"),
  groups: z.array(scanGroupSchema).describe("The bài on these pages, in document order; empty when no exercise has a shared part"),
  questions: z
    .array(aiQuestionSchema.extend({ groupKey: z.string().nullable().describe("key of the bài this question belongs to, or null") }))
    .describe("Every exercise in the document, in document order"),
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
- Split multi-part exercises into one question per part when each part has its own answer.
- Bài: when several answerable parts share an instruction, a passage, a dialogue, word-problem facts or a picture, write that shared part ONCE as a bài in groups and give each of those questions the bài's key as groupKey. Each question's prompt then holds only its own part (e.g. "How do capybaras look different from rats and mice?"), never the shared text again. Keep the bài label as printed in label ("Bài 3", "Part 2"); still drop the numbering of the questions. A question with nothing shared has groupKey null.
- A bài's prompt for a reading passage, story, letter or poem (layout doan-van) or a dialogue (layout hoi-thoai) follows the paper with these marks, one item per line: "# " before the title; the instruction line wrapped in ** (e.g. "**Read the text, then answer the questions.**"); each paragraph on ONE line (join the lines the page merely wrapped); in a dialogue each turn on its own line as "Name: words" (keep a dash "– " turn as printed). Use **…** inside a line only for words printed in bold. A plain shared instruction (e.g. "Tính:", "Khoanh vào chữ đặt trước câu trả lời đúng") is a bài with layout null and no marks.
- A fill-in passage (a text with numbered gaps): the bài holds the instruction and title; the passage itself, with each gap written as ___, is ONE dien-cho-trong question in that bài.
- Pages are scanned separately. A bài that began on an earlier page is given again on this page with continues true; set midParagraph when its text here starts in the middle of a paragraph.
- Keep the layout of reading passages, poems, letters and dialogues: put a line break (\\n) wherever the document starts a new line or paragraph, and give each dialogue turn its own line, keeping its dash ("– ") or speaker name.
- Choose the question type that matches how the child answers. tra-loi-ngan is only for an answer that is one short value checked exactly (a number with its unit, a word, a phrase, one short sentence) — e.g. "Điền đáp số", "Viết kết quả". When the child must write out working or a full answer — word problems in a "Tự luận"/"Bài giải" part, "Đặt tính rồi tính", "Tìm x" with steps, "Trình bày", explaining, writing sentences, paragraphs or essays — use tu-luan.
- Skip headers, names/date lines, general instructions and example items that are not questions.
- Report low confidence and a short note when text is hard to read, cut off or ambiguous. Never invent questions that are not in the document.
${MATH_NOTATION_RULES}
- When the child needs a picture, diagram, drawn table or chart to answer (geometry figures, objects to count, clocks, charts), fill figure with its box on that page: [x0, y0, x1, y1] from 0 to 1000 of the page's width and height, tight around the drawing and its labels (lengths, letters, numbers), leaving out the question text and the answer choices below it. A picture shared by a bài's questions goes in the bài's figure, not in each question. Use null when no picture is needed.
- page is the number N of the "Tệp N" label above the file the question comes from.`

const TRANSCRIBE_ONLY = `Answers:
- Do not solve anything and do not look for answers: the parent adds answer keys later. Leave correctIndexes, trueFalseAnswer, answers, answer, rubric and solution null, even when the document shows answers.
- noi: give the pairs as printed, row by row (the left item and the right item on the same row). sap-xep: give the tokens in the printed order.
- Still set math (and simplest) from what the child is asked to write.`

const READ_SOLUTIONS = `Answers:
- The document includes its answers and worked solutions (an answer key, "Đáp án", "Lời giải", "Hướng dẫn giải", often after the questions or on later pages). Read them; do not solve anything yourself. Do not turn the answer key or the solutions into questions.
- Fill each question's answer fields from the document: correctIndexes (every correct option), trueFalseAnswer, answers, answer; noi with the correctly matched pairs; sap-xep with the tokens in the correct order; tu-luan rubric with what the document expects (e.g. "Đáp số: …").
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
      ? `This request holds ${batch.end - batch.start > 1 ? `files ${batch.start + 1}–${batch.end}` : `file ${batch.end}`} of a ${fileCount}-file document, preceded by its "Tệp N" label; the other files are scanned separately. Transcribe all exercises in this part into questions. When the first bài on this page started on an earlier file, still give it as a bài with continues true (with its label if printed here) and only the shared text shown on this page as its prompt (may be empty); set midParagraph when that text starts in the middle of a paragraph. When a passage is cut off at the bottom before its questions, still give it as the last bài.`
      : `${fileCount} file${fileCount > 1 ? "s" : ""} follow${fileCount > 1 ? "" : "s"}, each preceded by its "Tệp N" label. Transcribe all exercises into questions.`
  return [`Subject: ${SUBJECT_NAMES[meta.subject]}. Grade ${meta.grade} (Vietnamese primary school). The parent says this is ${KIND_NAMES[meta.kind]}.`, files].join("\n")
}

const clampInt = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback

interface PageGroup {
  group: QuestionGroup
  figure?: Box
  source: ScanResponse["groups"][number]
}

const sameBox = (a: Box, b: Box) => a.every((n, i) => n === b[i])

/** Maps Claude's response to what the review step shows; `newId` makes question ids. */
export function toScanResult(res: ScanResponse, meta: ScanMeta, fileCount: number, newId: () => string): ScanPart {
  const clampPage = (page: number) => Math.min(Math.max(1, fileCount), page)
  const groups = new Map<string, PageGroup>()
  for (const g of res.groups) {
    if (groups.has(g.key)) continue
    const label = g.label?.trim()
    const box = g.figure ? repairBox(g.figure.box) : null
    groups.set(g.key, {
      group: { id: uid("bai"), ...(label ? { label: label.slice(0, 40) } : {}), prompt: g.prompt.trim(), ...(g.layout ? { layout: g.layout } : {}) },
      ...(box ? { figure: box } : {}),
      source: g,
    })
  }
  const items = res.questions
    .filter((q) => q.prompt.trim() || q.type === "sap-xep" || q.type === "noi")
    .map((q): ScannedQuestion => {
      const converted = toQuestion(q, newId(), { answers: meta.withSolutions ? "document" : "none" })
      const note = converted.notes.join(" · ")
      const page = clampPage(converted.page)
      const bai = q.groupKey ? groups.get(q.groupKey) : undefined
      const figure = converted.figure && !(bai?.figure && sameBox(bai.figure, converted.figure.box)) ? converted.figure : undefined
      return {
        question: bai ? { ...converted.question, group: bai.group } : converted.question,
        confidence: converted.confidence,
        page,
        ...(note ? { note } : {}),
        ...(figure ? { figure: { page: clampPage(figure.page), box: figure.box } } : {}),
        ...(bai?.figure ? { groupFigure: { page, box: bai.figure } } : {}),
      }
    })
  const used = new Set(items.flatMap((i) => (i.question.group ? [i.question.group.id] : [])))
  // A passage cut off before its questions can only be the page's last bài; it waits for the next page.
  const last = [...groups.values()].at(-1)
  if (last && !used.has(last.group.id)) {
    const page = clampPage(items.at(-1)?.page ?? 1)
    items.push({
      question: { id: newId(), type: "tu-luan", prompt: "", rubric: "", points: 0, skills: [], group: last.group },
      confidence: 1,
      page,
      placeholder: true,
      ...(last.figure ? { groupFigure: { page, box: last.figure } } : {}),
    })
  }
  const firstGroup = items[0]?.question.group
  const lead = firstGroup ? [...groups.values()].find((g) => g.group.id === firstGroup.id) : undefined
  const tailGroup = [...items].reverse().find((i) => i.question.group)?.question.group
  const tailItems = tailGroup ? items.filter((i) => i.question.group?.id === tailGroup.id) : []
  const topic = res.topic.trim() || items[0]?.question.skills[0] || ""
  return {
    title: res.title.trim().slice(0, 200) || `Phiếu bài tập lớp ${meta.grade}`,
    topic: topic.slice(0, 200),
    description: res.description.trim().slice(0, 2000),
    difficulty: clampInt(res.difficulty, 1, 5, 3) as Difficulty,
    estimatedMinutes: clampInt(res.estimatedMinutes, 5, 240, Math.max(10, items.length * 3)),
    items,
    ...(lead?.source.continues
      ? { lead: { groupId: lead.group.id, continues: true, ...(lead.group.label ? { label: lead.group.label } : {}), midParagraph: !!lead.source.midParagraph } }
      : {}),
    ...(tailGroup ? { tail: { groupId: tailGroup.id, empty: tailItems.every((i) => i.placeholder) } } : {}),
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
