process.env.TZ = "Asia/Ho_Chi_Minh"

import { describe, expect, it } from "vitest"
import type { Ink } from "@/lib/ink"
import type { ExerciseSet, Question } from "@/lib/types"
import type { AnswerRecord, AssignmentRecord, AttemptRecord } from "@/server/queries"
import {
  answerText,
  autoFeedback,
  buildAssignments,
  buildResultDetail,
  buildResults,
  buildToday,
  canTake,
  correctAnswerText,
  stateOf,
  toTakeQuestion,
} from "./student"

const now = new Date("2026-10-15T15:00:00+07:00") // Thursday
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, 15 + day, hour - 7))

const set: ExerciseSet = {
  id: "set-1", title: "Bảng nhân 6, 7", subject: "toan", grade: 3, topic: "", description: "", questionCount: 10,
  estimatedMinutes: 15, difficulty: 2, kind: "luyen-tap", source: "thu-cong", status: "san-sang", format: "cau-hoi", timesAssigned: 1, createdAt: at(-10, 9).toISOString(),
}

let seq = 0
function attempt(over: Partial<AttemptRecord> = {}): AttemptRecord {
  seq++
  return {
    id: `att-${seq}`, attemptNo: 1, mode: "web", startedAt: at(0, 9), submittedAt: null, gradedAt: null, gradedBy: null,
    durationSeconds: null, score: null, feedback: null, retryAllowed: true,
    offlineId: null, submittedOffline: false, autoSettled: false, offlineSetChanged: false, ...over,
  }
}
const graded = (score: number, over: Partial<AttemptRecord> = {}) =>
  attempt({ submittedAt: at(0, 10), gradedAt: at(0, 11), gradedBy: "auto", score, ...over })

function assignment(id: string, over: Partial<AssignmentRecord> = {}): AssignmentRecord {
  return {
    id, setId: set.id, availableFrom: at(0, 6), dueAt: at(0, 20), mode: "web", maxAttempts: 2, timeLimitMinutes: null, parentNote: null,
    createdAt: at(-1, 21), set: { ...set, title: `Bài ${id}` }, attempts: [], ...over,
  }
}

describe("buildToday", () => {
  it("carries the time limit of timed assignments", () => {
    const view = buildToday([assignment("timed", { timeLimitMinutes: 20 }), assignment("free")], {}, now)
    expect(view.items.map((i) => [i.id, i.timeLimit])).toEqual([["timed", 20], ["free", undefined]])
  })

  it("picks today's, overdue and freshly graded retryable work; later days go to upcoming", () => {
    const records = [
      assignment("overdue", { availableFrom: at(-2, 6), dueAt: at(-1, 20) }),
      assignment("overdue-done", { availableFrom: at(-2, 6), dueAt: at(-1, 20), attempts: [attempt({ submittedAt: at(-1, 19) })] }),
      assignment("today"),
      assignment("graded-retry", { availableFrom: at(-3, 6), dueAt: at(-3, 20), attempts: [graded(6)] }),
      assignment("graded-old", { availableFrom: at(-3, 6), dueAt: at(-3, 20), attempts: [graded(6, { gradedAt: at(-2, 9) })] }),
      assignment("tomorrow", { dueAt: at(1, 20) }),
      assignment("scheduled", { availableFrom: at(2, 6), dueAt: at(3, 20) }),
      assignment("far", { dueAt: at(9, 20) }),
    ]
    const view = buildToday(records, {}, now)
    expect(view.items.map((i) => i.id)).toEqual(["overdue", "today", "graded-retry"])
    expect(view.items[0]).toMatchObject({ overdue: true, due: "20:00 hôm qua", status: "not-started" })
    expect(view.items[1]).toMatchObject({ overdue: false, due: "20:00" })
    expect(view.upcoming.map((u) => u.id)).toEqual(["tomorrow", "scheduled"])
    expect(view.upcoming[0]).toMatchObject({ day: "Thứ Sáu", date: "16/10" })
    expect(view.dateLabel).toBe("Thứ Năm, 15/10/2026")
  })

  it("maps derived state to the card status, progress and retry info", () => {
    const draft = attempt()
    const records = [
      assignment("a", { attempts: [draft] }),
      assignment("b", { attempts: [attempt({ submittedAt: at(0, 10) })] }),
      assignment("c", { attempts: [graded(6.5)] }),
      assignment("d", { attempts: [graded(5, { retryAllowed: true }), graded(8.5, { attemptNo: 2 })] }),
    ]
    const [a, b, c, d] = buildToday(records, { [draft.id]: 4 }, now).items
    expect(a).toMatchObject({ status: "in-progress", progress: 40, attempt: 1 })
    expect(b).toMatchObject({ status: "submitted" })
    expect(c).toMatchObject({ status: "graded", score: 6.5, canRetry: true, resultId: records[2].attempts[0].id })
    expect(d).toMatchObject({ status: "graded", attempt: 2, score: 8.5, previousScore: 5, canRetry: false })
  })

  it("shows the streak of days with all work in on time", () => {
    const onTime = (id: string, day: number) =>
      assignment(id, { availableFrom: at(day - 1, 6), dueAt: at(day, 20), attempts: [attempt({ submittedAt: at(day, 10) })] })
    expect(buildToday([onTime("a", -2), onTime("b", -1)], {}, now).streak).toBe(2)
  })
})

