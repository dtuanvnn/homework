import { describe, expect, it } from "vitest"
import { parsePassage, readable, speechText, type PassageBlock } from "./passage"

const texts = (b: PassageBlock) => b.pieces.map((p) => (p.kind === "text" ? p.text : "___")).join("")
const blanks = (b: PassageBlock) => b.pieces.flatMap((p) => (p.kind === "blank" ? [p.index] : []))

const RAT =
  "**Read the text, then answer the questions in FULL sentences.**\n# A Giant Rat\nRats and mice are well-known rodents.\n\nLike most rodents, the capybara's front teeth never stop growing.\nThe capybara lives near fresh water."

describe("parsePassage", () => {
  it("parses the A Giant Rat passage", () => {
    const blocks = parsePassage(RAT, "doan-van")
    expect(blocks.map((b) => b.kind)).toEqual(["instruction", "title", "paragraph", "paragraph", "paragraph"])
    expect(texts(blocks[0])).toBe("Read the text, then answer the questions in FULL sentences.")
    expect(texts(blocks[1])).toBe("A Giant Rat")
  })

  it("parses dialogue turns", () => {
    const blocks = parsePassage("Mai: Hi, Tom.\nTom: I went to the zoo.\nThey walk home.", "hoi-thoai")
    expect(blocks.map((b) => [b.kind, b.speaker])).toEqual([
      ["turn", "Mai"],
      ["turn", "Tom"],
      ["paragraph", undefined],
    ])
    expect(texts(blocks[0])).toBe("Hi, Tom.")
  })

  it("does not take LaTeX or long prefixes as speakers", () => {
    expect(parsePassage("$a:b$ là tỉ số", "hoi-thoai")[0].kind).toBe("paragraph")
    expect(parsePassage(`${"x".repeat(31)}: hello`, "hoi-thoai")[0].kind).toBe("paragraph")
    expect(parsePassage("Mai: hi", "doan-van")[0].kind).toBe("paragraph")
  })

  it("bold inside a line", () => {
    expect(parsePassage("The **capybara** swims.", "doan-van")[0].pieces).toEqual([
      { kind: "text", text: "The " },
      { kind: "text", text: "capybara", bold: true },
      { kind: "text", text: " swims." },
    ])
  })

  it("leaves an unpaired ** as text", () => {
    expect(texts(parsePassage("2 ** 3", "doan-van")[0])).toBe("2 ** 3")
  })

  it("keeps blank numbers global", () => {
    const blocks = parsePassage("One ___ two.\nThree ___ and ___.", "doan-van")
    expect(blocks.map(blanks)).toEqual([[1], [2, 3]])
  })
})

describe("speech", () => {
  it("speechText drops math, pauses at blanks and names the speaker", () => {
    const [p] = parsePassage("Half is $\frac{1}{2}$ of ___ cake.", "doan-van")
    expect(speechText(p)).not.toContain("frac")
    expect(speechText(p)).not.toContain("___")
    expect(speechText(p)).toContain(", ")
    expect(speechText(parsePassage("Mai: Hi, Tom.", "hoi-thoai")[0])).toBe("Mai. Hi, Tom.")
    expect(speechText(parsePassage("The **big** rat.", "doan-van")[0])).toBe("The big rat.")
  })

  it("does not read instructions", () => {
    const blocks = parsePassage(RAT, "doan-van")
    expect(blocks.map(readable)).toEqual([false, true, true, true, true])
  })
})
