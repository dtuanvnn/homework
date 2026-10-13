import { describe, expect, it } from "vitest"
import { hasMath, mathText, splitRichText } from "./rich-text"

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
