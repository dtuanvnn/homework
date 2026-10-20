import { describe, expect, it } from "vitest"
import type { AiQuestion } from "./question-format"
import { REPAIRED_CONFIDENCE } from "./question-format"
import { GIANT_RAT_BOX, giantRatScan } from "@/lib/fixtures/giant-rat-scan"
import {
  mergeScanResults,
  SCAN_BATCH_FILES,
  scanSystemPrompt,
  scanBatches,
  scanFileLabel,
  scanRequestText,
  scanResponseSchema,
  toScanResult,
  type ScanMeta,
  type ScanResponse,
} from "./scan"

const meta: ScanMeta = { subject: "toan", grade: 3, kind: "luyen-tap" }
/** A document with printed answers: keys are read, so tests can check the mapping of answers. */
const keyed: ScanMeta = { ...meta, withSolutions: true }

const blank: AiQuestion = {
  type: "tra-loi-ngan",
  prompt: "",
  points: 1,
  skills: [],
  options: null,
  correctIndexes: null,
  trueFalseAnswer: null,
  answers: null,
  answer: null,
  pairs: null,
  tokens: null,
  rubric: null,
  confidence: 0.9,
  page: 1,
  note: null,
  math: null,
  simplest: null,
  figure: null,
  solution: null,
}
type ScanQuestion = ScanResponse["questions"][number]
const q = (patch: Partial<ScanQuestion>): ScanQuestion => ({ ...blank, groupKey: null, ...patch })

const response = (patch: Partial<ScanResponse>): ScanResponse => ({
  groups: [],
  title: "Ôn tập phép nhân",
  topic: "Bảng nhân 6",
  description: "Phiếu luyện tập bảng nhân 6.",
  difficulty: 2,
  estimatedMinutes: 15,
  questions: [],
  ...patch,
})

const ids = () => {
  let n = 0
  return () => `id-${++n}`
}

describe("scan prompt pieces", () => {
  it("labels files with a 1-based number the response's page refers to", () => {
    expect(scanFileLabel(0, { name: "trang-1.jpg", kind: "image" })).toBe("Tệp 1 (ảnh: trang-1.jpg)")
    expect(scanFileLabel(2, { name: "de.pdf", kind: "pdf" })).toBe("Tệp 3 (PDF: de.pdf)")
    expect(scanSystemPrompt()).toContain('"Tệp N"')
  })

  it("describes the subject, grade, kind and file count", () => {
    const text = scanRequestText({ subject: "tieng-anh", grade: 4, kind: "de-thi" }, 2)
    expect(text).toContain("English")
    expect(text).toContain("Grade 4")
    expect(text).toContain("test/exam")
    expect(text).toContain("2 files follow")
    expect(scanRequestText(meta, 1)).toContain("1 file follows")
  })

  it("tells a batch which files of the document it holds", () => {
    const text = scanRequestText(meta, 7, { start: 3, end: 6 })
    expect(text).toContain("files 4–6 of a 7-file document")
    expect(text).not.toContain("files follow")
    expect(scanRequestText(meta, 2, { start: 1, end: 2 })).toContain("file 2 of a 2-file document")
  })

  it("splits files into consecutive batches", () => {
    expect(scanBatches(1)).toEqual([{ start: 0, end: 1 }])
    expect(scanBatches(SCAN_BATCH_FILES)).toEqual([{ start: 0, end: SCAN_BATCH_FILES }])
    expect(scanBatches(7)).toHaveLength(Math.ceil(7 / SCAN_BATCH_FILES))
    expect(scanBatches(7).flatMap((b) => Array.from({ length: b.end - b.start }, (_, i) => b.start + i))).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(scanBatches(7).at(-1)?.end).toBe(7)
  })

  it("has a response schema Claude's output parses against", () => {
    const parsed = scanResponseSchema.safeParse(response({ questions: [q({ prompt: "6 × 7 = ?", answer: "42" })] }))
    expect(parsed.success).toBe(true)
  })
})

