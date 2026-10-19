import { describe, expect, it } from "vitest"
import { newInk } from "./ink"
import { canWrite, hasInk, studyKey } from "./flashcard-study"

const strip = newInk("o-li", "strip")
const written = { text: "", ink: { ...strip, pages: [{ strokes: [[10, 10, 5, 20, 20, 5]] }] } }

describe("canWrite", () => {
  const ids = ["a", "b"]

  it("opens the writing phase once every card is studied", () => {
    expect(canWrite(ids, new Set(), {})).toBe(false)
    expect(canWrite(ids, new Set(["a"]), {})).toBe(false)
    expect(canWrite(ids, new Set(["a", "b"]), {})).toBe(true)
  })

  it("stays open when the attempt already has handwriting (resuming on another device)", () => {
    expect(canWrite(ids, new Set(), { b: written })).toBe(true)
    expect(canWrite(ids, new Set(), { b: { text: "", ink: strip } })).toBe(false)
  })
})

describe("hasInk", () => {
  it("is true only for a response with strokes", () => {
    expect(hasInk(undefined)).toBe(false)
    expect(hasInk({ text: "" })).toBe(false)
    expect(hasInk({ text: "", ink: strip })).toBe(false)
    expect(hasInk(written)).toBe(true)
  })
})

describe("studyKey", () => {
  it("is per child, assignment and attempt", () => {
    expect(studyKey("s1", "a1", 2)).toBe("hh-fc-study:s1:a1:2")
  })
})
