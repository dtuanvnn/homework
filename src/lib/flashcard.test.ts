import { describe, expect, it } from "vitest"
import { MAX_WORDS, checkSetFormat, isFlashcardSet, isValidWord, parseWordList } from "./flashcard"

describe("parseWordList", () => {
  it("trims, drops blank lines and case-insensitive duplicates, splits on slashes", () => {
    expect(parseWordList("habitat\n\n  Desert \ndesert / nest / polar bear\r\n")).toEqual({
      words: ["habitat", "Desert", "nest", "polar bear"],
      duplicateCount: 1,
      overflow: 0,
    })
  })

  it("caps the list and counts what was left out", () => {
    const text = Array.from({ length: MAX_WORDS + 5 }, (_, i) => `word${"abcdefghijklmnopqrstuvwxyz"[i % 26]}${"xyz"[Math.floor(i / 26)]}`).join("\n")
    const parsed = parseWordList(text)
    expect(parsed.words).toHaveLength(MAX_WORDS)
    expect(parsed.overflow).toBe(5)
  })

  it("collapses inner spaces", () => {
    expect(parseWordList("polar    bear").words).toEqual(["polar bear"])
  })
})

describe("isValidWord", () => {
  it("accepts letters, spaces, hyphens and apostrophes", () => {
    expect(isValidWord("polar bear")).toBe(true)
    expect(isValidWord("o'clock")).toBe(true)
    expect(isValidWord("ice-cream")).toBe(true)
  })

  it("rejects digits, empty and overlong words", () => {
    expect(isValidWord("a1")).toBe(false)
    expect(isValidWord(" ")).toBe(false)
    expect(isValidWord("x".repeat(61))).toBe(false)
  })
})

describe("isFlashcardSet", () => {
  it("needs at least one question, all tu-vung", () => {
    expect(isFlashcardSet([])).toBe(false)
    expect(isFlashcardSet([{ type: "tu-vung" }, { type: "tu-vung" }])).toBe(true)
    expect(isFlashcardSet([{ type: "tu-vung" }, { type: "tu-luan" }])).toBe(false)
  })
})

describe("checkSetFormat", () => {
  const words = (n: number) => Array.from({ length: n }, () => ({ type: "tu-vung" }))

  it("accepts a valid flashcard set and a normal set", () => {
    expect(checkSetFormat({ format: "flashcard", subject: "tieng-anh" }, words(12))).toBeNull()
    expect(checkSetFormat({ format: "cau-hoi", subject: "toan" }, [{ type: "trac-nghiem" }])).toBeNull()
  })

  it("refuses mixed or misplaced question types", () => {
    expect(checkSetFormat({ format: "flashcard", subject: "tieng-anh" }, [...words(2), { type: "trac-nghiem" }])).toMatch(/chỉ gồm từ vựng/)
    expect(checkSetFormat({ format: "cau-hoi", subject: "tieng-anh" }, words(1))).toMatch(/Flashcard/)
  })

  it("refuses other subjects and too many words", () => {
    expect(checkSetFormat({ format: "flashcard", subject: "toan" }, words(3))).toMatch(/Tiếng Anh/)
    expect(checkSetFormat({ format: "flashcard", subject: "tieng-anh" }, words(MAX_WORDS + 1))).toMatch(/40/)
  })
})