describe("toScanResult", () => {
  it("maps questions to review items with ids, confidence and page", () => {
    const r = toScanResult(
      response({
        questions: [
          q({ type: "trac-nghiem", prompt: "8 × 6 = ?", options: ["42", "48"], correctIndexes: [1], confidence: 0.95, page: 1 }),
          q({ prompt: "Tính: 456 + 237 = ?", answer: "693", confidence: 0.8, page: 2 }),
        ],
      }),
      keyed,
      2,
      ids(),
    )
    expect(r.title).toBe("Ôn tập phép nhân")
    expect(r.topic).toBe("Bảng nhân 6")
    expect(r.difficulty).toBe(2)
    expect(r.estimatedMinutes).toBe(15)
    expect(r.items).toHaveLength(2)
    expect(r.items[0]).toEqual({
      question: { id: "id-1", type: "trac-nghiem", prompt: "8 × 6 = ?", options: ["42", "48"], correctIndex: 1, points: 1, skills: [] },
      confidence: 0.95,
      page: 1,
    })
    expect(r.items[1]).toMatchObject({ question: { id: "id-2", answer: "693" }, confidence: 0.8, page: 2 })
    expect(r.items[1].note).toBeUndefined()
  })

  it("joins Claude's note with repair notes and lowers confidence for incomplete questions", () => {
    const r = toScanResult(response({ questions: [q({ type: "trac-nghiem", prompt: "Chọn đáp án", options: ["a"], correctIndexes: [0], note: "Chữ mờ", confidence: 0.9 })] }), keyed, 1, ids())
    expect(r.items[0].note).toBe("Chữ mờ · Câu hỏi chưa đủ thông tin")
    expect(r.items[0].confidence).toBe(REPAIRED_CONFIDENCE)
  })

  it("notes questions the document has no answer for, without lowering confidence", () => {
    const r = toScanResult(response({ questions: [q({ prompt: "Hỏi đã bán bao nhiêu ki-lô-gam?", note: "Chữ mờ", confidence: 0.9 })] }), keyed, 1, ids())
    expect(r.items[0].note).toBe("Chữ mờ · Tài liệu không có đáp án câu này")
    expect(r.items[0].confidence).toBe(0.9)
  })

  it("clamps pages to the uploaded files and drops empty questions", () => {
    const r = toScanResult(response({ questions: [q({ prompt: "1 + 1 = ?", answer: "2", page: 7 }), q({ prompt: "  " })] }), meta, 3, ids())
    expect(r.items).toHaveLength(1)
    expect(r.items[0].page).toBe(3)
  })

  it("clamps difficulty and minutes and falls back for a missing title and topic", () => {
    const r = toScanResult(
      response({ title: " ", topic: "", difficulty: 9, estimatedMinutes: 900, questions: [q({ prompt: "2 × 3 = ?", answer: "6", skills: ["Bảng nhân 2"] })] }),
      meta,
      1,
      ids(),
    )
    expect(r.title).toBe("Phiếu bài tập lớp 3")
    expect(r.topic).toBe("Bảng nhân 2")
    expect(r.difficulty).toBe(5)
    expect(r.estimatedMinutes).toBe(240)
    expect(toScanResult(response({ difficulty: 0, estimatedMinutes: 1 }), meta, 1, ids())).toMatchObject({ difficulty: 1, estimatedMinutes: 5 })
  })
})

describe("mergeScanResults", () => {
  const part = (patch: Partial<ScanResponse>, newId: () => string) => toScanResult(response(patch), meta, 6, newId)

  it("keeps the first batch's details, adds up minutes and keeps questions in page order", () => {
    const newId = ids()
    const r = mergeScanResults([
      part({ difficulty: 2, estimatedMinutes: 10, questions: [q({ prompt: "1 + 1 = ?", answer: "2", page: 1 })] }, newId),
      part({ title: "Khác", difficulty: 4, estimatedMinutes: 20, questions: [q({ prompt: "2 + 2 = ?", answer: "4", page: 4 })] }, newId),
    ])
    expect(r.title).toBe("Ôn tập phép nhân")
    expect(r.difficulty).toBe(3)
    expect(r.estimatedMinutes).toBe(30)
    expect(r.items.map((i) => [i.question.id, i.page])).toEqual([
      ["id-1", 1],
      ["id-2", 4],
    ])
  })

  it("ignores batches without questions for the details and caps minutes", () => {
    const newId = ids()
    const found = () => [q({ prompt: "3 + 3 = ?", answer: "6", page: 3 })]
    const r = mergeScanResults([
      part({ title: "Trang bìa", difficulty: 5, estimatedMinutes: 200 }, newId),
      part({ title: "Bài tập", estimatedMinutes: 200, questions: found() }, newId),
    ])
    expect(r.title).toBe("Bài tập")
    expect(r.estimatedMinutes).toBe(200)
    expect(r.difficulty).toBe(2)
    const long = mergeScanResults([part({ estimatedMinutes: 200, questions: found() }, newId), part({ estimatedMinutes: 200, questions: found() }, newId)])
    expect(long.estimatedMinutes).toBe(240)
  })

  it("carries figure boxes to the review items", () => {
    const r = toScanResult(
      response({ questions: [q({ type: "trac-nghiem", prompt: "Hình nào?", options: ["A", "B"], correctIndexes: [0], page: 2, figure: { box: [100, 100, 400, 400] } })] }),
      meta,
      3,
      ids(),
    )
    expect(r.items[0].figure).toEqual({ page: 2, box: [100, 100, 400, 400] })
  })

  it("asks for LaTeX formulas and figure boxes", () => {
    expect(scanSystemPrompt()).toContain("$\\frac{3}{4} + \\frac{1}{8}$")
    expect(scanSystemPrompt()).toContain("fill figure")
  })
})

