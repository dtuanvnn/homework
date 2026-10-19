import { isInkEmpty, type Ink } from "./ink"

/*
 * Study marks of the flashcard take screen ("Em thuộc rồi"): not graded and
 * never sent to the server, so they live in localStorage per attempt.
 */

export const studyKey = (studentId: string, assignmentId: string, attemptNo: number) => `hh-fc-study:${studentId}:${assignmentId}:${attemptNo}`

export function loadStudy(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

export function saveStudy(key: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    // Private mode or full storage: the marks only last this visit.
  }
}

/** A word's response has handwriting on it. */
export function hasInk(response: unknown): boolean {
  if (!response || typeof response !== "object" || Array.isArray(response)) return false
  return !isInkEmpty((response as { ink?: Ink }).ink)
}

/** "2. Viết từ" opens once every card is studied, or right away when the attempt already has handwriting. */
export function canWrite(questionIds: readonly string[], studied: ReadonlySet<string>, answers: Record<string, unknown>): boolean {
  return questionIds.every((id) => studied.has(id)) || questionIds.some((id) => hasInk(answers[id]))
}
