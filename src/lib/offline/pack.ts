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

/**
 * What a fresh pack changes on the device. `busy`: assignments with a local
 * draft or a queued hand-in; they keep the questions the child is answering.
 */
export function planPackUpdate(
  stored: PackEntry[],
  incoming: PackResponse["entries"],
  busy: Set<string>,
): { put: PackResponse["entries"]; remove: string[] } {
  const byId = new Map(stored.map((e) => [e.assignmentId, e]))
  const put = incoming.filter((e) => {
    if (busy.has(e.assignmentId)) return false
    const old = byId.get(e.assignmentId)
    return !old || old.version !== e.version || !old.complete
  })
  const fresh = new Set(incoming.map((e) => e.assignmentId))
  const remove = stored.map((e) => e.assignmentId).filter((id) => !fresh.has(id) && !busy.has(id))
  return { put, remove }
}