describe("canTake", () => {
  it("allows unfinished or retryable work only", () => {
    expect(canTake(stateOf(assignment("x"), now))).toBe(true)
    expect(canTake(stateOf(assignment("x", { availableFrom: at(1, 6) }), now))).toBe(false)
    expect(canTake(stateOf(assignment("x", { attempts: [attempt({ submittedAt: at(0, 10) })] }), now))).toBe(false)
    expect(canTake(stateOf(assignment("x", { attempts: [graded(7)] }), now))).toBe(true)
    expect(canTake(stateOf(assignment("x", { maxAttempts: 1, attempts: [graded(7)] }), now))).toBe(false)
  })
})

describe("buildAssignments", () => {
  it("groups by due day and summarises the week", () => {
    const view = buildAssignments(
      [
        assignment("late", { availableFrom: at(-3, 6), dueAt: at(-2, 20) }),
        assignment("today", { attempts: [graded(9)] }),
        assignment("hidden", { availableFrom: at(1, 6), dueAt: at(2, 20) }),
      ],
      {},
      now,
    )
    expect(view.items.map((i) => i.id)).toEqual(["late", "today"])
    expect(view.items[0]).toMatchObject({ late: true, dueText: "Trễ 2 ngày", group: { key: "late" } })
    expect(view.items[1]).toMatchObject({ dueText: "Hạn: 20:00 hôm nay", group: { key: "d0", label: "Hôm nay" } })
    expect(view.week).toEqual({ done: 1, total: 2 })
  })
})

describe("buildResults", () => {
  it("lists graded attempts newest first with retry info", () => {
    const first = graded(6, { gradedAt: at(-2, 9) })
    const second = attempt({ attemptNo: 2, submittedAt: at(-1, 9) })
    const results = buildResults(
      [assignment("a", { attempts: [first, second] }), assignment("b", { attempts: [graded(9.5)] })],
      now,
    )
    expect(results.map((r) => r.title)).toEqual(["Bài b", "Bài a"])
    expect(results[0]).toMatchObject({ stars: 3, canRetry: true, retryPending: false, gradedLabel: "15/10/2026" })
    expect(results[1]).toMatchObject({ id: first.id, stars: 1, canRetry: false, retryPending: true })
  })

  it("gives no stars to a second attempt", () => {
    const results = buildResults([assignment("a", { attempts: [graded(5, { gradedAt: at(-2, 9) }), graded(10, { attemptNo: 2 })] })], now)
    expect(results.map((r) => r.stars)).toEqual([0, 1])
  })
})

