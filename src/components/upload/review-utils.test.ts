import { describe, expect, it } from "vitest"
import type { ScannedQuestion } from "@/lib/ai/scan"
import { appendScanned, type ReviewItem } from "./review-utils"

const scanned = (page: number, figurePage?: number): ScannedQuestion => ({
  question: { id: `q${page}`, type: "tra-loi-ngan", prompt: "1 + 1 = ?", answer: "2", points: 1, skills: [] },
  confidence: 0.9,
  page,
  ...(figurePage ? { figure: { page: figurePage, box: [100, 100, 400, 400] } } : {}),
})

describe("appendScanned", () => {
  const existing: ReviewItem[] = [{ ...scanned(1), reviewed: true }]

  it("adds a later scan's questions after the reviewed ones, with pages counted from the earlier pages", () => {
    const list = appendScanned(existing, [scanned(1), scanned(2, 2)], 3)
    expect(list.map((i) => [i.question.id, i.page, i.figure?.page, i.reviewed, i.figureState])).toEqual([
      ["q1", 1, undefined, true, undefined],
      ["q1", 4, undefined, false, undefined],
      ["q2", 5, 5, false, "cropping"],
    ])
  })

  it("keeps the earlier items untouched", () => {
    const list = appendScanned(existing, [scanned(1)], 1)
    expect(list[0]).toBe(existing[0])
  })
})
