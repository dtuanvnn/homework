import { describe, expect, it } from "vitest"
import { answerAsRichText, hasMath, hasFormatting, mathText, plainRichText, splitRichText } from "./rich-text"

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

  describe("inline emphasis", () => {
    it("keeps emphasis on exactly the printed letters, including inside a word", () => {
      expect(splitRichText("Chọn: ch<u>oo</u>se **word** ==here==.")).toEqual([
        { kind: "text", text: "Chọn: ch" },
        { kind: "text", text: "oo", underline: true },
        { kind: "text", text: "se " },
        { kind: "text", text: "word", bold: true },
        { kind: "text", text: " " },
        { kind: "text", text: "here", highlight: true },
        { kind: "text", text: "." },
      ])
      expect(hasFormatting("ch<u>oo</u>se")).toBe(true)
      expect(hasFormatting("___ $x$")).toBe(false)
    })

    it("combines nested styles and formats a whole formula without parsing its contents as markup", () => {
      expect(splitRichText("**<u>==a $x==y$==</u>**")).toEqual([
        { kind: "text", text: "a ", bold: true, underline: true, highlight: true },
        { kind: "math", tex: "x==y", bold: true, underline: true, highlight: true },
      ])
      expect(hasMath("**$x$**")).toBe(true)
    })

    it("leaves incomplete, empty, escaped and arbitrary HTML markers literal", () => {
      expect(plainRichText("**chưa đóng <u></u> == và ___")).toBe("**chưa đóng <u></u> == và ___")
      expect(splitRichText("\\**word\\** \\<u>word\\</u> \\==word\\==")).toEqual([
        { kind: "text", text: "**word** <u>word</u> ==word==" },
      ])
      expect(splitRichText('<u onclick="alert(1)">word</u>')).toEqual([
        { kind: "text", text: '<u onclick="alert(1)">word</u>' },
      ])
    })

    it("removes only formatting when producing plain text, retaining math and blanks", () => {
      expect(plainRichText("ch<u>oo</u>se **one** ==word== ___ $x+1$")).toBe("choose one word ___ $x+1$")
    })
  })
})
