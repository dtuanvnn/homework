import { z } from "zod"
import { aiQuestionSchema, answerKey, QUESTION_TYPE_NAMES, toQuestion } from "@/lib/ai/question-format"
import type { Question, QuestionType, SubjectId } from "@/lib/types"

/*
 * Pure parts of AI set generation ("Tạo bằng AI"): input validation, the
 * prompt sent to Claude, and mapping Claude's answer to app questions. The
 * Server Action (src/server/actions/ai-generate.ts) only loads data and calls ask().
 */

const QUESTION_TYPES = ["trac-nghiem", "dung-sai", "dien-cho-trong", "tra-loi-ngan", "noi", "sap-xep", "tu-luan"] as const

export const MAX_REFERENCE_SETS = 3
export const MIN_COUNT = 5
export const MAX_COUNT = 30

export const generateInputSchema = z.object({
  subject: z.enum(["toan", "tieng-viet", "tieng-anh"]),
  grade: z.number().int().min(1).max(12),
  kind: z.enum(["de-thi", "luyen-tap"]),
  topics: z.array(z.string().trim().min(1).max(100)).min(1, "Chọn ít nhất một chủ đề.").max(20),
  count: z.number().int().min(MIN_COUNT).max(MAX_COUNT),
  difficulty: z.number().int().min(1).max(5),
  types: z.array(z.enum(QUESTION_TYPES)).min(1, "Chọn ít nhất một dạng câu hỏi.").max(QUESTION_TYPES.length),
  referenceSetIds: z.array(z.uuid()).max(MAX_REFERENCE_SETS, `Chọn tối đa ${MAX_REFERENCE_SETS} bộ tham khảo.`),
  note: z.string().max(500, "Yêu cầu thêm tối đa 500 ký tự."),
  /** 0 for the first generation; "Tạo lại" increments it so Claude varies the set. */
  variation: z.number().int().min(0).max(1000).default(0),
})

export type GenerateInput = z.input<typeof generateInputSchema>
export type ParsedGenerateInput = z.output<typeof generateInputSchema>

/** What Claude returns. */
export const generatedSetSchema = z.object({
  title: z.string().describe("Short Vietnamese title for the set, e.g. \"Luyện tập Bảng nhân 7\""),
  description: z.string().describe("1-2 Vietnamese sentences for the parent: what the set practises"),
  estimatedMinutes: z.number().int().describe("Realistic minutes for this student to finish the whole set"),
  questions: z.array(aiQuestionSchema),
})

export type GeneratedSet = z.infer<typeof generatedSetSchema>

export interface ReferenceSet {
  title: string
  questions: Question[]
}

export interface GenerateResult {
  title: string
  description: string
  estimatedMinutes: number
  items: { question: Question; notes: string[] }[]
  /** Vietnamese notice when fewer valid questions came back than requested; null otherwise. */
  shortfall: string | null
}

const SUBJECT_NAMES: Record<SubjectId, string> = { toan: "Toán", "tieng-viet": "Tiếng Việt", "tieng-anh": "Tiếng Anh" }

const DIFFICULTY_LEVELS: Record<number, string> = {
  1: "1/5 - very easy: direct recall, one step, small numbers",
  2: "2/5 - easy: standard textbook exercises",
  3: "3/5 - medium: textbook exercises with some two-step questions",
  4: "4/5 - hard: multi-step and word problems that need careful reading",
  5: "5/5 - challenging: for strong students, still within the grade's curriculum",
}

/** Splits `count` questions over the selected types as evenly as possible (earlier types get the remainder). */
export function typeMix(types: readonly QuestionType[], count: number): { type: QuestionType; count: number }[] {
  const unique = [...new Set(types)]
  if (!unique.length) return []
  const base = Math.floor(count / unique.length)
  const extra = count % unique.length
  return unique.map((type, i) => ({ type, count: base + (i < extra ? 1 : 0) })).filter((m) => m.count > 0)
}