const mc: Question = { id: "q1", type: "trac-nghiem", prompt: "125 × 4 = ?", points: 1, skills: [], options: ["400", "500"], correctIndex: 1 }
const tf: Question = { id: "q2", type: "dung-sai", prompt: "450 là bốn trăm năm mươi", points: 1, skills: [], answer: true }
const fb: Question = { id: "q3", type: "dien-cho-trong", prompt: "2 × 3 = ___ ; 3 × 3 = ___", points: 1, skills: [], answers: ["6", "9"] }
const sa: Question = { id: "q4", type: "tra-loi-ngan", prompt: "96 : 4 = ?", points: 1, skills: [], answer: "24 kg" }
const match: Question = {
  id: "q5", type: "noi", prompt: "Nối", points: 1, skills: [],
  pairs: [{ left: "pen", right: "bút" }, { left: "ruler", right: "thước" }],
}
const order: Question = { id: "q6", type: "sap-xep", prompt: "Sắp xếp", points: 1, skills: [], tokens: ["I", "am", "eight"], shuffled: [2, 0, 1] }
const ink: Ink = { v: 1, paper: "o-li", pages: [{ strokes: [[100, 100, 5, 110, 100, 5]] }] }
const essay: Question = { id: "q7", type: "tu-luan", prompt: "Kể về gia đình", points: 2, skills: [], rubric: "Đủ ý" }

describe("answerText", () => {
  it("renders every question type as readable text", () => {
    expect(answerText(mc, 1)).toBe("500")
    expect(answerText(tf, false)).toBe("Sai")
    expect(answerText(fb, ["6", ""])).toBe("6 ; …")
    expect(answerText(sa, " 24 ")).toBe("24")
    expect(answerText(match, { "0": 1, "1": 0 })).toBe("pen – thước; ruler – bút")
    expect(answerText(order, [0, 2, 1])).toBe("I eight am")
    expect(answerText(essay, { text: "Nhà em có bốn người." })).toBe("Nhà em có bốn người.")
    expect(answerText(essay, { text: "", drawing: "data:image/png;base64,x" })).toBe("(bài viết tay)")
    expect(answerText(essay, { text: "", ink })).toBe("(bài viết tay)")
    expect(answerText(essay, { text: "Mở bài", ink })).toBe("Mở bài (kèm bài viết tay)")
    expect(answerText(essay, { text: "", ink: { ...ink, pages: [{ strokes: [] }] } })).toBe("(chưa trả lời)")
  })

  it("handles missing answers and paper work", () => {
    expect(answerText(mc, null)).toBe("(chưa trả lời)")
    expect(answerText(mc, 7)).toBe("(chưa trả lời)")
    expect(answerText(mc, null, "paper")).toBe("Bài làm trên giấy")
  })

  it("gives the expected answer except for essays", () => {
    expect(correctAnswerText(mc)).toBe("500")
    expect(correctAnswerText(fb)).toBe("6 ; 9")
    expect(correctAnswerText(match)).toBe("pen – bút; ruler – thước")
    expect(correctAnswerText(order)).toBe("I am eight")
    expect(correctAnswerText(essay)).toBeUndefined()
  })

  it("wraps math answers as formulas, one blank at a time", () => {
    const mathShort: Question = { id: "m1", type: "tra-loi-ngan", prompt: "?", points: 1, skills: [], answer: "\\frac{3}{4}", math: true }
    const mathFill: Question = { id: "m2", type: "dien-cho-trong", prompt: "___ ___", points: 1, skills: [], answers: ["\\frac{1}{2}", "2"], math: true }
    expect(answerText(mathShort, " 3/4 ")).toBe("$3/4$")
    expect(answerText(mathShort, "")).toBe("(chưa trả lời)")
    expect(correctAnswerText(mathShort)).toBe("$\\frac{3}{4}$")
    expect(answerText(mathFill, ["\\frac{1}{2}", ""])).toBe("$\\frac{1}{2}$ ; …")
    expect(correctAnswerText(mathFill)).toBe("$\\frac{1}{2}$ ; $2$")
  })
})

