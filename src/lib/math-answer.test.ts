import { describe, expect, it } from "vitest"
import { equalRational, evaluateMath, isSimplestForm, latexToPlain, mathAnswerMatches, mathValuesIn, normalizeMath } from "./math-answer"

const v = (latex: string) => {
  const r = evaluateMath(latex)
  return r ? `${r.n}/${r.d}` : null
}

describe("evaluateMath", () => {
  it("reads integers, decimals with comma or dot, and plain fractions", () => {
    expect(v("42")).toBe("42/1")
    expect(v("0,75")).toBe("3/4")
    expect(v("0.75")).toBe("3/4")
    expect(v("3/4")).toBe("3/4")
    expect(v("6/8")).toBe("3/4")
  })

  it("reads MathLive output", () => {
    expect(v("\\frac{6}{8}")).toBe("3/4")
    expect(v("\\dfrac{1}{2}")).toBe("1/2")
    expect(v("\\frac12")).toBe("1/2")
    expect(v("0{,}5")).toBe("1/2")
    expect(v("2\\frac{1}{3}")).toBe("7/3")
    expect(v("-2\\frac{1}{3}")).toBe("-7/3")
    expect(v("\\left(2+3\\right)\\times4")).toBe("20/1")
    expect(v("12\\div3")).toBe("4/1")
    expect(v("2\\cdot3")).toBe("6/1")
    expect(v("12 : 4")).toBe("3/1")
    expect(v("5 − 7")).toBe("-2/1")
    expect(v("$\\frac{1}{2}$")).toBe("1/2")
    expect(v("\\frac{\\frac{1}{2}}{3}")).toBe("1/6")
  })

  it("respects precedence and parentheses", () => {
    expect(v("2+3\\times4")).toBe("14/1")
    expect(v("(2+3)\\times4")).toBe("20/1")
    expect(v("\\frac{1}{2}+\\frac{1}{4}")).toBe("3/4")
  })

  it("rejects what it cannot read", () => {
    expect(v("")).toBeNull()
    expect(v("x+1")).toBeNull()
    expect(v("2(3)")).toBeNull()
    expect(v("1/0")).toBeNull()
    expect(v("\\frac{1}{0}")).toBeNull()
    expect(v("24 kg")).toBeNull()
    expect(v("(2+3")).toBeNull()
  })
})

describe("isSimplestForm", () => {
  it("accepts integers and fractions in lowest terms", () => {
    expect(isSimplestForm("5")).toBe(true)
    expect(isSimplestForm("\\frac{3}{4}")).toBe(true)
    expect(isSimplestForm("3/4")).toBe(true)
    expect(isSimplestForm("-\\frac{3}{4}")).toBe(true)
    expect(isSimplestForm("2\\frac{1}{3}")).toBe(true)
    expect(isSimplestForm("\\frac{7}{3}")).toBe(true)
  })
  it("rejects reducible fractions, denominators of 1, decimals, expressions and improper mixed numbers", () => {
    expect(isSimplestForm("\\frac{6}{8}")).toBe(false)
    expect(isSimplestForm("4/1")).toBe(false)
    expect(isSimplestForm("0,75")).toBe(false)
    expect(isSimplestForm("\\frac{1}{2}+\\frac{1}{4}")).toBe(false)
    expect(isSimplestForm("2\\frac{4}{3}")).toBe(false)
  })
})

describe("mathAnswerMatches", () => {
  it("accepts equal values", () => {
    expect(mathAnswerMatches("\\frac{3}{4}", "\\frac{6}{8}")).toBe(true)
    expect(mathAnswerMatches("\\frac{3}{4}", "0,75")).toBe(true)
    expect(mathAnswerMatches("5", "2+3")).toBe(true)
    expect(mathAnswerMatches("\\frac{3}{4}", "\\frac{2}{3}")).toBe(false)
    expect(mathAnswerMatches("\\frac{3}{4}", "")).toBe(false)
  })
  it("requires lowest terms when asked", () => {
    expect(mathAnswerMatches("\\frac{3}{4}", "\\frac{6}{8}", { simplest: true })).toBe(false)
    expect(mathAnswerMatches("\\frac{3}{4}", "\\frac{3}{4}", { simplest: true })).toBe(true)
  })
  it("returns null when the key itself can't be read", () => {
    expect(mathAnswerMatches("24 kg", "24 kg")).toBeNull()
  })
})

describe("latexToPlain and mathValuesIn", () => {
  it("turns LaTeX into readable text", () => {
    expect(latexToPlain("Tính $\\frac{1}{2} + \\frac{1}{4}$")).toBe("Tính 1/2 + 1/4")
    expect(latexToPlain("$2\\frac{1}{3}$")).toBe("2 1/3")
    expect(latexToPlain("$3 \\times 4 \\div 2$")).toBe("3 × 4 : 2")
    expect(latexToPlain("$0{,}5$")).toBe("0,5")
  })
  it("finds numbers and fractions with their values", () => {
    const found = mathValuesIn("Em thử 6/8 hoặc 0,75 và 12")
    expect(found.map((f) => f.raw)).toEqual(["6/8", "0,75", "12"])
    expect(equalRational(found[0].value, found[1].value)).toBe(true)
  })
  it("normalizes spacing and operators", () => {
    expect(normalizeMath("\\left( 1 \\, + 2 \\right) \\cdot 3")).toBe("(1+2)*3")
  })
})
