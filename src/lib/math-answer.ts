/*
 * Math answers: a small LaTeX subset (what MathLive produces for primary
 * school, plus typed text like "3/4" or "0,75") evaluated to exact rationals,
 * so 6/8, 3/4 and 0,75 compare equal without rounding. Pure; used by grading
 * (math questions) and by the hint leak filter.
 */

export interface Rational {
  n: bigint
  d: bigint
}

const abs = (x: bigint) => (x < 0n ? -x : x)

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a)
  b = abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

function rational(n: bigint, d: bigint = 1n): Rational | null {
  if (d === 0n) return null
  if (d < 0n) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d)!
const sub = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d)!
const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d)!
const div = (a: Rational, b: Rational) => rational(a.n * b.d, a.d * b.n)

export const equalRational = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d

/** One canonical spelling: no spaces, `*` and `/` for the operators, `\frac` for fractions. */
export function normalizeMath(latex: string): string {
  return latex
    .replace(/\$/g, "")
    .replace(/\\[,;:! ]|~/g, "")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\[dt]frac/g, "\\frac")
    .replace(/\{,\}/g, ",")
    .replace(/\\times|\\cdot|[×·⋅*]/g, "*")
    .replace(/\\div|[÷:]/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, "")
}

class Parser {
  private i = 0
  constructor(private readonly s: string) {}

  parse(): Rational | null {
    const value = this.expr()
    return value && this.i === this.s.length ? value : null
  }

  private peek() {
    return this.s[this.i]
  }

  private expr(): Rational | null {
    let left = this.term()
    while (left && (this.peek() === "+" || this.peek() === "-")) {
      const op = this.s[this.i++]
      const right = this.term()
      if (!right) return null
      left = op === "+" ? add(left, right) : sub(left, right)
    }
    return left
  }

  private term(): Rational | null {
    let left = this.unary()
    while (left && (this.peek() === "*" || this.peek() === "/")) {
      const op = this.s[this.i++]
      const right = this.unary()
      if (!right) return null
      left = op === "*" ? mul(left, right) : div(left, right)
    }
    return left
  }

  private unary(): Rational | null {
    if (this.peek() === "-") {
      this.i++
      const v = this.unary()
      return v && { n: -v.n, d: v.d }
    }
    if (this.peek() === "+") {
      this.i++
      return this.unary()
    }
    return this.primary()
  }

  private primary(): Rational | null {
    const c = this.peek()
    if (c === "(") {
      this.i++
      const v = this.expr()
      if (!v || this.peek() !== ")") return null
      this.i++
      return v
    }
    if (c === "{") return this.group()
    if (this.s.startsWith("\\frac", this.i)) return this.frac()
    if (c !== undefined && /\d/.test(c)) {
      const num = this.number()
      if (!num) return null
      // Mixed number: 2\frac{1}{3} = 2 + 1/3.
      if (num.integer && this.s.startsWith("\\frac", this.i)) {
        const f = this.frac()
        return f && f.n >= 0n ? add(num.value, f) : null
      }
      return num.value
    }
    return null
  }

  private group(): Rational | null {
    const c = this.peek()
    if (c === "{") {
      this.i++
      const v = this.expr()
      if (!v || this.peek() !== "}") return null
      this.i++
      return v
    }
    // \frac12 shorthand: single digits.
    if (c !== undefined && /\d/.test(c)) {
      this.i++
      return rational(BigInt(c))
    }
    return null
  }

  private frac(): Rational | null {
    this.i += "\\frac".length
    const a = this.group()
    const b = a && this.group()
    return a && b ? div(a, b) : null
  }

  private number(): { value: Rational; integer: boolean } | null {
    const m = /^(\d+)(?:[.,](\d+))?/.exec(this.s.slice(this.i))
    if (!m) return null
    this.i += m[0].length
    const decimals = m[2] ?? ""
    const value = rational(BigInt(m[1] + decimals), 10n ** BigInt(decimals.length))
    return value && { value, integer: !m[2] }
  }
}

export function evaluateMath(latex: string): Rational | null {
  const s = normalizeMath(latex)
  return s ? new Parser(s).parse() : null
}

/** An integer, or one fraction (optionally negative or mixed) in lowest terms. */
export function isSimplestForm(latex: string): boolean {
  const s = normalizeMath(latex)
  if (/^-?\d+$/.test(s)) return true
  const frac = /^-?(\d+)?\\frac(?:\{(\d+)\}\{(\d+)\}|(\d)(\d))$/.exec(s)
  const slash = /^-?(\d+)\/(\d+)$/.exec(s)
  let whole: string | undefined
  let num: string
  let den: string
  if (frac) {
    whole = frac[1]
    num = frac[2] ?? frac[4]
    den = frac[3] ?? frac[5]
  } else if (slash) {
    num = slash[1]
    den = slash[2]
  } else {
    return false
  }
  const n = BigInt(num)
  const d = BigInt(den)
  if (d <= 1n || n === 0n || gcd(n, d) !== 1n) return false
  return whole === undefined || n < d
}

/** null when the key can't be evaluated (the caller then compares text). */
export function mathAnswerMatches(expected: string, given: string, opts: { simplest?: boolean } = {}): boolean | null {
  const want = evaluateMath(expected)
  if (!want) return null
  const got = evaluateMath(given)
  return Boolean(got && equalRational(got, want) && (!opts.simplest || isSimplestForm(given)))
}

/** Readable text for prompts and leak checks: \frac{1}{2} → 1/2, \times → ×. */
export function latexToPlain(text: string): string {
  let s = text.replace(/\$/g, "").replace(/\\[dt]frac/g, "\\frac")
  s = s.replace(/(\d)\\frac/g, "$1 \\frac")
  const frac = /\\frac\{([^{}]*)\}\{([^{}]*)\}/
  while (frac.test(s)) s = s.replace(frac, "$1/$2")
  s = s.replace(/\\frac(\d)(\d)/g, "$1/$2")
  return s
    .replace(/\{,\}/g, ",")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, ":")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\[,;:! ]|~/g, " ")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
}

/** Numbers and simple fractions in plain text, with their values. */
export function mathValuesIn(plain: string): { raw: string; value: Rational }[] {
  const out: { raw: string; value: Rational }[] = []
  for (const m of plain.matchAll(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/g)) {
    const value = evaluateMath(m[0])
    if (value) out.push({ raw: m[0].replace(/\s+/g, ""), value })
  }
  return out
}