describe("buildResultDetail", () => {
  const row = (q: Question, response: AnswerRecord["response"], isCorrect: boolean | null, comment: string | null = null, hint: string | null = null): AnswerRecord => ({
    id: `ans-${q.id}`, attemptId: "x", questionId: q.id, position: 0, question: q, response, isCorrect, pointsAwarded: isCorrect ? q.points : 0, comment, hint,
  })

  it("reports the work time and the exam limit", () => {
    const first = graded(8, { durationSeconds: 1200 })
    const view = buildResultDetail({ attempt: { ...first, assignmentId: "a" }, assignment: assignment("a", { timeLimitMinutes: 20, attempts: [first] }), answers: [] }, now)
    expect(view).toMatchObject({ durationMinutes: 20, timeLimitMinutes: 20 })
    const untimed = graded(8, { durationSeconds: 20 })
    const short = buildResultDetail({ attempt: { ...untimed, assignmentId: "b" }, assignment: assignment("b", { attempts: [untimed] }), answers: [] }, now)
    expect(short).toMatchObject({ durationMinutes: 1, timeLimitMinutes: undefined })
  })

  it("hides correct answers while a retry is open and shows hints instead", () => {
    const first = graded(6, { feedback: "Cố lên nhé!" })
    const record = assignment("a", { attempts: [first] })
    const view = buildResultDetail(
      { attempt: { ...first, assignmentId: "a" }, assignment: record, answers: [row(mc, 1, true), row(sa, "24", false, "Nhớ ghi đơn vị", "Em xem lại đơn vị nhé")] },
      now,
    )
    expect(view).toMatchObject({ score: 6, stars: 1, attempt: 1, maxAttempts: 2, canRetry: true, answersRevealed: false, hintsPending: false, parentComment: "Cố lên nhé!" })
    expect(view?.review).toEqual([
      { id: "ans-q1", prompt: mc.prompt, answer: "500", correct: true, correctAnswer: undefined, comment: undefined, hint: undefined },
      { id: "ans-q4", prompt: sa.prompt, answer: "24", correct: false, correctAnswer: undefined, comment: "Nhớ ghi đơn vị", hint: "Em xem lại đơn vị nhé" },
    ])
  })

  it("asks for hints when wrong answers have none yet", () => {
    const first = graded(6)
    const view = buildResultDetail({ attempt: { ...first, assignmentId: "a" }, assignment: assignment("a", { attempts: [first] }), answers: [row(sa, "24", false)] }, now)
    expect(view?.hintsPending).toBe(true)
  })

  it("shows the right spelling of wrong words right away and asks for no hints", () => {
    const vocab: Question = { id: "v1", type: "tu-vung", word: "nest", prompt: "A bird's home made of twigs.", points: 1, skills: [] }
    const first = graded(5)
    const strip = { v: 1, paper: "o-li", size: "strip", pages: [{ strokes: [[10, 10, 5, 20, 20, 5]] }] } as Ink
    const view = buildResultDetail({ attempt: { ...first, assignmentId: "a" }, assignment: assignment("a", { attempts: [first] }), answers: [row(vocab, { text: "", ink: strip }, false)] }, now)
    expect(view).toMatchObject({ canRetry: true, answersRevealed: false, hintsPending: false })
    expect(view?.review[0]).toMatchObject({ word: "nest", correctAnswer: "nest", answer: "(bài viết tay)", handwriting: { ink: strip } })
  })

  it("reveals correct answers once no attempt is left", () => {
    const first = graded(5)
    const second = graded(8, { attemptNo: 2 })
    const record = assignment("a", { attempts: [first, second] })
    for (const a of [first, second]) {
      const view = buildResultDetail({ attempt: { ...a, assignmentId: "a" }, assignment: record, answers: [row(sa, "24", false)] }, now)
      expect(view).toMatchObject({ answersRevealed: true, hintsPending: false })
      expect(view?.review[0].correctAnswer).toBe("24 kg")
    }
    // Without an answer key there is nothing to reveal but the solution, if any.
    const keyless = buildResultDetail(
      { attempt: { ...second, assignmentId: "a" }, assignment: record, answers: [row({ ...sa, answerStatus: "missing", solution: "Lời giải" } as Question, "24", false)] },
      now,
    )
    expect(keyless?.review[0]).toMatchObject({ correctAnswer: undefined, solution: "Lời giải" })
    // Parent turned the retry off: nothing left to redo either.
    const closed = graded(5, { retryAllowed: false })
    const view = buildResultDetail({ attempt: { ...closed, assignmentId: "a" }, assignment: assignment("a", { attempts: [closed] }), answers: [row(sa, "24", false)] }, now)
    expect(view?.answersRevealed).toBe(true)
  })

  it("keeps answers hidden while the retry waits for grading", () => {
    const first = graded(5)
    const second = { ...attempt(), attemptNo: 2, submittedAt: now }
    const record = assignment("a", { attempts: [first, second] })
    const view = buildResultDetail({ attempt: { ...first, assignmentId: "a" }, assignment: record, answers: [row(sa, "24", false)] }, now)
    expect(view?.answersRevealed).toBe(false)
    expect(view?.review[0].correctAnswer).toBeUndefined()
    const withSolution = { ...sa, solution: "Lời giải", solutionImage: { path: "p", width: 1, height: 1 }, solutionImageUrl: "https://signed.example/p" } as Question
    const hidden = buildResultDetail({ attempt: { ...first, assignmentId: "a" }, assignment: record, answers: [row(withSolution, "24", false)] }, now)?.review[0]
    expect(hidden).toMatchObject({ solution: undefined, solutionImage: undefined, solutionImageUrl: undefined })
  })

  it("passes handwriting pages to the result screen", () => {
    const first = graded(8)
    const record = assignment("a", { attempts: [first] })
    const answers = [row(essay, { text: "", ink }, null), row({ ...essay, id: "q8" }, { text: "", drawing: "data:image/png;base64,AAA" }, null), row(sa, "24", true)]
    const view = buildResultDetail({ attempt: { ...first, assignmentId: "a" }, assignment: record, answers }, now)
    expect(view?.review.map((r) => r.handwriting)).toEqual([{ ink }, { drawing: "data:image/png;base64,AAA" }, undefined])
  })

  it("refuses ungraded attempts and reports the previous score", () => {
    const first = graded(5)
    const second = graded(8, { attemptNo: 2 })
    const record = assignment("a", { attempts: [first, second] })
    expect(buildResultDetail({ attempt: { ...attempt(), assignmentId: "a" }, assignment: record, answers: [] }, now)).toBeNull()
    expect(buildResultDetail({ attempt: { ...second, assignmentId: "a" }, assignment: record, answers: [] }, now)).toMatchObject({
      previousScore: 5,
      canRetry: false,
    })
  })
})

