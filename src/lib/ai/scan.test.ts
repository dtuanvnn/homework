import { describe, expect, it } from "vitest"
import type { AiQuestion } from "./question-format"
import { REPAIRED_CONFIDENCE } from "./question-format"
import {
  mergeScanResults,
  SCAN_BATCH_FILES,
  SCAN_SYSTEM_PROMPT,
  scanBatches,
  scanFileLabel,
  scanRequestText,
  scanResponseSchema,
  toScanResult,
  type ScanMeta,
  type ScanResponse,
} from "./scan"

const meta: ScanMeta = { subject: "toan", grade: 3, kind: "luyen-tap" }

const blank: AiQuestion = {
  type: "tra-loi-ngan",
  prompt: "",
  points: 1,
  skills: [],
  options: null,
  correctIndex: null,
  trueFalseAnswer: null,
  answers: null,
  answer: null,
  pairs: null,
  tokens: null,
  rubric: null,
  confidence: 0.9,
  page: 1,
  note: null,
}
const q = (patch: Partial<AiQuestion>): AiQuestion => ({ ...blank, ...patch })

const response = (patch: Partial<ScanResponse>): ScanResponse => ({
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
    expect(SCAN_SYSTEM_PROMPT).toContain('"Tệp N"')
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
  })

  it("splits files into consecutive batches", () => {
    expect(scanBatches(1)).toEqual([{ start: 0, end: 1 }])
    expect(scanBatches(SCAN_BATCH_FILES)).toEqual([{ start: 0, end: SCAN_BATCH_FILES }])
    expect(scanBatches(7).map((b) => b.end - b.start)).toEqual([3, 3, 1])
    expect(scanBatches(7).at(-1)).toEqual({ start: 6, end: 7 })
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
          q({ type: "trac-nghiem", prompt: "8 × 6 = ?", options: ["42", "48"], correctIndex: 1, confidence: 0.95, page: 1 }),
          q({ prompt: "Tính: 456 + 237 = ?", answer: "693", confidence: 0.8, page: 2 }),
        ],
      }),
      meta,
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
    const r = toScanResult(response({ questions: [q({ prompt: "Hỏi đã bán bao nhiêu ki-lô-gam?", note: "Chữ mờ", confidence: 0.9 })] }), meta, 1, ids())
    expect(r.items[0].note).toBe("Chữ mờ · Chưa có đáp án")
    expect(r.items[0].confidence).toBe(REPAIRED_CONFIDENCE)
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
})
