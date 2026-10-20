export type AppMode = "parent" | "student"

export type SubjectId = "toan" | "tieng-viet" | "tieng-anh"

export type AssignmentStatus = "chua-lam" | "dang-lam" | "cho-cham" | "da-cham" | "tre-han"

/** 1 = very easy … 5 = very hard */
export type Difficulty = 1 | 2 | 3 | 4 | 5

export type ExerciseKind = "de-thi" | "chu-de" | "luyen-tap"

export type ExerciseSource = "thu-cong" | "tai-len" | "ai"

export type ExerciseSetStatus = "nhap" | "san-sang"

/** "flashcard": a word list (only `tu-vung` questions) studied on flip cards and written by hand. */
export type ExerciseFormat = "cau-hoi" | "flashcard"

export interface Student {
  id: string
  householdId: string
  name: string
  grade: number
  /** Class label such as "3C1", when set. */
  className?: string
  /** Start year of the current school year (2026 = "2026–2027"). */
  schoolYear: number
  avatarEmoji: string
  totalStars: number
}

/** A child on the student PIN page. */
export interface PinStudent {
  id: string
  name: string
  avatarEmoji: string
  hasPin: boolean
}

/** A child in the parent's header menu and assign picker. */
export interface ChildOption {
  id: string
  name: string
  avatarEmoji: string
  grade: number
  locked: boolean
}

/** A child on the Students page. */
export interface StudentCard {
  id: string
  name: string
  avatarEmoji: string
  grade: number
  className: string | null
  schoolYear: number
  stars: number
  hasPin: boolean
  locked: boolean
  lockedUntil: string | null
  archived: boolean
}

/** A child on the Student detail page. */
export interface StudentDetailData {
  card: StudentCard
  years: (import("./school-year").Enrollment & { current: boolean })[]
  streak: number
  badges: number
  lockReason: string | null
}

export interface ExerciseSet {
  id: string
  title: string
  subject: SubjectId
  grade: number
  topic: string
  description: string
  questionCount: number
  estimatedMinutes: number
  difficulty: Difficulty
  kind: ExerciseKind
  source: ExerciseSource
  status: ExerciseSetStatus
  format: ExerciseFormat
  timesAssigned: number
  createdAt: string // ISO date
}

export interface Assignment {
  id: string
  exerciseSetId: string
  assignedDate: string // ISO date
  dueDate: string // ISO date
  status: AssignmentStatus
  parentNote?: string
  mode?: "web" | "paper"
  maxAttempts?: 1 | 2
  /** Exam mode: each attempt is handed in automatically this many minutes after it starts. */
  timeLimitMinutes?: number
  /** Attempts the child has started (drafts included); 0 means the assignment can change freely. */
  attemptCount?: number
}

export interface Attempt {
  id: string
  assignmentId?: string
  exerciseSetId: string
  subject: SubjectId
  submittedAt: string // ISO datetime
  gradedAt: string // ISO datetime
  /** Score on a 10-point scale, in 0.5 steps. */
  score: number
  correctCount: number
  totalCount: number
  durationMinutes: number
  stars: 0 | 1 | 2 | 3
  feedback: string
}

export interface SkillInsight {
  id: string
  subject: SubjectId
  skill: string
  /** Share of correct answers for this skill, 0–100. */
  accuracy: number
  wrongCount: number
  totalCount: number
  recentAttempts: number
  /** Exercise set suggested for extra practice. */
  practiceSetId: string
}

/* ---------- Questions ---------- */

export type QuestionType = "trac-nghiem" | "dung-sai" | "dien-cho-trong" | "tra-loi-ngan" | "noi" | "sap-xep" | "tu-luan" | "tu-vung"

/** A figure cut out of a scanned page (or picked in the editor); `path` is a Storage object. */
export interface QuestionImage {
  path: string
  width: number
  height: number
}

/**
 * Where a question's answer key stands. Absent: entered by the parent or read
 * from a document's printed answers. "missing": scanned without answers (the
 * answer fields hold placeholders and the parent grades it by hand);
 * "ai"/"ai-check": solved by AI, "ai-check" when the AI wasn't sure.
 */
