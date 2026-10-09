export type AppMode = "parent" | "student"

export type SubjectId = "toan" | "tieng-viet" | "tieng-anh"

export type AssignmentStatus = "chua-lam" | "dang-lam" | "cho-cham" | "da-cham" | "tre-han"

/** 1 = very easy … 5 = very hard */
export type Difficulty = 1 | 2 | 3 | 4 | 5

export type ExerciseKind = "de-thi" | "chu-de" | "luyen-tap"

export type ExerciseSource = "thu-cong" | "tai-len" | "ai"

export type ExerciseSetStatus = "nhap" | "san-sang"

export interface Student {
  id: string
  name: string
  grade: number
  avatarEmoji: string
  totalStars: number
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

export type QuestionType = "trac-nghiem" | "dung-sai" | "dien-cho-trong" | "tra-loi-ngan" | "noi" | "sap-xep" | "tu-luan"

interface QuestionBase {
  id: string
  prompt: string
  points: number
  skills: string[]
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: "trac-nghiem"
  options: string[]
  correctIndex: number
}

export interface TrueFalseQuestion extends QuestionBase {
  type: "dung-sai"
  answer: boolean
}

/** Blanks are written as "___" inside the prompt, one answer per blank. */
export interface FillBlankQuestion extends QuestionBase {
  type: "dien-cho-trong"
  answers: string[]
}

export interface ShortAnswerQuestion extends QuestionBase {
  type: "tra-loi-ngan"
  answer: string
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

export type Question = MultipleChoiceQuestion | TrueFalseQuestion | FillBlankQuestion | ShortAnswerQuestion | MatchingQuestion | OrderingQuestion | EssayQuestion

export interface Attachment {
  id: string
  name: string
  kind: "image" | "pdf"
  sizeKb: number
  url?: string
  pages?: number
  /** Client only: a picked file not uploaded yet. */
  file?: File
}

/** A question without its id, as stored in the database (distributes over the union). */
export type QuestionContent = Question extends infer T ? (T extends Question ? Omit<T, "id"> : never) : never
