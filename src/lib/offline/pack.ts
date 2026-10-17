import type { SubjectId } from "@/lib/types"
import type { TakeQuestion } from "@/lib/views/student"

/** One downloaded assignment: everything the take screen needs without network (no answer keys). */
export interface PackEntry {
  studentId: string
  assignmentId: string
  /** Changes whenever the set, the attempts or the draft change. */
  version: string
  /** `exerciseSets.updatedAt` (ISO); sent back with an offline hand-in. */
  setVersion: string
  title: string
  subject: SubjectId
  dueAt: string
  availableFrom: string
  timeLimitMinutes: number | null
  attemptNo: number
  /** Figures keep `image.path` (the blob's key); `imageUrl` only lives during the download. */
  questions: TakeQuestion[]
  draft: {
    attemptNo: number
    startedAt: string
    responses: Record<string, unknown>
    durationSeconds: number | null
    /** Timed attempt started on the server. */
    deadline: string | null
  } | null
  /** Data and every figure stored: "Đã tải ✓". */
  complete: boolean
}

export interface PackResponse {
  studentId: string
  studentName: string
  serverNow: string
  entries: Omit<PackEntry, "studentId" | "complete">[]
}
