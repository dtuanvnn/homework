import { describe, expect, it } from "vitest"
import { answerAsRichText, hasMath, mathText, splitRichText } from "./rich-text"

describe("splitRichText", () => {
  it("returns plain text untouched", () => {
    expect(splitRichText("Mỗi tuần có 7 ngày.\nHỏi 6 tuần?")).toEqual([{ kind: "text", text: "Mỗi tuần có 7 ngày.\nHỏi 6 tuần?" }])
    expect(hasMath("7 × 8 = ?")).toBe(false)
  })

  it("splits formulas out of text", () => {
    expect(splitRichText("Tính $\\frac{1}{2}+\\frac{1}{4}$ nhé")).toEqual([
      { kind: "text", text: "Tính " },
      { kind: "math", tex: "\\frac{1}{2}+\\frac{1}{4}" },
      { kind: "text", text: " nhé" },
    ])
  })

  it("keeps escaped dollars literal", () => {
    expect(splitRichText("Giá 5\\$ và $x$")).toEqual([
      { kind: "text", text: "Giá 5$ và " },
      { kind: "math", tex: "x" },
    ])
  })

  it("leaves an unclosed or empty $ as text", () => {
    expect(splitRichText("Giá 5$ một cái")).toEqual([{ kind: "text", text: "Giá 5$ một cái" }])
    expect(splitRichText("a $$ b")).toEqual([{ kind: "text", text: "a $$ b" }])
  })

  it("wraps a LaTeX answer for display", () => {
    expect(mathText("\\frac{3}{4}")).toBe("$\\frac{3}{4}$")
  })
})

describe("answerAsRichText", () => {
  it("wraps answers of math questions only", () => {
    expect(answerAsRichText({ math: true }, "\\frac{3}{4}")).toBe("$\\frac{3}{4}$")
    expect(splitRichText(answerAsRichText({ math: true }, "3/4"))).toEqual([{ kind: "math", tex: "3/4" }])
    expect(answerAsRichText({}, "24 kg")).toBe("24 kg")
    expect(answerAsRichText({ math: false }, "3/4")).toBe("3/4")
  })
})