export type AnswerStatus = "missing" | "ai" | "ai-check"

interface QuestionBase {
  id: string
  /** May contain LaTeX between $…$ (see lib/rich-text.ts). */
  prompt: string
  points: number
  skills: string[]
  image?: QuestionImage
  /** Read side only: signed URL of `image`, added when loading. Never stored. */
  imageUrl?: string
  answerStatus?: AnswerStatus
  /** Worked solution (may contain LaTeX) for the parent, and for the child once answers are revealed. */
  solution?: string
  /** A picture shown with the solution, same rules as `image`. */
  solutionImage?: QuestionImage
  /** Read side only: signed URL of `solutionImage`. Never stored. */
  solutionImageUrl?: string
  group?: QuestionGroup
}

/**
 * A bài: consecutive questions sharing `id` show `label`, `prompt` and `image`
 * once above them. Stored on every câu con as identical copies (lib/question-groups.ts).
 */
/** How a bài's shared prompt is laid out (lib/passage.ts); absent ⇒ plain text as typed. */
export type PassageLayout = "doan-van" | "hoi-thoai"

export interface QuestionGroup {
  id: string
  /** As printed on the paper ("Part 3"); absent ⇒ "Bài n". */
  label?: string
  /** Shared instruction or passage; may be empty. May contain LaTeX. */
  prompt: string
  /** Formatted passage or dialogue; absent ⇒ the prompt shows as plain lines. */
  layout?: PassageLayout
  image?: QuestionImage
  /** Read side only: signed URL of `image`. Never stored. */
  imageUrl?: string
}

/** With `math`, answers are LaTeX (no $) graded by value; `simplest` also requires lowest terms. */
interface MathAnswer {
  math?: boolean
  simplest?: boolean
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: "trac-nghiem"
  options: string[]
  /** The (first) correct option. */
  correctIndex: number
  /** Present only with two or more correct options; the child must pick exactly these (lib/choice.ts). */
  correctIndexes?: number[]
}

export interface TrueFalseQuestion extends QuestionBase {
  type: "dung-sai"
  answer: boolean
}

/** Blanks are written as "___" inside the prompt, one answer per blank. */
export interface FillBlankQuestion extends QuestionBase, MathAnswer {
  type: "dien-cho-trong"
  answers: string[]
}

export interface ShortAnswerQuestion extends QuestionBase, MathAnswer {
  type: "tra-loi-ngan"
  answer: string
  /** Split passage: 1-based index of the "___" in group.prompt this câu answers. */
  blank?: number
}

export interface MatchingPair {
  left: string
  right: string
  /** Optional picture (emoji) shown next to the right-hand item. */
  picture?: string
}

export interface MatchingQuestion extends QuestionBase {
  type: "noi"
  pairs: MatchingPair[]
}

export interface OrderingQuestion
  extends QuestionBase {
  /** Tokens in the correct order. */
  /** Indexes into `tokens` in the order shown to the student. */
  type: "sap-xep"
  tokens: string[]
  shuffled: number[]
}

export interface EssayQuestion extends QuestionBase {
  type: "tu-luan"
  rubric: string
}

/**
 * One word of a flashcard set: `prompt` is a short English explanation. The
 * child writes `word` by hand from the explanation and its audio; the parent grades.
 */
export interface VocabQuestion extends QuestionBase {
  type: "tu-vung"
  word: string
}

export type Question = MultipleChoiceQuestion | TrueFalseQuestion | FillBlankQuestion | ShortAnswerQuestion | MatchingQuestion | OrderingQuestion | EssayQuestion | VocabQuestion

export interface Attachment {
  id: string
  name: string
  kind: "image" | "pdf"
  sizeKb: number
  url?: string
  pages?: number
  /** Client only: a picked file not uploaded yet. */
  file?: File
  /** Client only: already uploaded to Storage for a set not saved yet (AI scan); saved as a new file without re-uploading. */
  uploaded?: { path: string; name: string; kind: "image" | "pdf"; sizeKb: number; pages?: number }
}

/** A question without its id, as stored in the database (distributes over the union). */
export type QuestionContent = Question extends infer T ? (T extends Question ? Omit<T, "id"> : never) : never
