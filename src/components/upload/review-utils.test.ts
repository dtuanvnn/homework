import { describe, expect, it } from "vitest"
import type { ScannedQuestion } from "@/lib/ai/scan"
import type { QuestionGroup } from "@/lib/types"
import { appendScanned, draftFigurePaths, hasPlaceholder, withSignedFigures, type ReviewItem } from "./review-utils"

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

describe("bài in scan drafts", () => {
  const FIG = { path: "sets/s/g-figure.jpg", width: 4, height: 3 }
  const group: QuestionGroup = { id: "g", prompt: "Passage", layout: "doan-van", image: FIG }
  const member = (id: string): ReviewItem => ({
    question: { id, type: "tu-luan", prompt: id, rubric: "", points: 1, skills: [], group },
    confidence: 0.9,
    page: 1,
    reviewed: false,
    groupFigure: { page: 1, box: [1, 2, 3, 4] },
  })

  it("lists a bài figure once even when three câu share it", () => {
    const own: ReviewItem = { ...scanned(2), question: { ...scanned(2).question, image: { path: "sets/s/q-figure.jpg", width: 1, height: 1 } }, reviewed: false }
    expect(draftFigurePaths([member("a"), member("b"), member("c"), own])).toEqual([FIG.path, "sets/s/q-figure.jpg"])
  })

  it("signs the bài figure on every câu", () => {
    const signed = withSignedFigures([member("a"), member("b")], { [FIG.path]: "https://signed" })
    expect(signed.map((i) => i.question.group?.imageUrl)).toEqual(["https://signed", "https://signed"])
  })

  it("shifts the page of a bài figure when pages are added", () => {
    const list = appendScanned([], [member("a")], 2)
    expect(list[0].groupFigure?.page).toBe(3)
    expect(list[0].figureState).toBe("cropping")
  })

  it("finds a passage still waiting for its câu", () => {
    expect(hasPlaceholder([member("a")])).toBe(false)
    expect(hasPlaceholder([{ ...member("a"), placeholder: true }])).toBe(true)
  })
})
