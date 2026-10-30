import { describe, expect, it } from "vitest"
import { formatSelection } from "./text-format"
import { fromDraft, orderingTokens, toDraft } from "@/components/exercise-detail/question-draft"
import { parsePassage, speechText } from "./passage"

describe("formatSelection", () => {
  it("toggles an outer style off through another style while keeping the latter", () => {
    const bold = formatSelection("word", 0, 4, "bold")
    const both = formatSelection(bold.text, bold.start, bold.end, "underline")
    expect(formatSelection(both.text, both.start, both.end, "bold")).toEqual({ text: "<u>word</u>", start: 3, end: 7 })
  })

  it("can toggle a multiline selection with leading and trailing newlines", () => {
    const marked = formatSelection("\none\ntwo\n", 0, 9, "underline")
    expect(marked.text).toBe("\n<u>one</u>\n<u>two</u>\n")
    expect(formatSelection(marked.text, marked.start, marked.end, "underline")).toEqual({ text: "\none\ntwo\n", start: 0, end: 9 })
  })

  it("treats a multiline formula as an indivisible range", () => {
    const marked = formatSelection("$x+\ny$", 1, 2, "bold")
    expect(marked).toEqual({ text: "**$x+\ny$**", start: 2, end: 8 })
  })

  it("balances formatting on each selected line so passage layouts can still render and read it", () => {
    const formatted = formatSelection("one\ntwo", 0, 7, "underline")
    expect(formatted).toEqual({ text: "<u>one</u>\n<u>two</u>", start: 3, end: 17 })
    expect(formatSelection(formatted.text, formatted.start, formatted.end, "underline").text).toBe("one\ntwo")
    const blocks = parsePassage(formatted.text, "doan-van")
    expect(blocks.map(speechText)).toEqual(["one", "two"])
    expect(blocks.every((block) => block.pieces.every((p) => p.underline))).toBe(true)
  })

  it("expands a selection inside a formula rather than inserting markup into LaTeX", () => {
    expect(formatSelection("A $x+1$ B", 4, 5, "bold")).toEqual({ text: "A **$x+1$** B", start: 4, end: 9 })
  })

  it("underlines the selected letters without replacing them", () => {
    expect(formatSelection("choose", 2, 4, "underline")).toEqual({ text: "ch<u>oo</u>se", start: 5, end: 7 })
  })

  describe("formatted ordering tokens", () => {
    it("does not mistake the slash in an underline closing marker for a token separator", () => {
      expect(orderingTokens("<u>I</u> / **like** / ==cats==")).toEqual(["<u>I</u>", "**like**", "==cats=="])
      const question = {
        id: "q", type: "sap-xep" as const, prompt: "Order the words.", points: 1, skills: [],
        tokens: ["<u>I</u>", "like", "cats"], shuffled: [2, 0, 1],
      }
      const saved = fromDraft(toDraft(question), "q", question)
      if (saved.type !== "sap-xep") throw new Error("Expected ordering question")
      expect(saved.tokens).toEqual(["<u>I</u>", "like", "cats"])
    })
  })

  it("toggles formatting off with the inner text still selected", () => {
    expect(formatSelection("ch<u>oo</u>se", 5, 7, "underline")).toEqual({ text: "choose", start: 2, end: 4 })
    expect(formatSelection("**word**", 0, 8, "bold")).toEqual({ text: "word", start: 0, end: 4 })
  })

  it("inserts an empty pair at the caret and keeps the caret inside it", () => {
    expect(formatSelection("ab", 1, 1, "highlight")).toEqual({ text: "a====b", start: 3, end: 3 })
  })

  it("can combine styles without losing the selection", () => {
    expect(formatSelection("**word**", 2, 6, "underline")).toEqual({ text: "**<u>word</u>**", start: 5, end: 9 })
  })
})