describe("toTakeQuestion", () => {
  it("strips answer keys but keeps what the UI needs", () => {
    expect(toTakeQuestion(mc)).not.toHaveProperty("correctIndex")
    expect(toTakeQuestion(mc)).not.toHaveProperty("multi")
    const multi = toTakeQuestion({ ...mc, correctIndexes: [0, 1] } as Question)
    expect(multi).toMatchObject({ multi: true })
    expect(multi).not.toHaveProperty("correctIndex")
    expect(multi).not.toHaveProperty("correctIndexes")
    expect(toTakeQuestion(tf)).not.toHaveProperty("answer")
    expect(toTakeQuestion(sa)).not.toHaveProperty("answer")
    expect(toTakeQuestion(essay)).not.toHaveProperty("rubric")
    expect(toTakeQuestion(fb)).toEqual({ id: "q3", type: "dien-cho-trong", prompt: fb.prompt, points: 1, skills: [], blanks: 2 })
    expect(toTakeQuestion(order)).toEqual(order)
    const solved = { ...sa, answerStatus: "ai", solution: "Lấy 96 : 4 = 24", solutionImage: { path: "p", width: 1, height: 1 }, solutionImageUrl: "u" } as Question
    expect(toTakeQuestion(solved)).not.toHaveProperty("solution")
    expect(toTakeQuestion(solved)).not.toHaveProperty("solutionImage")
    expect(toTakeQuestion(solved)).not.toHaveProperty("solutionImageUrl")
    expect(toTakeQuestion(solved)).not.toHaveProperty("answerStatus")
  })

  it("keeps the word of a tu-vung question (text-to-speech and study cards need it)", () => {
    const vocab: Question = { id: "v", type: "tu-vung", word: "nest", prompt: "A bird's home made of twigs.", points: 1, skills: [] }
    expect(toTakeQuestion(vocab)).toEqual(vocab)
  })
})

describe("autoFeedback", () => {
  it("is friendly at every score", () => {
    expect(autoFeedback(10)).toMatch(/đúng hết/)
    expect(autoFeedback(0)).toBeTruthy()
  })
})
