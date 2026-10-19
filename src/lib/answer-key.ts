import { choiceKey, correctOptions } from "./choice"
import type { Question } from "./types"

/**
 * A question as snapshotted when the child submitted (`answers.question`),
 * with the answer key and solution added later to the set's question
 * (`current`, same id) when the snapshot had none. Only keys that still fit
 * the snapshot (same type, options and number of blanks/pairs/tokens) are
 * used, so results and grading compare against the question the child saw.
 * Matching and ordering keep the snapshot: the child's response points at
 * pair/token positions, which a later key reorders.
 */
export function withLaterAnswerKey(snapshot: Question, current: Question | undefined): Question {
  if (snapshot.answerStatus !== "missing" || !current || current.answerStatus === "missing" || current.type !== snapshot.type) return snapshot
  const extra = {
    answerStatus: current.answerStatus,
    ...(current.solution ? { solution: current.solution } : {}),
    ...(current.solutionImage ? { solutionImage: current.solutionImage } : {}),
  }
  switch (snapshot.type) {
    case "trac-nghiem": {
      const c = current as typeof snapshot
      return c.options.join("\n") === snapshot.options.join("\n") ? { ...snapshot, ...extra, ...choiceKey(correctOptions(c)) } : snapshot
    }
    case "dung-sai":
      return { ...snapshot, ...extra, answer: (current as typeof snapshot).answer }
    case "dien-cho-trong": {
      const c = current as typeof snapshot
      return c.answers.length === snapshot.answers.length ? { ...snapshot, ...extra, answers: c.answers, math: c.math, simplest: c.simplest } : snapshot
    }
    case "tra-loi-ngan": {
      const c = current as typeof snapshot
      return { ...snapshot, ...extra, answer: c.answer, math: c.math, simplest: c.simplest }
    }
    case "noi":
    case "sap-xep":
      return snapshot
    case "tu-luan":
      return { ...snapshot, ...extra, rubric: (current as typeof snapshot).rubric }
    case "tu-vung":
      return snapshot
  }
}