describe("scan groups bài", () => {
  const group = (patch: Partial<ScanResponse["groups"][number]>): ScanResponse["groups"][number] => ({
    key: "g",
    label: null,
    layout: null,
    prompt: "Shared",
    figure: null,
    continues: null,
    midParagraph: null,
    ...patch,
  })

  it("maps the A Giant Rat page to one formatted bài", () => {
    const r = toScanResult(giantRatScan, { subject: "tieng-anh", grade: 3, kind: "chu-de" }, 1, ids())
    expect(r.items).toHaveLength(5)
    const id = r.items[0].question.group?.id
    expect(id).toBeTruthy()
    expect(r.items.every((i) => i.question.group?.id === id)).toBe(true)
    expect(r.items[0].question.group).toMatchObject({ layout: "doan-van" })
    expect(r.items[0].question.group?.prompt.startsWith("**Read the text")).toBe(true)
    expect(r.items[0].question.group?.label).toBeUndefined()
    expect(r.items[0].question.prompt).toBe("How do capybaras look different from rats and mice?")
    expect(r.items.every((i) => i.groupFigure?.page === 1 && i.groupFigure.box.join() === GIANT_RAT_BOX.join())).toBe(true)
  })

  it("drops a câu figure that repeats its bài figure", () => {
    const r = toScanResult(giantRatScan, meta, 1, ids())
    expect(r.items[2].figure).toBeUndefined()
  })

  it("leaves a câu standalone when its groupKey matches no group", () => {
    const r = toScanResult(response({ groups: [group({ key: "a" })], questions: [q({ prompt: "1 + 1 = ?", groupKey: "zzz" })] }), meta, 1, ids())
    expect(r.items[0].question.group).toBeUndefined()
  })

  it("keeps the printed label and a bài without layout", () => {
    const r = toScanResult(
      response({ groups: [group({ key: "a", label: "Bài 2", prompt: "Tính:" })], questions: [q({ prompt: "2 + 3", groupKey: "a" }), q({ prompt: "4 + 5", groupKey: "a" })] }),
      meta,
      1,
      ids(),
    )
    expect(r.items[0].question.group).toMatchObject({ label: "Bài 2", prompt: "Tính:" })
    expect(r.items[0].question.group?.layout).toBeUndefined()
  })

  it("describes the bài continuing from the previous page and the last bài of the page", () => {
    const r = toScanResult(
      response({
        groups: [group({ key: "a", continues: true, midParagraph: true, label: "Part 2", prompt: "rest of it." }), group({ key: "b", prompt: "Next passage" })],
        questions: [q({ prompt: "Q1", groupKey: "a" }), q({ prompt: "Q2", groupKey: "b" })],
      }),
      meta,
      1,
      ids(),
    )
    expect(r.lead).toEqual({ groupId: r.items[0].question.group?.id, continues: true, label: "Part 2", midParagraph: true })
    expect(r.tail).toEqual({ groupId: r.items[1].question.group?.id, empty: false })
  })

  it("has no lead when a standalone câu comes first", () => {
    const r = toScanResult(
      response({ groups: [group({ key: "a", continues: true })], questions: [q({ prompt: "Q0" }), q({ prompt: "Q1", groupKey: "a" })] }),
      meta,
      1,
      ids(),
    )
    expect(r.lead).toBeUndefined()
  })

  it("keeps a passage cut before its questions as a placeholder at the end of the page", () => {
    const r = toScanResult(
      response({ groups: [group({ key: "a" }), group({ key: "b", prompt: "A passage", layout: "doan-van" }), group({ key: "c" })], questions: [q({ prompt: "Q1", groupKey: "a" })] }),
      meta,
      1,
      ids(),
    )
    // "b" has no câu and is not last: dropped. "c" is last: kept as a placeholder.
    expect(r.items).toHaveLength(2)
    expect(r.items[1].placeholder).toBe(true)
    expect(r.items[1].question.prompt).toBe("")
    expect(r.items[1].question.points).toBe(0)
    expect(r.tail).toEqual({ groupId: r.items[1].question.group?.id, empty: true })
  })

  it("asks for bài instead of repeated context", () => {
    const prompt = scanSystemPrompt()
    expect(prompt).not.toContain("repeat shared context")
    for (const word of ["groupKey", "continues", "midParagraph", "# ", "**"]) expect(prompt).toContain(word)
    expect(scanRequestText(meta, 2, { start: 1, end: 2 })).toContain("continues")
  })
})