export const GENERATE_SYSTEM_PROMPT = `You write homework exercise sets for one primary-school student in Vietnam, for a parent who reviews them before assigning.

Rules:
- Follow the Vietnamese general education curriculum (Chương trình GDPT 2018) for the given subject and grade. Use only knowledge, vocabulary and number ranges the student has learned by that grade.
- Language: Toán and Tiếng Việt questions are entirely in Vietnamese. Tiếng Anh questions use English items with short Vietnamese instructions, as in Vietnamese grade-3+ English textbooks (e.g. "Chọn từ khác loại: cat / dog / pen").
- Keep wording short, clear and age-appropriate. Use familiar Vietnamese names and everyday contexts.
- Produce exactly the requested number of questions with the requested type mix. Fill only the fields of each question's type; set the others to null.
- Every answer must be correct and unambiguous. Double-check arithmetic, units, spelling and diacritics before answering; multiple-choice questions have exactly one correct option and plausible distractors.
- Tag each question with 1-2 skills, reusing the given topic names where they fit.
- Points: 1 per question, 2 for tu-luan, unless the parent asks otherwise.
- Reference questions, when given, show the expected style and level. Match them but never copy them verbatim; change numbers, words and contexts.
- Use note only to warn the parent about something to check; otherwise null. Set page to 1.`

function formatReferences(references: readonly ReferenceSet[]): string {
  return references
    .filter((r) => r.questions.length)
    .map((r, i) => {
      const lines = r.questions.map((q) => `- [${q.type}] ${oneLine(q.prompt)} => ${oneLine(answerKey(q))}`)
      return `Reference set ${i + 1}: "${oneLine(r.title)}"\n${lines.join("\n")}`
    })
    .join("\n\n")
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()

/** Caps reference questions so a few large sets don't blow up the prompt. */
export const MAX_REFERENCE_QUESTIONS = 40

/** The user message for one generation request. */
export function buildGeneratePrompt(input: ParsedGenerateInput, references: readonly ReferenceSet[] = []): string {
  const mix = typeMix(input.types, input.count)
    .map((m) => `- ${m.count} × ${m.type} (${QUESTION_TYPE_NAMES[m.type]})`)
    .join("\n")
  let budget = MAX_REFERENCE_QUESTIONS
  const capped = references.map((r) => {
    const questions = r.questions.slice(0, Math.max(0, budget))
    budget -= questions.length
    return { ...r, questions }
  })
  const refs = formatReferences(capped)
  const parts = [
    `Subject: ${SUBJECT_NAMES[input.subject]}`,
    `Grade: ${input.grade}`,
    `Set kind: ${input.kind === "de-thi" ? "test (đề thi): cover the topics broadly, ordered from easier to harder" : "practice (luyện tập): focused drill on the topics"}`,
    `Topics: ${input.topics.map(oneLine).join("; ")}`,
    `Difficulty: ${DIFFICULTY_LEVELS[input.difficulty]}`,
    `Number of questions: exactly ${input.count}, with this type mix:\n${mix}`,
  ]
  if (input.note.trim()) parts.push(`Parent's extra request (in Vietnamese): ${input.note.trim()}`)
  if (refs) parts.push(`Reference questions from the parent's library (type, prompt => answer):\n\n${refs}`)
  if (input.variation > 0)
    parts.push(`Variation ${input.variation}: the parent asked for a new version. Write different questions from a typical first attempt: new numbers, words and contexts.`)
  parts.push("Return the title, description, estimatedMinutes and the questions.")
  return parts.join("\n\n")
}

/** Converts Claude's set into app questions: drops unselected types, caps at `count`, keeps notes for review. */
export function mapGeneratedSet(
  output: GeneratedSet,
  input: Pick<ParsedGenerateInput, "types" | "count">,
  makeId: () => string,
): GenerateResult {
  const allowed = new Set<QuestionType>(input.types)
  const items = output.questions
    .filter((q) => allowed.has(q.type))
    .slice(0, input.count)
    .map((q) => {
      const { question, notes } = toQuestion(q, makeId())
      return { question, notes }
    })
  const minutes = Number.isFinite(output.estimatedMinutes) ? Math.round(output.estimatedMinutes) : items.length * 2
  return {
    title: output.title.trim(),
    description: output.description.trim(),
    estimatedMinutes: Math.min(240, Math.max(1, minutes || items.length * 2)),
    items,
    shortfall:
      items.length < input.count
        ? `AI chỉ tạo được ${items.length}/${input.count} câu hợp lệ. Bạn có thể tạo lại hoặc thêm câu khi sửa trong kho.`
        : null,
  }
}
