# Math Formulas and Scanned Figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render math (`$…$` LaTeX) everywhere questions appear, let the child answer math questions with a MathLive keyboard graded by value, and carry figures from scanned pages into questions as cropped images.

**Architecture:** Pure, tested logic in `src/lib/` (`math-answer.ts`, `rich-text.ts`, `figures.ts`, `figure-crop.ts`); questions gain optional `image`, `math`, `simplest` fields inside the existing `questions.content` jsonb; the server signs image URLs on read and removes unused figure objects on save; the browser crops figures from page images using AI-returned boxes and uploads them with the existing signed-URL flow.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, zod 4, Drizzle + node-postgres, Supabase Storage, Vitest, Playwright (WebKit). New deps: `katex`, `mathlive`, `react-image-crop`.

**Spec:** `docs/superpowers/specs/2026-10-13-math-and-figures-design.md`

## Global Constraints

- All UI text is Vietnamese; keep the existing visual language (Tailwind classes, rounded-xl/2xl cards, indigo/emerald/amber accents).
- File bodies never go through Server Actions; uploads use `requestSetUploads` (→ `createUploadTargets`) + `uploadFiles`.
- The browser only ever sees signed URLs (1 hour, `SIGNED_URL_SECONDS`).
- Test files can't import modules that import `"server-only"`; testable logic lives in `src/lib/`.
- Every Server Action calls `assertAccess(...)` first and returns `ActionResult` via `runAction()`.
- Formulas: LaTeX between `$…$` in text fields; `\$` is a literal dollar; text without `$` renders exactly as before.
- Math answer keys (`math: true`) are stored as LaTeX **without** surrounding `$`.
- Figure objects are uploaded with the name `figure.jpg`, so their paths are `sets/{setId}/{uuid}-figure.jpg`.
- Boxes are `[x0, y0, x1, y1]` in 0–1000 of the page's width/height.
- `imageUrl` is read-side only and is never written to the database (zod strips it).
- Verification before each commit: `pnpm typecheck && pnpm lint && pnpm test` (lint has 21 pre-existing warnings, 0 errors).

## Review Focus

1. **Old responses on newly-math questions:** a plain string like `3/4` or `0,75` (typed before MathLive existed, or by the plain fallback) must still grade by value. → Task 1 tests `evaluateMath("3/4")`, `"0,75"`; Task 2 test "accepts any answer with the same value" includes `"3/4"`.
2. **Literal and unclosed dollars:** "Giá 5$ một cái" must not swallow the rest of the prompt; text without `$` must come back unchanged. → Task 3 tests "leaves an unclosed or empty $ as text" and "returns plain text untouched".
3. **Duplicated sets and answer snapshots share figure objects:** saving or deleting one copy must not delete a figure another question, snapshot or attachment still uses. → Task 2 test for `unusedFigures`; Task 4 reference query covers questions, answers and attachments; Task 9 manual check.
4. **MathLive output variants:** `{,}` decimal comma, `\dfrac`, `\frac12`, `\left(`…`\right)`, `\cdot`, `\div`, mixed numbers, negatives. → Task 1 test "reads MathLive output".
5. **Hints leaking a math answer in another form** (key `\frac{3}{4}`, hint says "3/4", "6/8" or "0,75"). → Task 6 tests.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/math-answer.ts` (+ test) | create | Exact-rational evaluator for a LaTeX subset, simplest-form check, LaTeX→plain text, value extraction |
| `src/lib/rich-text.ts` (+ test) | create | Split text into text / `$…$` math segments |
| `src/lib/figures.ts` (+ test) | create | Figure path rules (`FIGURE_FILE_NAME`, `isFigurePath`, `figureOwner`, `unusedFigures`) |
| `src/lib/figure-crop.ts` (+ test) | create | `Box`, `repairBox`, `cropRect`, percent↔box, `sameBox`, `FULL_PAGE` |
| `src/lib/figure-client.ts` | create | Browser: crop a page image to JPEG and upload it (`cropFigure`, `makeFigure`) |
| `src/lib/types.ts` | modify | `QuestionImage`; `image`/`imageUrl` on all questions; `math`/`simplest` on fill-blank and short-answer |
| `src/lib/question-schema.ts` (+ new test) | modify | Validate `image`, `math`, `simplest` |
| `src/lib/grading.ts` (+ test) | modify | Grade `math` questions by value |
| `src/components/question/RichText.tsx`, `QuestionPicture.tsx` | create | KaTeX rendering; figure `<img>` |
| `src/components/take/MathAnswerInput.tsx`, `MathField.tsx`, `PlainMathInput.tsx`, `src/types/mathlive.d.ts`, `public/mathlive/fonts/` | create | Lazy MathLive input with a primary-school keyboard; text fallback |
| Question renderers | modify | `QuestionContent`, `TakeAssignment`, `take/questions.tsx`, `ResultDetail`, `GradeAttempt`, `AiAssist`, `PrintableExercise` use `RichText` + `QuestionPicture` |
| `src/server/storage.ts`, `src/server/question-images.ts` (new), `src/server/queries.ts`, `src/server/actions/library.ts`, `src/app/(app)/student/assignments/[id]/do/page.tsx` | modify | Signed figure URLs on read; upload checks and cleanup on save/delete |
| `src/lib/ai/hints.ts` (+ test), `src/server/actions/ai-hints.ts`, `ai-grading.ts` | modify | LaTeX-aware leak filter; figures sent to AI |
| `src/lib/ai/question-format.ts`, `scan.ts`, `generate.ts` (+ tests) | modify | `figure`/`math`/`simplest` in AI output; repairs; prompt rules |
| `src/components/upload/review-utils.ts`, `FigureCropDialog.tsx` (new), `ExtractedQuestionCard.tsx`, `ReviewStep.tsx`, `src/components/pages/UploadFlow.tsx` | modify | Auto-crop after scan; adjust/remove/add figures; draft restore |
| `src/components/exercise-detail/question-draft.ts` (+ new test), `FormulaPreview.tsx` (new), `FigureField.tsx` (new), `QuestionEditorSheet.tsx`, `QuestionTypeFields.tsx`; `src/components/pages/ExerciseSetDetail.tsx`, `AIGenerate.tsx` | modify | Formula bar/previews, Toán switch, picture section |
| `src/db/seed-data.ts`, `src/db/seed.ts`, `e2e/math-figures.spec.ts` (new) | modify | Seed + end-to-end coverage |
| `CLAUDE.md` | modify | Document the new rules |

Note: PDFs are already expanded into one image per page when picked (`src/components/upload/UploadStep.tsx:46`), so every scan page is an image and the spec's "PDF page previews in SourceViewer" item needs no work.

---

### Task 1: Math evaluator (`math-answer.ts`)

**Files:**
- Create: `src/lib/math-answer.ts`
- Test: `src/lib/math-answer.test.ts`

**Interfaces:**
- Produces:
  - `interface Rational { n: bigint; d: bigint }` (reduced, `d > 0n`)
  - `normalizeMath(latex: string): string`
  - `evaluateMath(latex: string): Rational | null`
  - `equalRational(a: Rational, b: Rational): boolean`
  - `isSimplestForm(latex: string): boolean`
  - `mathAnswerMatches(expected: string, given: string, opts?: { simplest?: boolean }): boolean | null` — `null` means the key doesn't evaluate; the caller falls back to text comparison
  - `latexToPlain(text: string): string`
  - `mathValuesIn(plain: string): { raw: string; value: Rational }[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/math-answer.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/math-answer.test.ts`
Expected: FAIL — `Failed to resolve import "./math-answer"`.

- [ ] **Step 3: Implement**

```ts
// src/lib/math-answer.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/math-answer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/math-answer.ts src/lib/math-answer.test.ts
git commit -m "Add exact math answer evaluator"
```

---

### Task 2: Question fields, schema and math grading

**Files:**
- Modify: `src/lib/types.ts` (Questions section, ~lines 87–137)
- Create: `src/lib/figures.ts`, `src/lib/figures.test.ts`
- Modify: `src/lib/question-schema.ts`
- Create: `src/lib/question-schema.test.ts`
- Modify: `src/lib/grading.ts` (tra-loi-ngan / dien-cho-trong cases), `src/lib/grading.test.ts`

**Interfaces:**
- Consumes: `mathAnswerMatches` (Task 1).
- Produces:
  - `interface QuestionImage { path: string; width: number; height: number }` in `types.ts`
  - `QuestionBase.image?: QuestionImage`, `QuestionBase.imageUrl?: string`
  - `math?: boolean`, `simplest?: boolean` on `FillBlankQuestion` and `ShortAnswerQuestion`
  - `FIGURE_FILE_NAME = "figure.jpg"`, `isFigurePath(path: string): boolean`, `figureOwner(path: string): string | null`, `unusedFigures(listed: string[], referenced: Iterable<string>): string[]` in `figures.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/figures.test.ts
import { describe, expect, it } from "vitest"
import { figureOwner, isFigurePath, unusedFigures } from "./figures"

const SET = "11111111-2222-3333-4444-555555555555"
const FIG = `sets/${SET}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg`

describe("figures", () => {
  it("recognizes figure objects and their owner set", () => {
    expect(isFigurePath(FIG)).toBe(true)
    expect(figureOwner(FIG)).toBe(SET)
    expect(isFigurePath(`sets/${SET}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-trang-1.jpg`)).toBe(false)
    expect(isFigurePath(`attempts/${SET}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg`)).toBe(false)
    expect(isFigurePath(`sets/${SET}/../x-figure.jpg`)).toBe(false)
  })

  it("keeps referenced figures and ignores other files", () => {
    const other = `sets/${SET}/aaaaaaaa-bbbb-cccc-dddd-ffffffffffff-figure.jpg`
    const page = `sets/${SET}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-trang-1.jpg`
    expect(unusedFigures([FIG, other, page], [FIG])).toEqual([other])
  })
})
```

```ts
// src/lib/question-schema.test.ts
import { describe, expect, it } from "vitest"
import { editedQuestionSchema, questionContentSchema } from "./question-schema"

const FIG = "sets/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg"

describe("question schema", () => {
  it("keeps a figure and math flags", () => {
    const parsed = questionContentSchema.parse({
      type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", points: 1, skills: [],
      answer: "\\frac{3}{4}", math: true, simplest: true, image: { path: FIG, width: 400, height: 300 },
    })
    expect(parsed).toMatchObject({ math: true, simplest: true, image: { path: FIG } })
  })

  it("rejects image paths outside a set's figure objects", () => {
    const ok = (path: string) =>
      questionContentSchema.safeParse({ type: "dung-sai", prompt: "?", points: 1, skills: [], answer: true, image: { path, width: 1, height: 1 } }).success
    expect(ok(FIG)).toBe(true)
    expect(ok("attempts/x/y-figure.jpg")).toBe(false)
    expect(ok("https://evil.example/x.jpg")).toBe(false)
  })

  it("strips the read-side imageUrl", () => {
    const parsed = editedQuestionSchema.parse({
      id: "q1", type: "dung-sai", prompt: "?", points: 1, skills: [], answer: true,
      image: { path: FIG, width: 10, height: 10 }, imageUrl: "https://signed.example/x",
    })
    expect(parsed).not.toHaveProperty("imageUrl")
    expect(parsed).toHaveProperty("image")
  })
})
```

Add to `src/lib/grading.test.ts` (import `Question` from `./types` if not already imported):

```ts
describe("math questions", () => {
  const sa = (patch: Partial<Extract<Question, { type: "tra-loi-ngan" }>> = {}): Question => ({
    id: "m1", type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", points: 1, skills: [], answer: "\\frac{3}{4}", math: true, ...patch,
  })

  it("accepts any answer with the same value", () => {
    expect(gradeQuestion(sa(), "\\frac{6}{8}").isCorrect).toBe(true)
    expect(gradeQuestion(sa(), "0,75").isCorrect).toBe(true)
    expect(gradeQuestion(sa(), "3/4").isCorrect).toBe(true)
    expect(gradeQuestion(sa(), "\\frac{2}{3}").isCorrect).toBe(false)
  })

  it("requires lowest terms when simplest is set", () => {
    expect(gradeQuestion(sa({ simplest: true }), "\\frac{6}{8}").isCorrect).toBe(false)
    expect(gradeQuestion(sa({ simplest: true }), "\\frac{3}{4}").isCorrect).toBe(true)
  })

  it("falls back to text comparison when the key can't be evaluated", () => {
    expect(gradeQuestion(sa({ answer: "ba phần tư" }), "Ba phần tư").isCorrect).toBe(true)
  })

  it("grades math blanks by value", () => {
    const q: Question = { id: "m2", type: "dien-cho-trong", prompt: "$\\frac{1}{2}$ = ___ ; 1 = ___", points: 2, skills: [], answers: ["\\frac{2}{4}", "\\frac{4}{4}"], math: true }
    expect(gradeQuestion(q, ["\\frac{1}{2}", "1"])).toEqual({ isCorrect: true, pointsAwarded: 2 })
    expect(gradeQuestion(q, ["\\frac{1}{3}", "1"])).toEqual({ isCorrect: false, pointsAwarded: 1 })
  })

  it("leaves non-math questions unchanged", () => {
    expect(gradeQuestion(sa({ math: undefined, answer: "3/4" }), "6/8").isCorrect).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/figures.test.ts src/lib/question-schema.test.ts src/lib/grading.test.ts`
Expected: FAIL — missing `./figures`; schema strips `math`/`image` (first test fails) and accepts any path; math grading tests fail; typecheck errors on `math`/`image` fields are expected until Step 3.

- [ ] **Step 3: Implement**

`src/lib/figures.ts`:

```ts
/*
 * Question figures are JPEGs cut out of scanned pages (or picked in the
 * editor), uploaded under the set's Storage folder as `figure.jpg`, so their
 * paths are `sets/{setId}/{uuid}-figure.jpg`. Duplicated sets and answer
 * snapshots can point at another set's figure, so cleanup only removes
 * figures nothing references.
 */

export const FIGURE_FILE_NAME = "figure.jpg"

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const FIGURE_PATH = new RegExp(`^sets/(${UUID})/${UUID}-figure\\.jpg$`, "i")

export const isFigurePath = (path: string) => FIGURE_PATH.test(path)
export const figureOwner = (path: string) => FIGURE_PATH.exec(path)?.[1] ?? null

/** Figure objects among `listed` that nothing in `referenced` points to. */
export function unusedFigures(listed: string[], referenced: Iterable<string>): string[] {
  const used = new Set(referenced)
  return listed.filter((p) => isFigurePath(p) && !used.has(p))
}
```

`src/lib/types.ts` — replace `interface QuestionBase { … }` and the fill-blank / short-answer interfaces with:

```ts
/** A figure cut out of a scanned page (or picked in the editor); `path` is a Storage object. */
export interface QuestionImage {
  path: string
  width: number
  height: number
}

interface QuestionBase {
  id: string
  /** May contain LaTeX between $…$ (see lib/rich-text.ts). */
  prompt: string
  points: number
  skills: string[]
  image?: QuestionImage
  /** Read side only: signed URL of `image`, added when loading. Never stored. */
  imageUrl?: string
}

/** With `math`, answers are LaTeX (no $) graded by value; `simplest` also requires lowest terms. */
interface MathAnswer {
  math?: boolean
  simplest?: boolean
}

/** Blanks are written as "___" inside the prompt, one answer per blank. */
export interface FillBlankQuestion extends QuestionBase, MathAnswer {
  type: "dien-cho-trong"
  answers: string[]
}

export interface ShortAnswerQuestion extends QuestionBase, MathAnswer {
  type: "tra-loi-ngan"
  answer: string
}
```

`src/lib/question-schema.ts` — replace the imports and `base`, and the two member objects:

```ts
import { z } from "zod"
import { isFigurePath } from "./figures"
import type { QuestionContent } from "./types"

const imageSchema = z.object({
  path: z.string().refine(isFigurePath, "Hình minh họa không hợp lệ"),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
})

const base = {
  prompt: z.string().trim().min(1, "Câu hỏi cần có nội dung"),
  points: z.number().positive().max(100),
  skills: z.array(z.string().trim().min(1)).max(10),
  image: imageSchema.optional(),
}

const mathFlags = { math: z.boolean().optional(), simplest: z.boolean().optional() }
```

```ts
  z.object({ ...base, ...mathFlags, type: z.literal("dien-cho-trong"), answers: z.array(z.string()).min(1) }),
  z.object({ ...base, ...mathFlags, type: z.literal("tra-loi-ngan"), answer: z.string().trim().min(1) }),
```

`src/lib/grading.ts` — add the import and helper, and change the two cases:

```ts
import { mathAnswerMatches } from "./math-answer"
```

```ts
/** Math answers compare by value; a key that can't be evaluated falls back to `text`. */
function answerMatches(q: { math?: boolean; simplest?: boolean }, expected: string, given: string, text: (e: string, g: string) => boolean): boolean {
  if (!q.math) return text(expected, given)
  return mathAnswerMatches(expected, given, { simplest: q.simplest }) ?? text(expected, given)
}

const sameText = (expected: string, given: string) => normalizeText(given) === normalizeText(expected)
```

```ts
    case "tra-loi-ngan":
      return typeof response === "string" && response.trim()
        ? allOrNothing(q.points, answerMatches(q, q.answer, response, shortAnswerMatches))
        : WRONG
    case "dien-cho-trong": {
      if (!Array.isArray(response)) return WRONG
      const given = response as string[]
      const correct = q.answers.filter((a, i) => typeof given[i] === "string" && given[i].trim() !== "" && answerMatches(q, a, given[i], sameText)).length
      return proportional(q.points, correct, q.answers.length)
    }
```

Note: the old blank check compared `normalizeText(given[i]) === normalizeText(a)`, which already failed for empty strings unless the key was empty; keys are never empty after validation, so the added `trim() !== ""` guard doesn't change existing results.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test && pnpm typecheck`
Expected: all tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/figures.ts src/lib/figures.test.ts src/lib/types.ts src/lib/question-schema.ts src/lib/question-schema.test.ts src/lib/grading.ts src/lib/grading.test.ts
git commit -m "Add question figures and math answers to the question model"
```

---

### Task 3: Rendering formulas and figures (`RichText`, `QuestionPicture`)

**Files:**
- Create: `src/lib/rich-text.ts`, `src/lib/rich-text.test.ts`
- Create: `src/components/question/RichText.tsx`, `src/components/question/QuestionPicture.tsx`
- Modify: `src/app/layout.tsx` (KaTeX CSS)
- Modify: `src/components/exercise-detail/QuestionContent.tsx`, `src/components/take/TakeAssignment.tsx` (~lines 300–312), `src/components/take/questions.tsx`, `src/components/results/ResultDetail.tsx` (~218–231), `src/components/grading/GradeAttempt.tsx` (~213, ~229), `src/components/grading/AiAssist.tsx` (~69), `src/components/schedule/PrintableExercise.tsx` (~36–71)
- Dependencies: `katex`, `@types/katex` (dev)

**Interfaces:**
- Produces:
  - `type RichSegment = { kind: "text"; text: string } | { kind: "math"; tex: string }`
  - `splitRichText(input: string): RichSegment[]`, `hasMath(input: string): boolean`, `mathText(latex: string): string`
  - `<RichText text={string} className?={string} />` (default export)
  - `<QuestionPicture question={{ image?: QuestionImage; imageUrl?: string }} className?={string} />` (default export)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/rich-text.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/rich-text.test.ts`
Expected: FAIL — cannot resolve `./rich-text`.

- [ ] **Step 3: Implement the splitter**

```ts
// src/lib/rich-text.ts
/*
 * Question text may contain LaTeX between $…$ (fractions, expressions).
 * `\$` is a literal dollar; an unclosed or empty `$` stays literal, so plain
 * text renders exactly as before. Rendering is components/question/RichText.
 */

export type RichSegment = { kind: "text"; text: string } | { kind: "math"; tex: string }

/** Index of the next unescaped "$" from `start`, or -1. */
function closingDollar(input: string, start: number): number {
  for (let j = start; j < input.length; j++) {
    if (input[j] === "\\") j++
    else if (input[j] === "$") return j
  }
  return -1
}

export function splitRichText(input: string): RichSegment[] {
  const out: RichSegment[] = []
  let text = ""
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (c === "\\" && input[i + 1] === "$") {
      text += "$"
      i += 2
      continue
    }
    if (c === "$") {
      const end = closingDollar(input, i + 1)
      if (end > i + 1) {
        if (text) out.push({ kind: "text", text })
        text = ""
        out.push({ kind: "math", tex: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
      if (end === i + 1) {
        text += "$$"
        i += 2
        continue
      }
    }
    text += c
    i++
  }
  if (text) out.push({ kind: "text", text })
  return out
}

export const hasMath = (input: string) => splitRichText(input).some((s) => s.kind === "math")

/** A LaTeX answer key as displayable rich text. */
export const mathText = (latex: string) => `$${latex}$`
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/rich-text.test.ts`
Expected: PASS.

- [ ] **Step 5: Install KaTeX and add the components**

Run: `pnpm add katex && pnpm add -D @types/katex`

```tsx
// src/components/question/RichText.tsx
import { Fragment, useMemo } from 'react'
import katex from 'katex'
import { splitRichText } from '@/lib/rich-text'

/**
 * Question text with $…$ formulas rendered by KaTeX. KaTeX's default
 * `trust: false` keeps untrusted LaTeX from producing links or raw HTML, so
 * its markup is safe to inject. A formula that fails to parse shows its source.
 */
function Formula({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: true, output: 'htmlAndMathml', strict: 'ignore' })
    } catch {
      return null
    }
  }, [tex])
  if (html === null) return <span className="text-slate-400">{`$${tex}$`}</span>
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitRichText(text), [text])
  return (
    <span className={className}>
      {segments.map((s, i) => (s.kind === 'text' ? <Fragment key={i}>{s.text}</Fragment> : <Formula key={i} tex={s.tex} />))}
    </span>
  )
}
```

```tsx
// src/components/question/QuestionPicture.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { QuestionImage } from '@/lib/types'

/**
 * A question's figure. Width/height reserve space while it loads; an expired
 * signed URL (a page left open past an hour) triggers one refresh.
 */
export default function QuestionPicture({ question, className }: { question: { image?: QuestionImage; imageUrl?: string }; className?: string }) {
  const router = useRouter()
  const [retried, setRetried] = useState(false)
  if (!question.image) return null
  const { width, height } = question.image
  if (!question.imageUrl) {
    return (
      <div
        aria-label="Đang tải hình"
        className={cn('max-h-80 w-full max-w-md animate-pulse rounded-xl border border-slate-200 bg-slate-100', className)}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    )
  }
  return (
    <img
      src={question.imageUrl}
      alt="Hình minh họa"
      width={width}
      height={height}
      draggable={false}
      className={cn('h-auto max-h-80 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain', className)}
      onError={() => {
        if (retried) return
        setRetried(true)
        router.refresh()
      }}
    />
  )
}
```

In `src/app/layout.tsx`, add next to the existing global CSS import:

```ts
import 'katex/dist/katex.min.css'
```

- [ ] **Step 6: Use them in every question renderer**

`src/components/exercise-detail/QuestionContent.tsx`:

```tsx
import RichText from '@/components/question/RichText'
import QuestionPicture from '@/components/question/QuestionPicture'
import { mathText } from '@/lib/rich-text'

function Prompt({ text }: { text: string }) {
  return (
    <p className="text-base leading-relaxed font-medium break-words whitespace-pre-line text-slate-900">
      <RichText text={text} />
    </p>
  )
}

export default function QuestionContent({ question: q }: { question: Question }) {
  return (
    <div className="flex flex-col gap-3">
      <QuestionBody question={q} />
      <QuestionPicture question={q} />
    </div>
  )
}
```

- Rename the existing `switch` component to `function QuestionBody({ question: q }: { question: Question })`.
- Replace every `<Prompt>{q.prompt}</Prompt>` with `<Prompt text={q.prompt} />`.
- Render each option (`{opt}`), pair side (`{pair.left}`, `{pair.right}`), token (`{q.tokens[idx]}`), the ordering answer and each rubric line (`{r}`) as `<RichText text={…} />`.
- Short answer key:

```tsx
          <AnswerBox>
            <span className="font-bold">
              <RichText text={q.math ? mathText(q.answer) : q.answer} />
            </span>
          </AnswerBox>
```

- Fill-blank: keep the `<p>` wrapper of the old `Prompt` (same classes), render each `part` as `<RichText text={part} />`, and the blank chip content as `q.answers[i] ? <RichText text={q.math ? mathText(q.answers[i]) : q.answers[i]} /> : '…'`.

`src/components/take/TakeAssignment.tsx` (~300–312): replace `{q.prompt}` in both the long-prompt block and the `<h2>` with `<RichText text={q.prompt} />`, and render `<QuestionPicture question={q} className="mx-auto max-h-96" />` directly after the prompt block, before the answer component.

`src/components/take/questions.tsx`:
- `MultipleChoice`: `{o}` → `<RichText text={o} />`.
- `FillBlank`: each `{p}` → `<RichText text={p} />` (inputs change in Task 5).
- Matching and ordering: wherever a pair side or a token string is rendered, wrap it in `<RichText text={…} />`.

`src/components/results/ResultDetail.tsx` (~218–231): prompt → `<RichText text={…} />`, then `<QuestionPicture question={…question} />`; hint text → `<RichText text={hint} />`; the child's answer and the correct answer strings → `<RichText text={…} />` so LaTeX responses render.

`src/components/grading/GradeAttempt.tsx` (~213, ~229): prompt and child's answer → `<RichText text={…} />`; `<QuestionPicture question={…} />` under the prompt.

`src/components/grading/AiAssist.tsx` (~69): rendered question/answer text → `<RichText text={…} />`.

`src/components/schedule/PrintableExercise.tsx` (~36–71): prompt and options → `<RichText text={…} />`; `<QuestionPicture question={q} className="max-h-64" />` under each prompt.

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: typecheck clean, lint 0 errors, tests PASS, build succeeds.

Manual: `pnpm dev`; as parent edit a seeded question's prompt to `Tính $\frac{1}{2}+\frac{1}{4}$` and save: the formula renders in the set detail, the student take screen and the print preview. Other sets look unchanged.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/rich-text.ts src/lib/rich-text.test.ts src/components/question src/app/layout.tsx src/components/exercise-detail/QuestionContent.tsx src/components/take/TakeAssignment.tsx src/components/take/questions.tsx src/components/results/ResultDetail.tsx src/components/grading/GradeAttempt.tsx src/components/grading/AiAssist.tsx src/components/schedule/PrintableExercise.tsx
git commit -m "Render formulas and figures wherever questions appear"
```

---

### Task 4: Serving and cleaning up figure images (server)

**Files:**
- Modify: `src/server/storage.ts` (add `signedUrls`, `listFolder`)
- Create: `src/server/question-images.ts`
- Modify: `src/server/queries.ts` (`getQuestionsWithImages`, `getExerciseSetDetail`, `getAttemptDetail`)
- Modify: `src/server/actions/library.ts` (`loadQuestions`, `saveExerciseSet`, `deleteExerciseSet`, `previewSetUploads`)
- Modify: `src/app/(app)/student/assignments/[id]/do/page.tsx:16`

**Interfaces:**
- Consumes: `figureOwner`, `unusedFigures` (Task 2).
- Produces:
  - `signedUrls(paths: string[]): Promise<Record<string, string>>`, `listFolder(folder: StorageFolder, ownerId: string): Promise<string[]>`
  - `withImageUrls<T extends { image?: QuestionImage; imageUrl?: string }>(items: T[]): Promise<T[]>`
  - `getQuestionsWithImages(setId: string): Promise<Question[]>`
  - `getQuestions` stays raw (no `imageUrl`): `src/server/actions/attempts.ts` snapshots its output into `answers.question`.

The pure part (`unusedFigures`) is tested in Task 2; this task is I/O glue, verified by typecheck/build, the manual check below and the e2e in Task 11.

- [ ] **Step 1: Storage helpers** — append to `src/server/storage.ts`:

```ts
/** Signed read URLs for many objects at once, keyed by path (missing ones are left out). */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  if (!unique.length) return {}
  const { data, error } = await storage().from(BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS)
  if (error || !data) return {}
  return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])))
}

/** Full paths of the objects directly inside an owner's folder. */
export async function listFolder(folder: StorageFolder, ownerId: string): Promise<string[]> {
  const prefix = `${folder}/${ownerId}`
  const { data, error } = await storage().from(BUCKET).list(prefix, { limit: 1000 })
  if (error || !data) return []
  return data.map((o) => `${prefix}/${o.name}`)
}
```

- [ ] **Step 2: Signing helper** — `src/server/question-images.ts`:

```ts
import "server-only"
import type { QuestionImage } from "@/lib/types"
import { signedUrls } from "./storage"

/** Adds a short-lived `imageUrl` to every question with a figure. Never store the result. */
export async function withImageUrls<T extends { image?: QuestionImage; imageUrl?: string }>(items: T[]): Promise<T[]> {
  const urls = await signedUrls(items.flatMap((q) => (q.image ? [q.image.path] : [])))
  return items.map((q) => (q.image && urls[q.image.path] ? { ...q, imageUrl: urls[q.image.path] } : q))
}
```

- [ ] **Step 3: Queries** — in `src/server/queries.ts`:

```ts
import { withImageUrls } from "./question-images"
```

```ts
/** Questions with signed figure URLs, for display. Use getQuestions() for anything that gets stored. */
export async function getQuestionsWithImages(setId: string): Promise<Question[]> {
  return withImageUrls(await getQuestions(setId))
}
```

In `getExerciseSetDetail`, replace `getQuestions(id)` inside `Promise.all` with `getQuestionsWithImages(id)`.

In `getAttemptDetail`, replace the final return with:

```ts
  if (!assignment) return null
  const signed = await withImageUrls(answerRows.map((a) => a.question))
  return {
    attempt,
    assignment,
    answers: answerRows.map((a, i) => ({ ...a, question: signed[i] })),
    scans: await Promise.all(scanRows.map(toAttachment)),
  }
```

- [ ] **Step 4: Student take page** — in `src/app/(app)/student/assignments/[id]/do/page.tsx`, replace `getQuestions(record.setId)` with `getQuestionsWithImages(record.setId)` and update the import.

- [ ] **Step 5: Library actions** — in `src/server/actions/library.ts`:

```ts
import { and, eq, inArray, notInArray, sql, type AnyColumn } from "drizzle-orm"
import { figureOwner, unusedFigures } from "@/lib/figures"
import { getExerciseSetDetail, getQuestions, getQuestionsWithImages, getStudent, isUuid, toExerciseSet } from "../queries"
import { attachmentUrl, createUploadTargets, isUploaded, listFolder, removeFromStorage, type UploadTarget } from "../storage"

const { exerciseSets, questions, attachments, assignments, answers } = schema
```

`loadQuestions`: return `isUuid(setId) ? getQuestionsWithImages(setId) : []`.

In `saveExerciseSet`, after the existing `newFiles` upload check:

```ts
    // Figures the set didn't have yet must really be in Storage (their paths are checked by the schema).
    const known = new Set((await getQuestions(set.id)).flatMap((q) => (q.image ? [q.image.path] : [])))
    for (const path of new Set(qs.flatMap((q) => (q.image ? [q.image.path] : [])))) {
      if (known.has(path)) continue
      const owner = figureOwner(path)
      if (!owner || !(await isUploaded("sets", owner, path))) throw new Error("Hình minh họa chưa tải lên xong. Hãy thử lại.")
    }
```

After `await removeUnreferenced(removedPaths)` add `await removeUnusedFigures(id)`. In `deleteExerciseSet`, after `await removeUnreferenced(...)` add `await removeUnusedFigures(id)`.

Below `removeUnreferenced`:

```ts
const imagePath = (column: AnyColumn) => sql<string>`${column}->'image'->>'path'`

/** Figure objects in a set's folder that no question, answer snapshot or attachment uses any more. */
async function removeUnusedFigures(setId: string) {
  try {
    const candidates = unusedFigures(await listFolder("sets", setId), [])
    if (!candidates.length) return
    const [inQuestions, inAnswers, inAttachments] = await Promise.all([
      db.select({ path: imagePath(questions.content) }).from(questions).where(inArray(imagePath(questions.content), candidates)),
      db.select({ path: imagePath(answers.question) }).from(answers).where(inArray(imagePath(answers.question), candidates)),
      db.select({ path: attachments.storagePath }).from(attachments).where(inArray(attachments.storagePath, candidates)),
    ])
    const used = [...inQuestions, ...inAnswers, ...inAttachments].flatMap((r) => (r.path ? [r.path] : []))
    await removeFromStorage(unusedFigures(candidates, used))
  } catch {
    // Best effort: a leftover figure only costs storage.
  }
}
```

`previewSetUploads`: change `paths.slice(0, 30)` to `paths.slice(0, 200)` (restored drafts also sign their figures).

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: green.

Manual (local Supabase): in Studio (http://127.0.0.1:54323) upload any JPEG to the bucket at `sets/<a seeded set id>/<any uuid>-figure.jpg`; in the SQL editor set one of that set's questions `content = jsonb_set(content, '{image}', '{"path":"<that path>","width":300,"height":200}')`; open the set detail page: the picture shows. Save the set from the UI: the object stays. Remove the image (SQL `content - 'image'`) and save again from the UI: the object is deleted.

- [ ] **Step 7: Commit**

```bash
git add src/server/storage.ts src/server/question-images.ts src/server/queries.ts src/server/actions/library.ts "src/app/(app)/student/assignments/[id]/do/page.tsx"
git commit -m "Serve question figures with signed URLs and remove unused ones"
```

---

### Task 5: Math keyboard for the child (`MathAnswerInput`)

**Files:**
- Create: `src/types/mathlive.d.ts`, `src/components/take/MathField.tsx`, `src/components/take/PlainMathInput.tsx`, `src/components/take/MathAnswerInput.tsx`
- Create (copied): `public/mathlive/fonts/` from `node_modules/mathlive/fonts/`
- Modify: `src/components/take/questions.tsx` (`FillBlank`, `ShortAnswer`)
- Dependency: `mathlive`

**Interfaces:**
- Consumes: `TakeQuestion` already keeps `math`/`simplest` (it only omits answer keys).
- Produces: `MathAnswerInputProps { value: string; onChange: (latex: string) => void; ariaLabel: string; size?: "large" | "inline"; tone?: { border?: string; ring?: string } }` and `<MathAnswerInput {...MathAnswerInputProps} />` (default export) — reused in Task 10.

- [ ] **Step 1: Install and copy fonts**

```bash
pnpm add mathlive
mkdir -p public/mathlive && cp -r node_modules/mathlive/fonts public/mathlive/fonts
```

- [ ] **Step 2: JSX typing** — `src/types/mathlive.d.ts`:

```ts
import type { MathfieldElement } from "mathlive"
import type { DetailedHTMLProps, HTMLAttributes } from "react"

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": DetailedHTMLProps<HTMLAttributes<MathfieldElement>, MathfieldElement>
    }
  }
}
```

Check `tsconfig.json` `include` covers `src/**/*.ts` (add `"src/types/**/*.d.ts"` if not).

- [ ] **Step 3: Props, lazy wrapper and fallback**

```tsx
// src/components/take/MathAnswerInput.tsx
'use client'

import dynamic from 'next/dynamic'

export interface MathAnswerInputProps {
  value: string
  onChange: (latex: string) => void
  ariaLabel: string
  size?: 'large' | 'inline'
  tone?: { border?: string; ring?: string }
}

// MathLive is ~1 MB: load it only where a math answer is needed, and fall back to a text box if it fails.
const MathField = dynamic(() => import('./MathField').catch(() => import('./PlainMathInput')), {
  ssr: false,
  loading: () => <div className="h-20 w-full animate-pulse rounded-2xl border-2 border-slate-200 bg-slate-50" />,
})

export default function MathAnswerInput(props: MathAnswerInputProps) {
  return <MathField {...props} />
}
```

```tsx
// src/components/take/PlainMathInput.tsx
'use client'

import { cn } from '@/lib/utils'
import type { MathAnswerInputProps } from './MathAnswerInput'

/** Used when MathLive can't load (offline): "3/4" typed as text still grades by value. */
export default function PlainMathInput({ value, onChange, ariaLabel, size = 'large', tone }: MathAnswerInputProps) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      placeholder="VD: 3/4"
      className={cn(
        'rounded-2xl border-2 bg-white px-4 font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:ring-4',
        size === 'large' ? 'h-20 w-full text-3xl' : 'mx-1 inline-block h-14 w-28 text-center align-middle text-2xl',
        tone?.border,
        tone?.ring,
      )}
    />
  )
}
```

- [ ] **Step 4: The MathLive field** — `src/components/take/MathField.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { MathfieldElement } from 'mathlive'
import { cn } from '@/lib/utils'
import type { MathAnswerInputProps } from './MathAnswerInput'

// Global MathLive setup, once per page: local fonts, no sounds, a primary-school keyboard.
MathfieldElement.fontsDirectory = '/mathlive/fonts'
MathfieldElement.soundsDirectory = null
window.mathVirtualKeyboard.layouts = [
  {
    label: '123',
    rows: [
      ['7', '8', '9', { latex: '\\div', label: '÷' }, '[backspace]'],
      ['4', '5', '6', { latex: '\\times', label: '×' }, { latex: '\\frac{#@}{#?}', label: 'phân số' }],
      ['1', '2', '3', '-', { latex: '#?\\frac{#?}{#?}', label: 'hỗn số' }],
      ['0', { latex: '{,}', label: ',' }, '(', ')', '+'],
      ['[left]', '[right]', '[hide-keyboard]'],
    ],
  },
]

export default function MathField({ value, onChange, ariaLabel, size = 'large', tone }: MathAnswerInputProps) {
  const ref = useRef<MathfieldElement>(null)
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    const mf = ref.current
    if (!mf) return
    mf.mathVirtualKeyboardPolicy = 'auto'
    mf.menuItems = []
    const onInput = () => latest.current(mf.value)
    mf.addEventListener('input', onInput)
    return () => mf.removeEventListener('input', onInput)
  }, [])

  useEffect(() => {
    const mf = ref.current
    if (mf && mf.value !== value) mf.value = value
  }, [value])

  return (
    <math-field
      ref={ref}
      aria-label={ariaLabel}
      className={cn(
        'rounded-2xl border-2 bg-white px-4 text-slate-900 outline-none focus-within:ring-4',
        size === 'large' ? 'block min-h-20 w-full py-4 text-3xl' : 'mx-1 inline-block min-h-14 min-w-28 py-2 align-middle text-2xl',
        tone?.border,
        tone?.ring,
      )}
    />
  )
}
```

If TypeScript complains about a layout keycap shape, check `node_modules/mathlive/dist/types/virtual-keyboard.d.ts` (`VirtualKeyboardKeycap`) and match its field names; the strings `[backspace]`, `[left]`, `[right]`, `[hide-keyboard]` are MathLive's built-in keycaps.

- [ ] **Step 5: Use it in the take components** — `src/components/take/questions.tsx` (`import MathAnswerInput from './MathAnswerInput'`):

`ShortAnswer`: destructure `q` too (`{ q, value = "", onChange, tone, math }`) and put a new first branch in front of the existing `math ? <input…> : <Textarea…>`:

```tsx
      {q.math ? (
        <MathAnswerInput value={value} onChange={onChange} ariaLabel="Câu trả lời" tone={tone} />
      ) : math ? (
        // …existing <input inputMode="decimal" …/> unchanged
      ) : (
        // …existing <Textarea …/> unchanged
      )}
```

`FillBlank`, in the blank branch:

```tsx
          {i < parts.length - 1 &&
            (q.math ? (
              <MathAnswerInput
                size="inline"
                ariaLabel={`Chỗ trống ${i + 1}`}
                value={value[i] ?? ""}
                onChange={(latex) => {
                  const next = [...value]
                  next[i] = latex
                  onChange(next)
                }}
                tone={tone}
              />
            ) : (
              // …existing <input aria-label={`Chỗ trống ${i + 1}`} … /> unchanged
            ))}
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: green.

Manual: in Studio set a seeded, assigned short-answer question to `"math": true, "answer": "\\frac{3}{4}"`; as the student open the assignment in an iPad-sized window: the math field shows, tapping it opens the custom keyboard, typing `6/8` on a keyboard shows a fraction; after submitting, the question is graded correct.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml public/mathlive src/types/mathlive.d.ts src/components/take/MathField.tsx src/components/take/PlainMathInput.tsx src/components/take/MathAnswerInput.tsx src/components/take/questions.tsx
git commit -m "Add a math keyboard for math answers"
```

---

### Task 6: Hints and AI grading understand formulas and figures

**Files:**
- Modify: `src/lib/ai/hints.ts` (`leaksAnswer`), `src/lib/ai/hints.test.ts`
- Modify: `src/server/actions/ai-hints.ts`, `src/server/actions/ai-grading.ts`

**Interfaces:**
- Consumes: `latexToPlain`, `mathValuesIn`, `evaluateMath`, `equalRational` (Task 1); `storageFileBlocks(path, label): Promise<ContentBlock[]>` (existing, `src/server/ai/llm.ts`).
- Produces: `leaksAnswer(hint: string, q: Question): boolean` (same signature, LaTeX and value aware).

- [ ] **Step 1: Write the failing tests** — add to `src/lib/ai/hints.test.ts` (import `Question` from `@/lib/types` if needed):

```ts
describe("leaksAnswer with math", () => {
  const q: Question = { id: "m1", type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", points: 1, skills: [], answer: "\\frac{3}{4}", math: true }

  it("catches the answer written another way", () => {
    expect(leaksAnswer("Đáp án là 3/4 nhé", q)).toBe(true)
    expect(leaksAnswer("Kết quả bằng 6/8", q)).toBe(true)
    expect(leaksAnswer("Kết quả là $\\frac{3}{4}$", q)).toBe(true)
    expect(leaksAnswer("Bằng 0,75 đó", q)).toBe(true)
  })

  it("allows numbers from the question and guidance", () => {
    expect(leaksAnswer("Em quy đồng 1/2 thành 2/4 rồi cộng với 1/4 nhé", q)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/ai/hints.test.ts`
Expected: FAIL on "catches the answer written another way".

- [ ] **Step 3: Implement** — in `src/lib/ai/hints.ts`:

```ts
import { equalRational, evaluateMath, latexToPlain, mathValuesIn } from "@/lib/math-answer"
```

Replace `leaksAnswer` with:

```ts
/** True when the hint gives away an answer that isn't already visible in the question. */
export function leaksAnswer(hint: string, q: Question): boolean {
  const plainHint = latexToPlain(hint)
  const text = normalizeText(plainHint)
  const prompt = normalizeText(latexToPlain(q.prompt))
  const textLeak = secrets(q).some((s) => {
    const secret = normalizeText(latexToPlain(s))
    return secret.length > 0 && containsWord(text, secret) && !containsWord(prompt, secret)
  })
  return textLeak || mathValueLeaks(plainHint, q)
}

/** Math keys also leak as any equal value (6/8 or 0,75 for 3/4) the question doesn't show. Single digits stay allowed. */
function mathValueLeaks(plainHint: string, q: Question): boolean {
  if ((q.type !== "tra-loi-ngan" && q.type !== "dien-cho-trong") || !q.math) return false
  const keys = q.type === "tra-loi-ngan" ? [q.answer] : q.answers
  const shown = mathValuesIn(latexToPlain(q.prompt))
  const said = mathValuesIn(plainHint).filter((c) => !/^\d$/.test(c.raw))
  return keys.some((k) => {
    const value = evaluateMath(k)
    if (!value || shown.some((s) => equalRational(s.value, value))) return false
    return said.some((c) => equalRational(c.value, value))
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/ai/hints.test.ts`
Expected: PASS (existing tests too).

- [ ] **Step 5: Send figures to the AI**

`src/server/actions/ai-hints.ts`:

```ts
import { ask, storageFileBlocks, type ContentBlock } from "../ai/llm"
```

```ts
    const figures: ContentBlock[] = (
      await Promise.all(
        items.map((i) => (i.question.image ? storageFileBlocks(i.question.image.path, `Hình của câu id ${i.id}:`).catch(() => []) : [])),
      )
    ).flat()
    const result = await ask({
      system: HINTS_SYSTEM,
      content: [{ type: "text", text: hintsPrompt(items, set.subject, set.grade) }, ...figures],
      schema: hintsResponseSchema,
      effort: "low",
      maxTokens: 6000,
    })
```

`src/server/actions/ai-grading.ts` — add a helper and make `essayBlocks` async:

```ts
/** The question's figure as an image block, when it has one. */
async function figureBlocks(question: Question, number: number): Promise<ContentBlock[]> {
  if (!question.image) return []
  return storageFileBlocks(question.image.path, `Hình của câu ${number}:`).catch(() => [])
}
```

```ts
async function essayBlocks(items: { row: AnswerRow; number: number }[]): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = []
  for (const { row, number } of items) {
    const typed = isEssayValue(row.response) ? (row.response.text ?? "") : ""
    blocks.push({ type: "text", text: essayQuestionText(row.question, number, typed) })
    blocks.push(...(await figureBlocks(row.question, number)))
    const drawing = essayDrawing(row.response)
    const image = drawing ? parseImageDataUrl(drawing) : null
    if (image) {
      blocks.push({ type: "text", text: `Chữ viết tay của con cho câu ${number}:` })
      blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } })
    } else if (!typed.trim()) {
      blocks.push({ type: "text", text: `(Câu ${number}: con không viết gì.)` })
    }
  }
  return blocks
}
```

In `gradeEssays`, use `...(await essayBlocks(items))`. In the paper-grading function (the one that sends `paperQuestionList(...)`), append after that text block, using the rows/numbers it already builds:

```ts
      ...(await Promise.all(items.map(({ row, number }) => figureBlocks(row.question, number)))).flat(),
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/hints.ts src/lib/ai/hints.test.ts src/server/actions/ai-hints.ts src/server/actions/ai-grading.ts
git commit -m "Keep hints from leaking math answers and show figures to AI"
```

---

### Task 7: AI output — LaTeX, math flags and figure boxes

**Files:**
- Create: `src/lib/figure-crop.ts`, `src/lib/figure-crop.test.ts`
- Modify: `src/lib/ai/question-format.ts`, `src/lib/ai/question-format.test.ts`
- Modify: `src/lib/ai/scan.ts`, `src/lib/ai/scan.test.ts`
- Modify: `src/lib/ai/generate.ts`, `src/lib/ai/generate.test.ts`

**Interfaces:**
- Consumes: `evaluateMath` (Task 1).
- Produces:
  - `type Box = [number, number, number, number]`, `FULL_PAGE: Box`, `repairBox(raw: number[] | null | undefined): Box | null`, `cropRect(box: Box, width: number, height: number, padding?: number): { x: number; y: number; width: number; height: number }`, `boxFromPercent(c: { x: number; y: number; width: number; height: number }): Box`, `percentFromBox(b: Box): { unit: "%"; x: number; y: number; width: number; height: number }`, `sameBox(a: Box, b: Box): boolean`
  - `aiQuestionSchema` gains `math: boolean | null`, `simplest: boolean | null`, `figure: { box: number[] } | null`
  - `ConvertedQuestion.figure?: { page: number; box: Box }`; `ScannedQuestion.figure?: { page: number; box: Box }`
  - `MATH_NOTATION_RULES: string` in `question-format.ts`, used by `SCAN_SYSTEM_PROMPT` and `GENERATE_SYSTEM_PROMPT`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/figure-crop.test.ts
import { describe, expect, it } from "vitest"
import { boxFromPercent, cropRect, percentFromBox, repairBox, sameBox } from "./figure-crop"

describe("repairBox", () => {
  it("clamps, orders corners and rounds", () => {
    expect(repairBox([600, 700, 100.4, -20])).toEqual([100, 0, 600, 700])
    expect(repairBox([0, 0, 1200, 500])).toEqual([0, 0, 1000, 500])
  })
  it("drops boxes that are missing, tiny or the whole page", () => {
    expect(repairBox(null)).toBeNull()
    expect(repairBox([1, 2, 3])).toBeNull()
    expect(repairBox([100, 100, 110, 400])).toBeNull()
    expect(repairBox([0, 0, 1000, 1000])).toBeNull()
    expect(repairBox([0, 0, Number.NaN, 10])).toBeNull()
  })
})

describe("cropRect", () => {
  it("pads by 3% of the page and converts to pixels", () => {
    expect(cropRect([100, 200, 500, 600], 2000, 1000)).toEqual({ x: 140, y: 170, width: 880, height: 460 })
  })
  it("never leaves the page", () => {
    expect(cropRect([0, 0, 1000, 990], 1000, 1000)).toEqual({ x: 0, y: 0, width: 1000, height: 1000 })
  })
  it("can skip padding", () => {
    expect(cropRect([0, 0, 1000, 1000], 300, 200, 0)).toEqual({ x: 0, y: 0, width: 300, height: 200 })
  })
})

describe("percent conversion", () => {
  it("round-trips", () => {
    expect(percentFromBox([125, 250, 625, 750])).toEqual({ unit: "%", x: 12.5, y: 25, width: 50, height: 50 })
    expect(boxFromPercent({ x: 12.5, y: 25, width: 50, height: 50 })).toEqual([125, 250, 625, 750])
    expect(sameBox([1, 2, 3, 4], [1.4, 2, 3, 4])).toBe(true)
  })
})
```

Fixtures: in `src/lib/ai/question-format.test.ts`, `src/lib/ai/scan.test.ts` and `src/lib/ai/generate.test.ts`, find every `AiQuestion` object literal (search `trueFalseAnswer: null`) and add `math: null, simplest: null, figure: null` next to it.

Add to `src/lib/ai/question-format.test.ts` (use the file's own fixture helper; below it is called `q`, adapt if it differs; import `REPAIRED_CONFIDENCE` if needed):

```ts
describe("math and figures", () => {
  it("keeps math answers as LaTeX without dollars and sets simplest only with math", () => {
    const r = toQuestion(q({ type: "tra-loi-ngan", prompt: "$\\frac{1}{2}+\\frac{1}{4}=?$", answer: "$\\frac{3}{4}$", math: true, simplest: true }), "id-1")
    expect(r.question).toMatchObject({ answer: "\\frac{3}{4}", math: true, simplest: true })
    const plain = toQuestion(q({ type: "tra-loi-ngan", prompt: "Tính", answer: "24 kg", math: null, simplest: true }), "id-2")
    expect(plain.question).not.toHaveProperty("math")
    expect(plain.question).not.toHaveProperty("simplest")
  })

  it("turns math off with a note when an answer can't be evaluated", () => {
    const r = toQuestion(q({ type: "tra-loi-ngan", prompt: "Tính", answer: "24 kg", math: true }), "id-1")
    expect(r.question).not.toHaveProperty("math")
    expect(r.notes).toContain("Đáp án dạng toán chưa đọc được – kiểm tra lại")
    expect(r.confidence).toBeLessThanOrEqual(REPAIRED_CONFIDENCE)
  })

  it("returns a repaired figure box on the question's page", () => {
    const r = toQuestion(q({ type: "trac-nghiem", prompt: "Hình nào là hình vuông?", options: ["A", "B"], correctIndex: 0, page: 2, figure: { box: [500, 600, 100, 200] } }), "id-1")
    expect(r.figure).toEqual({ page: 2, box: [100, 200, 500, 600] })
  })

  it("drops a broken figure box with a note", () => {
    const r = toQuestion(q({ type: "trac-nghiem", prompt: "Hình nào?", options: ["A", "B"], correctIndex: 0, figure: { box: [0, 0, 1000, 1000] } }), "id-1")
    expect(r.figure).toBeUndefined()
    expect(r.notes).toContain("Chưa xác định được vị trí hình – hãy thêm hình bằng tay")
  })
})
```

Add to `src/lib/ai/scan.test.ts` inside `describe("toScanResult", …)`:

```ts
  it("carries figure boxes to the review items", () => {
    const r = toScanResult(
      response({ questions: [q({ type: "trac-nghiem", prompt: "Hình nào?", options: ["A", "B"], correctIndex: 0, page: 2, figure: { box: [100, 100, 400, 400] } })] }),
      meta,
      3,
      ids(),
    )
    expect(r.items[0].figure).toEqual({ page: 2, box: [100, 100, 400, 400] })
  })

  it("asks for LaTeX formulas and figure boxes", () => {
    expect(SCAN_SYSTEM_PROMPT).toContain("$\\frac{3}{4} + \\frac{1}{8}$")
    expect(SCAN_SYSTEM_PROMPT).toContain("fill figure")
  })
```

Add to `src/lib/ai/generate.test.ts` (import `GENERATE_SYSTEM_PROMPT` if needed):

```ts
it("asks for LaTeX formulas and no figures", () => {
  expect(GENERATE_SYSTEM_PROMPT).toContain("$\\frac{3}{4} + \\frac{1}{8}$")
  expect(GENERATE_SYSTEM_PROMPT).toContain("Never fill figure")
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/figure-crop.test.ts src/lib/ai`
Expected: FAIL — missing `./figure-crop`; new assertions fail.

- [ ] **Step 3: Implement `figure-crop.ts`**

```ts
// src/lib/figure-crop.ts
/*
 * Figure boxes: [x0, y0, x1, y1] in 0–1000 of a page's width and height, as
 * the scanner returns them. Pure maths for repairing AI boxes, cropping with
 * padding, and converting to/from react-image-crop's percent crops.
 */

export type Box = [number, number, number, number]

export const FULL_PAGE: Box = [0, 0, 1000, 1000]

const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)))

/** A usable box, or null when it is missing, too small (<2% of a side) or covers >95% of the page. */
export function repairBox(raw: number[] | null | undefined): Box | null {
  if (!raw || raw.length !== 4 || raw.some((n) => !Number.isFinite(n))) return null
  const [a, b, c, d] = raw.map(clamp)
  const box: Box = [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
  const w = box[2] - box[0]
  const h = box[3] - box[1]
  if (w < 20 || h < 20 || w * h > 950_000) return null
  return box
}

/** Pixel rectangle of a box on a `width`×`height` page, padded by `padding` of the page on each side. */
export function cropRect(box: Box, width: number, height: number, padding = 0.03) {
  const pad = padding * 1000
  const x0 = Math.max(0, box[0] - pad)
  const y0 = Math.max(0, box[1] - pad)
  const x1 = Math.min(1000, box[2] + pad)
  const y1 = Math.min(1000, box[3] + pad)
  const x = Math.floor((x0 / 1000) * width)
  const y = Math.floor((y0 / 1000) * height)
  return { x, y, width: Math.ceil((x1 / 1000) * width) - x, height: Math.ceil((y1 / 1000) * height) - y }
}

export function boxFromPercent(c: { x: number; y: number; width: number; height: number }): Box {
  return [clamp(c.x * 10), clamp(c.y * 10), clamp((c.x + c.width) * 10), clamp((c.y + c.height) * 10)]
}

export function percentFromBox(b: Box) {
  return { unit: "%" as const, x: b[0] / 10, y: b[1] / 10, width: (b[2] - b[0]) / 10, height: (b[3] - b[1]) / 10 }
}

export const sameBox = (a: Box, b: Box) => a.every((v, i) => Math.abs(v - b[i]) < 1)
```

- [ ] **Step 4: AI schema, repairs and prompts** — in `src/lib/ai/question-format.ts`:

```ts
import { repairBox, type Box } from "@/lib/figure-crop"
import { evaluateMath } from "@/lib/math-answer"
```

Add to `aiQuestionSchema`, after `rubric`:

```ts
  math: z
    .boolean()
    .nullable()
    .describe("tra-loi-ngan/dien-cho-trong: true when the answer is a number, fraction or expression the child types with a math keyboard; the answer(s) are then LaTeX without $"),
  simplest: z.boolean().nullable().describe("With math: true when the exercise asks for the simplest form (\"rút gọn\", \"tối giản\")"),
  figure: z
    .object({ box: z.array(z.number()).describe("[x0, y0, x1, y1] from 0 to 1000 of the page's width and height, tight around the drawing and its labels") })
    .nullable()
    .describe("The picture, diagram, drawn table or chart the child needs to answer, on this question's page; null when there is none"),
```

Add the shared rules:

```ts
/** Formula rules shared by the scan and generate prompts. */
export const MATH_NOTATION_RULES = `- Write every formula (fractions, mixed numbers, expressions with ×, ÷, powers) as LaTeX between dollar signs inside prompts and options, e.g. "Tính $\\frac{3}{4} + \\frac{1}{8}$", "$2\\frac{1}{3}$", "$12 \\times 5$". Plain numbers and units need no LaTeX ("24 kg").
- Set math to true for tra-loi-ngan and dien-cho-trong questions whose answer is a number, fraction or expression the child types with a math keyboard; then write the answer(s) as LaTeX without dollar signs, e.g. "\\frac{3}{4}", "2\\frac{1}{3}", "0{,}75". Answers with words or units ("24 kg", "Thứ năm") keep math null.
- Set simplest to true when the exercise asks for the simplest form ("rút gọn", "phân số tối giản").`
```

Extend `ConvertedQuestion` with `figure?: { page: number; box: Box }`.

Add helpers above `draft`:

```ts
const stripDollars = (s: string) => s.trim().replace(/^\$+|\$+$/g, "").trim()

/** Math flags for answers `answers`; math is turned off (with a note) when one can't be evaluated. */
function mathFlags(ai: AiQuestion, answers: string[], issues: string[]): { math?: true; simplest?: true } {
  if (!ai.math) return {}
  if (!answers.length || answers.some((a) => !evaluateMath(a))) {
    issues.push("Đáp án dạng toán chưa đọc được – kiểm tra lại")
    return {}
  }
  return ai.simplest ? { math: true, simplest: true } : { math: true }
}
```

Change the two cases in `draft()`:

```ts
    case "dien-cho-trong": {
      let prompt = normalizeBlanks(base.prompt)
      const answers = ai.answers ?? []
      const blanks = prompt.split(BLANK).length - 1
      // "6 × 10 =" with one answer is common and harmless: append the blank without flagging it.
      if (blanks === 0 && answers.length > 0) prompt = `${prompt} ${Array(answers.length).fill(BLANK).join(" ; ")}`
      else if (blanks !== answers.length) issues.push(`Số chỗ trống (${blanks}) khác số đáp án (${answers.length})`)
      const filled = Array.from({ length: Math.max(blanks, answers.length, 1) }, (_, i) => {
        const a = answers[i]?.trim() ?? ""
        return ai.math ? stripDollars(a) : a
      })
      if (filled.some((a) => !a)) issues.push("Còn chỗ trống chưa có đáp án")
      return { ...base, prompt, type: "dien-cho-trong", answers: filled, ...mathFlags(ai, filled.filter(Boolean), issues) }
    }
    case "tra-loi-ngan": {
      const answer = ai.math ? stripDollars(ai.answer ?? "") : (ai.answer?.trim() ?? "")
      if (!answer) issues.push("Chưa có đáp án")
      return { ...base, type: "tra-loi-ngan", answer, ...mathFlags(ai, answer ? [answer] : [], issues) }
    }
```

Replace `toQuestion` with:

```ts
export function toQuestion(ai: AiQuestion, id: string): ConvertedQuestion {
  const issues: string[] = []
  const content = draft(ai, issues)
  if (!issues.length && !questionContentSchema.safeParse(content).success) issues.push("Câu hỏi chưa đủ thông tin")
  const page = Math.max(1, Math.round(ai.page || 1))
  let figure: ConvertedQuestion["figure"]
  if (ai.figure) {
    const box = repairBox(ai.figure.box)
    if (box) figure = { page, box }
    else issues.push("Chưa xác định được vị trí hình – hãy thêm hình bằng tay")
  }
  const reported = Number.isFinite(ai.confidence) ? Math.min(1, Math.max(0, ai.confidence)) : 0.5
  return {
    question: { ...content, id } as Question,
    confidence: issues.length ? Math.min(reported, REPAIRED_CONFIDENCE) : reported,
    page,
    notes: [...(ai.note?.trim() ? [ai.note.trim()] : []), ...issues],
    ...(figure ? { figure } : {}),
  }
}
```

`src/lib/ai/scan.ts`:
- `import { MATH_NOTATION_RULES, aiQuestionSchema, toQuestion } from "@/lib/ai/question-format"` and `import type { Box } from "@/lib/figure-crop"`.
- `ScannedQuestion` gains `figure?: { page: number; box: Box }`.
- In `toScanResult`'s map, add to the returned item: `...(converted.figure ? { figure: { page: Math.min(Math.max(1, fileCount), converted.figure.page), box: converted.figure.box } } : {})`.
- In `SCAN_SYSTEM_PROMPT`, insert before the line `- page is the number N…`:

```
${MATH_NOTATION_RULES}
- When the child needs a picture, diagram, drawn table or chart to answer (geometry figures, objects to count, clocks, charts), fill figure with its box on that page: [x0, y0, x1, y1] from 0 to 1000 of the page's width and height, tight around the drawing and its labels, not the question text. Parts of one exercise that share a picture repeat the same box. Use null when no picture is needed.
```

`src/lib/ai/generate.ts`: import `MATH_NOTATION_RULES`; in `GENERATE_SYSTEM_PROMPT` insert before `- Use note only…`:

```
${MATH_NOTATION_RULES}
- Never fill figure; set it to null.
```

- [ ] **Step 5: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: all PASS. If typecheck reports other `AiQuestion` literals, add `math: null, simplest: null, figure: null` to them.

- [ ] **Step 6: Commit**

```bash
git add src/lib/figure-crop.ts src/lib/figure-crop.test.ts src/lib/ai
git commit -m "Ask AI for LaTeX, math flags and figure boxes"
```

---

### Task 8: Crop figures after a scan

**Files:**
- Create: `src/lib/figure-client.ts`
- Modify: `src/components/upload/review-utils.ts`
- Modify: `src/components/pages/UploadFlow.tsx` (`startScan`, `restoreDraft`, `handleSave`)
- Modify: `src/components/upload/ExtractedQuestionCard.tsx`

**Interfaces:**
- Consumes: `cropRect`, `Box` (Task 7); `FIGURE_FILE_NAME` (Task 2); `uploadFiles` (`src/lib/upload-client.ts`); `requestSetUploads` (`src/server/actions/library.ts`); `QuestionContent` already shows `QuestionPicture` (Task 3).
- Produces:
  - `cropFigure(source: Blob | string, box: Box, opts?: { padding?: number; maxSide?: number }): Promise<{ file: File; width: number; height: number }>`
  - `makeFigure(setId: string, source: Blob | string, box: Box, opts?: { padding?: number }): Promise<{ image: QuestionImage; imageUrl: string }>`
  - `ReviewItem.figureState?: "cropping" | "error"`
  - `pageSource(page: SourcePage | undefined): Blob | string | undefined`

- [ ] **Step 1: Browser helper** — `src/lib/figure-client.ts`:

```ts
import { unwrap } from "@/lib/action-result"
import { cropRect, type Box } from "@/lib/figure-crop"
import { FIGURE_FILE_NAME } from "@/lib/figures"
import type { QuestionImage } from "@/lib/types"
import { uploadFiles } from "@/lib/upload-client"
import { requestSetUploads } from "@/server/actions/library"

/** Cuts a box out of a page image (a picked file or a signed URL) into a JPEG on white. */
export async function cropFigure(source: Blob | string, box: Box, { padding = 0.03, maxSide = 1200 } = {}) {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source
  const bitmap = await createImageBitmap(blob)
  const r = cropRect(box, bitmap.width, bitmap.height, padding)
  const scale = Math.min(1, maxSide / Math.max(r.width, r.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(r.width * scale))
  canvas.height = Math.max(1, Math.round(r.height * scale))
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88))
  if (!jpeg) throw new Error("Không cắt được hình")
  return { file: new File([jpeg], FIGURE_FILE_NAME, { type: "image/jpeg" }), width: canvas.width, height: canvas.height }
}

/** Crops, uploads under the set's folder, and returns the question image plus a local preview URL. */
export async function makeFigure(setId: string, source: Blob | string, box: Box, opts: { padding?: number } = {}) {
  const { file, width, height } = await cropFigure(source, box, opts)
  const [uploaded] = await uploadFiles([file], async (names) => unwrap(await requestSetUploads(setId, names)))
  const image: QuestionImage = { path: uploaded.path, width, height }
  return { image, imageUrl: URL.createObjectURL(file) }
}
```

- [ ] **Step 2: Review item state** — in `src/components/upload/review-utils.ts`:

```ts
export interface ReviewItem extends ScannedQuestion {
  /** Set once the parent edits, merges or confirms the question. */
  reviewed: boolean
  /** Figure being cut out and uploaded, or one that failed (the card offers a retry). */
  figureState?: 'cropping' | 'error'
}
```

and at the end of the file:

```ts
/** The page image to crop from: the picked file, else its (signed) preview URL. */
export function pageSource(page: SourcePage | undefined): Blob | string | undefined {
  return page?.file.file ?? page?.file.url
}
```

- [ ] **Step 3: Crop after the scan** — `src/components/pages/UploadFlow.tsx`:

```ts
import { makeFigure } from '@/lib/figure-client'
import type { Box } from '@/lib/figure-crop'
import { needsCheck, pageSource, pagesFromFiles, type ReviewItem, type SourcePage } from '@/components/upload/review-utils'
```

Inside the component:

```ts
  /** Cuts out every figure the scan found (identical boxes once) and attaches it to its questions. */
  const cropFigures = async (scanned: ReviewItem[], sourcePages: SourcePage[], run: number) => {
    const groups = new Map<string, { page: number; box: Box; ids: string[] }>()
    for (const it of scanned) {
      if (!it.figure) continue
      const key = `${it.figure.page}:${it.figure.box.join(',')}`
      const group = groups.get(key) ?? { page: it.figure.page, box: it.figure.box, ids: [] }
      group.ids.push(it.question.id)
      groups.set(key, group)
    }
    await Promise.all(
      [...groups.values()].map(async (g) => {
        const apply = (patch: (it: ReviewItem) => ReviewItem) => {
          if (run === scanRun.current) setItems((list) => list.map((it) => (g.ids.includes(it.question.id) ? patch(it) : it)))
        }
        try {
          const source = pageSource(sourcePages[g.page - 1])
          if (!source) throw new Error('missing page')
          const { image, imageUrl } = await makeFigure(setId, source, g.box)
          apply((it) => ({ ...it, figureState: undefined, question: { ...it.question, image, imageUrl } }))
        } catch {
          apply((it) => ({ ...it, figureState: 'error' }))
        }
      }),
    )
  }
```

In `startScan`, replace `setItems(scanned.map((s) => ({ ...s, reviewed: false })))` with:

```ts
      const reviewItems: ReviewItem[] = scanned.map((s) => ({ ...s, reviewed: false, ...(s.figure ? { figureState: 'cropping' as const } : {}) }))
      setItems(reviewItems)
      void cropFigures(reviewItems, pagesFromFiles(current), run)
```

In `restoreDraft`, replace `setItems(draft.items)` with:

```ts
    setItems(draft.items.map((it) => (it.figureState === 'cropping' ? { ...it, figureState: 'error' as const } : it)))
```

and replace the preview block with:

```ts
    // Blob previews are gone; show the uploaded copies (pages and figures) instead.
    const figurePaths = draft.items.flatMap((it) => (it.question.image ? [it.question.image.path] : []))
    const paths = [...draft.files.flatMap((f) => (f.uploaded ? [f.uploaded.path] : [])), ...figurePaths]
    try {
      const urls = unwrap(await previewSetUploads(draft.setId, paths))
      setFiles((list) => list.map((f) => (f.uploaded && urls[f.uploaded.path] ? { ...f, url: urls[f.uploaded.path] } : f)))
      setItems((list) =>
        list.map((it) =>
          it.question.image && urls[it.question.image.path] ? { ...it, question: { ...it.question, imageUrl: urls[it.question.image.path] } } : it,
        ),
      )
    } catch {
      toast('Không tải được ảnh xem trước', { description: 'Các câu hỏi vẫn được giữ nguyên.' })
    }
```

At the top of `handleSave`:

```ts
    if (items.some((i) => i.figureState === 'cropping')) {
      toast('Đang cắt hình minh họa', { description: 'Chờ vài giây rồi lưu nhé.' })
      return
    }
    const failed = items.filter((i) => i.figureState === 'error').length
    if (failed && !window.confirm(`${failed} câu chưa tải được hình minh họa. Vẫn lưu mà không có hình?`)) return
```

(`window.confirm` keeps this rare path simple; the existing flagged-questions dialog still follows.)

- [ ] **Step 4: Card states** — `src/components/upload/ExtractedQuestionCard.tsx`, right after `<QuestionContent question={q} />` (import `Loader2` from lucide-react):

```tsx
      {item.figureState === 'cropping' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Đang cắt hình…
        </p>
      )}
      {item.figureState === 'error' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
          <AlertTriangle className="size-4" aria-hidden />
          Chưa tải được hình – nhấn Chỉnh khung để thử lại.
        </p>
      )}
```

- [ ] **Step 5: Verify, then CHECKPOINT on real box accuracy**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: green.

Checkpoint (manual, real AI, costs a few DeepSeek calls): with `DEEPSEEK_API_KEY` and `AI_PROVIDER=deepseek` in `.env.local`, run `pnpm dev`, open Kho bài tập → Tải lên tài liệu, upload 2–3 photos of a grade-3/4 math worksheet with geometry figures or charts, and scan. Compare each cut-out with its page and record in the task report: figures detected, cut-outs that contain the whole figure, cut-outs that are off.
- Most usable → continue.
- Most poor → still do Task 9 (the adjust dialog is the fallback), but tell the human partner before starting Task 9; the spec says the review should then lean on manual boxes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/figure-client.ts src/components/upload/review-utils.ts src/components/pages/UploadFlow.tsx src/components/upload/ExtractedQuestionCard.tsx
git commit -m "Cut figures out of scanned pages for the review step"
```

---

### Task 9: Adjust, remove and add figures in the review step

**Files:**
- Create: `src/components/upload/FigureCropDialog.tsx`
- Modify: `src/components/upload/ExtractedQuestionCard.tsx`, `src/components/upload/ReviewStep.tsx`, `src/components/pages/UploadFlow.tsx`
- Dependency: `react-image-crop`

**Interfaces:**
- Consumes: `makeFigure`, `pageSource` (Task 8); `boxFromPercent`, `percentFromBox`, `Box` (Task 7).
- Produces: `<FigureCropDialog open onOpenChange pageUrl?={string} initialBox?={Box} title={string} saving?={boolean} onSave={(box: Box) => void} />` (default export) — reused in Task 10. `ReviewStep` gains prop `setId: string`.

- [ ] **Step 1: Install** — `pnpm add react-image-crop`

- [ ] **Step 2: Dialog** — `src/components/upload/FigureCropDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { boxFromPercent, percentFromBox, type Box } from '@/lib/figure-crop'

interface FigureCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageUrl?: string
  initialBox?: Box
  title: string
  saving?: boolean
  onSave: (box: Box) => void
}

/** Drag a box on a page image to choose a question's figure. */
export default function FigureCropDialog({ open, onOpenChange, pageUrl, initialBox, title, saving, onSave }: FigureCropDialogProps) {
  const [crop, setCrop] = useState<PercentCrop | undefined>(initialBox ? percentFromBox(initialBox) : undefined)
  // Reset the selection whenever the dialog opens for another figure.
  const [shownFor, setShownFor] = useState({ open, initialBox })
  if (shownFor.open !== open || shownFor.initialBox !== initialBox) {
    setShownFor({ open, initialBox })
    if (open) setCrop(initialBox ? percentFromBox(initialBox) : undefined)
  }
  const valid = Boolean(crop && crop.width > 2 && crop.height > 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Kéo để khoanh vùng hình minh họa, kéo các góc để chỉnh.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[65dvh] justify-center overflow-auto rounded-xl bg-slate-100 p-2">
          {pageUrl ? (
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} keepSelection>
              <img src={pageUrl} alt="Trang tài liệu" className="max-h-[60dvh] w-auto" draggable={false} />
            </ReactCrop>
          ) : (
            <p className="p-8 text-sm text-slate-500">Không có ảnh trang để cắt.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button disabled={!valid || saving} onClick={() => crop && onSave(boxFromPercent(crop))}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Dùng hình này
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Card buttons** — `ExtractedQuestionCard.tsx`: add props `onAdjustFigure: () => void` and `onRemoveFigure: () => void` to the props interface and destructuring; in the footer row after the "Gộp với câu trên" button (import `Crop`, `ImageOff`, `ImagePlus` from lucide-react):

```tsx
        {q.image || item.figure || item.figureState ? (
          <>
            <Button variant="ghost" size="sm" className="h-11 text-slate-600" onClick={onAdjustFigure}>
              <Crop />
              Chỉnh khung
            </Button>
            <Button variant="ghost" size="sm" className="h-11 text-slate-600" onClick={onRemoveFigure}>
              <ImageOff />
              Bỏ hình
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="h-11 text-slate-600" onClick={onAdjustFigure}>
            <ImagePlus />
            Thêm hình
          </Button>
        )}
```

- [ ] **Step 4: Review step** — `ReviewStep.tsx`: add `setId: string` to `ReviewStepProps` and the destructuring; in `UploadFlow.tsx` pass `setId={setId}` to `<ReviewStep … />`. Imports: `useRef`, `FigureCropDialog`, `makeFigure` (`@/lib/figure-client`), `pageSource`, `type Box` (`@/lib/figure-crop`). Inside the component:

```tsx
  const latestItems = useRef(items)
  latestItems.current = items
  const [figureFor, setFigureFor] = useState<ReviewItem | null>(null)
  const [savingFigure, setSavingFigure] = useState(false)
  const figurePage = figureFor ? (figureFor.figure?.page ?? figureFor.page) : 1

  const saveFigure = async (box: Box) => {
    if (!figureFor) return
    const id = figureFor.question.id
    const source = pageSource(pages[figurePage - 1])
    if (!source) return
    setSavingFigure(true)
    try {
      const { image, imageUrl } = await makeFigure(setId, source, box)
      // Read the latest items: the parent may have edited other cards while this uploaded.
      onItemsChange(
        latestItems.current.map((it) =>
          it.question.id === id
            ? { ...it, reviewed: true, figureState: undefined, figure: { page: figurePage, box }, question: { ...it.question, image, imageUrl } }
            : it,
        ),
      )
      setFigureFor(null)
    } catch {
      toast.error('Không tải được hình', { description: 'Kiểm tra mạng rồi thử lại.' })
    } finally {
      setSavingFigure(false)
    }
  }

  const removeFigure = (id: string) =>
    onItemsChange(
      items.map((it) => {
        if (it.question.id !== id) return it
        const { image: _image, imageUrl: _url, ...question } = it.question
        return { ...it, figure: undefined, figureState: undefined, reviewed: true, question: question as Question }
      }),
    )
```

Pass to each `ExtractedQuestionCard`: `onAdjustFigure={() => setFigureFor(item)}` and `onRemoveFigure={() => removeFigure(item.question.id)}`. Render once at the end of the returned JSX:

```tsx
      <FigureCropDialog
        open={figureFor !== null}
        onOpenChange={(open) => !open && setFigureFor(null)}
        pageUrl={pages[figurePage - 1]?.file.url}
        initialBox={figureFor?.figure?.box}
        title={figureFor?.question.image ? 'Chỉnh khung hình' : 'Thêm hình minh họa'}
        saving={savingFigure}
        onSave={(box) => void saveFigure(box)}
      />
```

In `handleMergeUp`, keep the figure of whichever part has one:

```tsx
    const mergedQuestion = mergeQuestions(upper.question, lower.question)
    const image = upper.question.image ?? lower.question.image
    const merged: ReviewItem = {
      ...upper,
      question: image
        ? ({ ...mergedQuestion, image, imageUrl: upper.question.image ? upper.question.imageUrl : lower.question.imageUrl } as Question)
        : mergedQuestion,
      figure: upper.figure ?? lower.figure,
      figureState: upper.figureState ?? lower.figureState,
      confidence: Math.max(upper.confidence, lower.confidence),
      reviewed: true,
      note: undefined,
    }
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: green.

Manual: scan a worksheet; on a card with a figure, **Chỉnh khung** → drag → **Dùng hình này** updates the cut-out; **Bỏ hình** removes it; on a card without one, **Thêm hình** → draw → it appears. Reload during review → **Khôi phục** → figures still show. Save → open the set → figures show; in Studio the set folder has no `-figure.jpg` objects other than the ones the questions use.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/upload src/components/pages/UploadFlow.tsx
git commit -m "Let parents adjust, remove and add figures when reviewing a scan"
```

---

### Task 10: Question editor — formulas, Toán switch and pictures

**Files:**
- Modify: `src/components/exercise-detail/question-draft.ts`
- Create: `src/components/exercise-detail/question-draft.test.ts`
- Create: `src/components/exercise-detail/FormulaPreview.tsx`, `src/components/exercise-detail/FigureField.tsx`
- Modify: `src/components/exercise-detail/QuestionEditorSheet.tsx`, `src/components/exercise-detail/QuestionTypeFields.tsx`
- Modify: `src/components/pages/ExerciseSetDetail.tsx`, `src/components/pages/AIGenerate.tsx`, `src/components/upload/ReviewStep.tsx`

**Interfaces:**
- Consumes: `evaluateMath` (Task 1), `hasMath` + `RichText` + `QuestionPicture` (Task 3), `MathAnswerInput` (Task 5), `FULL_PAGE` (Task 7), `makeFigure` + `pageSource` (Task 8), `FigureCropDialog` (Task 9).
- Produces:
  - `QuestionDraft` gains `math: boolean`, `simplest: boolean`, `image?: QuestionImage`, `imageUrl?: string`
  - `FigureSource { label: string; source: Blob | string; url?: string }` (exported from `FigureField.tsx`)
  - `QuestionEditorSheet` props gain `setId?: string`, `sources?: FigureSource[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/exercise-detail/question-draft.test.ts
import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import { changeDraftType, fromDraft, toDraft, validateDraft } from "./question-draft"

const FIG = { path: "sets/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-figure.jpg", width: 300, height: 200 }

describe("question drafts with math and figures", () => {
  it("round-trips math flags and the figure", () => {
    const q: Question = { id: "q1", type: "tra-loi-ngan", prompt: "$\\frac12+\\frac14$", points: 1, skills: [], answer: "\\frac{3}{4}", math: true, simplest: true, image: FIG, imageUrl: "blob:x" }
    expect(fromDraft(toDraft(q), "q1")).toEqual(q)
  })

  it("rejects math keys that can't be evaluated", () => {
    const d = { ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Tính", points: 1, skills: [], answer: "3 phần 4" }), math: true }
    expect(validateDraft(d)).toContain("Đáp án dạng toán chưa đúng (VD: 3/4, 2\\frac{1}{3}, 0,75)")
  })

  it("drops math flags for types without math answers and keeps the figure", () => {
    const d = changeDraftType({ ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Hình?", points: 1, skills: [], answer: "\\frac{1}{2}", math: true, image: FIG }) }, "trac-nghiem")
    const q = fromDraft({ ...d, options: ["A", "B"], correctIndex: 0 }, "q")
    expect(q).not.toHaveProperty("math")
    expect(q.image).toEqual(FIG)
  })

  it("omits simplest unless math is on", () => {
    const d = { ...toDraft({ id: "q", type: "tra-loi-ngan", prompt: "Tính", points: 1, skills: [], answer: "5" }), simplest: true }
    expect(fromDraft(d, "q")).not.toHaveProperty("simplest")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/exercise-detail/question-draft.test.ts`
Expected: FAIL — round-trip loses `math`, `simplest`, `image`, `imageUrl`; no math validation message.

- [ ] **Step 3: Implement draft changes** — `question-draft.ts`:

```ts
import { evaluateMath } from '@/lib/math-answer'
import type { MatchingPair, Question, QuestionImage, QuestionType } from '@/lib/types'

const MATH_KEY_ISSUE = 'Đáp án dạng toán chưa đúng (VD: 3/4, 2\\frac{1}{3}, 0,75)'
```

- `QuestionDraft`: add `math: boolean`, `simplest: boolean`, `image?: QuestionImage`, `imageUrl?: string`.
- `emptyDraft`: add `math: false, simplest: false`.
- `toDraft`: `const base = { ...emptyDraft(q.type), prompt: q.prompt, points: q.points, skills: [...q.skills], image: q.image, imageUrl: q.imageUrl }`; the `dien-cho-trong` and `tra-loi-ngan` cases add `math: Boolean(q.math), simplest: Boolean(q.simplest)`.
- `validateDraft`:

```ts
    case 'dien-cho-trong': {
      const n = countBlanks(d.prompt)
      if (n === 0) issues.push(`Thêm ít nhất một chỗ trống (${BLANK})`)
      else if (d.blanks.slice(0, n).some((b) => !b?.trim())) issues.push('Nhập đáp án cho mọi chỗ trống')
      else if (d.math && d.blanks.slice(0, n).some((b) => !evaluateMath(b))) issues.push(MATH_KEY_ISSUE)
      break
    }
    case 'tra-loi-ngan':
      if (!d.shortAnswer.trim()) issues.push('Nhập đáp án')
      else if (d.math && !evaluateMath(d.shortAnswer)) issues.push(MATH_KEY_ISSUE)
      break
```

- `fromDraft`:

```ts
export function fromDraft(d: QuestionDraft, id: string, previous?: Question): Question {
  const base = { id, prompt: d.prompt.trim(), points: d.points, skills: d.skills, ...(d.image ? { image: d.image, imageUrl: d.imageUrl } : {}) }
  const math = d.math ? { math: true as const, ...(d.simplest ? { simplest: true as const } : {}) } : {}
  switch (d.type) {
    // …other cases unchanged…
    case 'dien-cho-trong':
      return { ...base, type: 'dien-cho-trong', answers: d.blanks.slice(0, countBlanks(d.prompt)).map((b) => b.trim()), ...math }
    case 'tra-loi-ngan':
      return { ...base, type: 'tra-loi-ngan', answer: d.shortAnswer.trim(), ...math }
    // …
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/exercise-detail/question-draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Editor components**

```tsx
// src/components/exercise-detail/FormulaPreview.tsx
import RichText from '@/components/question/RichText'
import { hasMath } from '@/lib/rich-text'

/** Live rendering under a text field once it contains a $…$ formula. */
export default function FormulaPreview({ text }: { text: string }) {
  if (!hasMath(text)) return null
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-sm text-slate-800" aria-label="Xem trước công thức">
      <RichText text={text} className="whitespace-pre-line" />
    </div>
  )
}
```

```tsx
// src/components/exercise-detail/FigureField.tsx
'use client'

import { useRef, useState } from 'react'
import { Crop, ImageOff, ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import QuestionPicture from '@/components/question/QuestionPicture'
import FigureCropDialog from '@/components/upload/FigureCropDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { makeFigure } from '@/lib/figure-client'
import { FULL_PAGE, type Box } from '@/lib/figure-crop'
import type { QuestionImage } from '@/lib/types'

export interface FigureSource {
  label: string
  source: Blob | string
  url?: string
}

interface FigureFieldProps {
  setId: string
  sources: FigureSource[]
  image?: QuestionImage
  imageUrl?: string
  onChange: (image?: QuestionImage, imageUrl?: string) => void
}

/** "Hình minh họa": pick a photo, cut one out of the set's pages, or remove it. */
export default function FigureField({ setId, sources, image, imageUrl, onChange }: FigureFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [cropFrom, setCropFrom] = useState<FigureSource | null>(null)

  const run = async (source: Blob | string, box: Box, padding: number) => {
    setBusy(true)
    try {
      const made = await makeFigure(setId, source, box, { padding })
      onChange(made.image, made.imageUrl)
      setCropFrom(null)
    } catch {
      toast.error('Không tải được hình', { description: 'Kiểm tra mạng rồi thử lại.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Hình minh họa</Label>
      {image && <QuestionPicture question={{ image, imageUrl }} className="max-h-48" />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus />}
          Chọn ảnh
        </Button>
        {sources.map((s) => (
          <Button key={s.label} type="button" variant="outline" size="sm" disabled={busy || !s.url} onClick={() => setCropFrom(s)}>
            <Crop />
            Cắt từ {s.label}
          </Button>
        ))}
        {image && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(undefined, undefined)}>
            <ImageOff />
            Bỏ hình
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void run(file, FULL_PAGE, 0)
        }}
      />
      <FigureCropDialog
        open={cropFrom !== null}
        onOpenChange={(open) => !open && setCropFrom(null)}
        pageUrl={cropFrom?.url}
        title="Cắt hình từ trang tài liệu"
        saving={busy}
        onSave={(box) => cropFrom && void run(cropFrom.source, box, 0.03)}
      />
    </div>
  )
}
```

- [ ] **Step 6: Wire into the sheet and type fields**

`QuestionEditorSheet.tsx`:
- Props: add `setId?: string` and `sources?: FigureSource[]` (import the type from `./FigureField`).
- Generalize the existing `insertBlank` into `insertAtCursor(snippet: string, caretBack = 0)` (same body: read `promptRef.current.selectionStart/End`, splice `snippet` into `draft.prompt`, then on the next frame set the caret to `start + snippet.length - caretBack`); `insertBlank` becomes `() => insertAtCursor(BLANK)` (keep its current spacing behaviour if it adds spaces).
- Formula bar next to the insert-blank button:

```tsx
const FORMULA_SNIPPETS = [
  { label: 'Phân số', snippet: '$\\frac{}{}$', caretBack: 4 },
  { label: 'Hỗn số', snippet: '$1\\frac{}{}$', caretBack: 4 },
  { label: '×', snippet: '$\\times$', caretBack: 0 },
  { label: '÷', snippet: '$\\div$', caretBack: 0 },
]
```

```tsx
              {FORMULA_SNIPPETS.map((f) => (
                <Button key={f.label} type="button" variant="outline" size="sm" aria-label={`Chèn ${f.label}`} onClick={() => insertAtCursor(f.snippet, f.caretBack)}>
                  {f.label}
                </Button>
              ))}
```

- Under the prompt textarea: `<FormulaPreview text={draft.prompt} />`.
- Below `<QuestionTypeFields … />`, when `setId` is set:

```tsx
            {setId && (
              <FigureField setId={setId} sources={sources ?? []} image={draft.image} imageUrl={draft.imageUrl} onChange={(image, imageUrl) => patch({ image, imageUrl })} />
            )}
```

`QuestionTypeFields.tsx`:
- Under each option input and under the rubric textarea: `<FormulaPreview text={…} />`.
- `ShortAnswerFields` and `FillBlankFields`: add a "Toán" toggle bound to `draft.math` — use `Switch` from `@/components/ui/switch` if the project has it (check `src/components/ui/`), otherwise a `ToggleGroup` with one item, matching the existing controls in the sheet — labelled **Toán (bàn phím số, chấm theo giá trị)**. When on: replace each answer `<Input>` with `<MathAnswerInput size="inline" ariaLabel={…same label…} value={…} onChange={…same setter…} />`, and show a checkbox **Bắt buộc dạng tối giản** bound to `draft.simplest`.

- [ ] **Step 7: Pass `setId` and sources**

- `ExerciseSetDetail.tsx`: on `<QuestionEditorSheet … />` pass `setId={set.id}` and `sources={attachments.filter((a) => a.kind === 'image' && a.url).map((a, i) => ({ label: `trang ${i + 1}`, source: a.url!, url: a.url }))}` (use the component's actual variable names for the set and its attachments).
- `ReviewStep.tsx`: pass `setId={setId}` and `sources={pages.flatMap((p) => { const s = pageSource(p); return s ? [{ label: `trang ${p.index}`, source: s, url: p.file.url }] : [] })}`.
- `AIGenerate.tsx`: pass `setId` = the client-made id the component uses when saving the generated set; no `sources`.

- [ ] **Step 8: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: green.

Manual: in a set's editor, type `$\frac{1}{2}$` in the prompt → preview renders; **Phân số** inserts a fraction with the caret inside; switch a short answer to **Toán**, enter `3/4` in the math field, tick **Bắt buộc dạng tối giản**, save, reopen → still set. **Chọn ảnh** adds a picture; on a scanned set **Cắt từ trang 1** crops one; **Bỏ hình** removes it; save → Storage keeps only the used figure.

- [ ] **Step 9: Commit**

```bash
git add src/components/exercise-detail src/components/pages/ExerciseSetDetail.tsx src/components/pages/AIGenerate.tsx src/components/upload/ReviewStep.tsx
git commit -m "Edit formulas, math answers and figures in the question editor"
```

---

### Task 11: Seed data and end-to-end test

**Files:**
- Modify: `src/db/seed-data.ts` (set `bt-18`), `src/db/seed.ts` (seed figure)
- Create: `e2e/math-figures.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: seeded ready set "Phân số và hình vẽ" with a math short answer (`\frac{3}{4}`) and a multiple-choice question with a figure.

- [ ] **Step 1: Seed set** — append to `SEED_SETS` in `src/db/seed-data.ts` (uses the file's `sa`/`mc` helpers):

```ts
  {
    key: "bt-18", title: "Phân số và hình vẽ", subject: "toan", grade: 3, topic: "Phân số",
    description: "Cộng phân số đơn giản và đọc hình vẽ.",
    kind: "luyen-tap", source: "thu-cong", status: "san-sang", estimatedMinutes: 10, difficulty: 2, ageDays: 1,
    questions: [
      { ...sa("Tính: $\\frac{1}{2} + \\frac{1}{4} = ?$", "\\frac{3}{4}", ["Phân số"]), math: true },
      mc("Hình bên có mấy hình vuông?", ["3", "4", "5", "6"], 1, ["Hình học"]),
    ],
  },
```

If `sa`'s declared return type rejects `math`, widen it to the question-content type the file uses for `questions` (the field is optional on that type after Task 2).

- [ ] **Step 2: Upload the seed figure** — in `src/db/seed.ts` add imports `import { createClient } from "@supabase/supabase-js"` and `import { eq } from "drizzle-orm"`, then:

```ts
/** 1×1 PNG; the browser scales it to the stored size. Enough to test that figures load. */
const SEED_FIGURE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

async function seedFigure(set: Loaded) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return console.log("No SUPABASE_URL/SUPABASE_SECRET_KEY: skipping the seed figure")
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage
  const bucket = process.env.STORAGE_BUCKET ?? "homework"
  const { data } = await storage.getBucket(bucket)
  if (!data) await storage.createBucket(bucket, { public: false, fileSizeLimit: "20MB" })
  const path = `sets/${set.row.id}/${crypto.randomUUID()}-figure.jpg`
  const { error } = await storage.from(bucket).upload(path, SEED_FIGURE, { contentType: "image/png", upsert: true })
  if (error) throw error
  const question = set.questions.find((x) => x.type === "trac-nghiem")
  if (!question) return
  const { id, ...content } = { ...question, image: { path, width: 240, height: 160 } }
  await db.update(schema.questions).set({ content }).where(eq(schema.questions.id, id))
}
```

Call it in `main()` right after the sets loop: `await seedFigure(sets.get("bt-18")!)`. Run `pnpm db:seed`; the final "Done: …" line reports one more set and two more questions than before.

- [ ] **Step 3: E2E spec** — `e2e/math-figures.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

const TITLE = "Phân số và hình vẽ"

async function openSet(page: Page) {
  await open(page, "/parent/library")
  await page.getByText(TITLE, { exact: true }).first().click()
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible()
}

test("formulas and figures render in the library", async ({ page }) => {
  const errors = trackPageErrors(page)
  await openSet(page)
  await expect(page.locator(".katex").first()).toBeVisible()
  const figure = page.getByRole("img", { name: "Hình minh họa" }).first()
  await expect(figure).toBeVisible()
  expect(await figure.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test("child answers a fraction with the math keyboard and an equal value counts", async ({ page }, testInfo) => {
  // Both projects share one seeded database: assign and take only once.
  test.skip(testInfo.project.name !== "ipad", "runs once")
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)

  await openSet(page)
  await page.getByRole("button", { name: "Giao bài này" }).filter({ visible: true }).first().click()
  await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()

  await open(page, "/student/assignments")
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: TITLE, exact: true }) })
  await card.getByRole("button", { name: "Bắt đầu" }).click()
  const take = page.getByRole("dialog", { name: `Làm bài: ${TITLE}` })

  const field = take.locator("math-field")
  await expect(field).toBeVisible()
  await field.click()
  await page.keyboard.type("6/8")
  await expect.poll(() => field.evaluate((el) => (el as HTMLElement & { value: string }).value)).toContain("\\frac{6}{8}")
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()

  await expect(take.getByRole("img", { name: "Hình minh họa" })).toBeVisible()
  await take.getByRole("radio", { name: /^B/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()

  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp!")).toBeVisible()
  await expect(page).toHaveURL(/\/student\/results\//, { timeout: 15_000 })
  await expect(page.locator("p").filter({ hasText: "/10" }).first()).toHaveText(/^10\s*\/10$/)
  expect(errors).toEqual([])
})
```

Before relying on the last two lines, read `src/components/take/TakeRoute.tsx` (`onSubmitted`): if an all-objective submit doesn't navigate to `/student/results/…`, open the result the way the app does (`/student/assignments` → card → **Xem kết quả**) and assert the 10/10 there. The score counts up (`CountUp`), so `toHaveText` with its auto-retry waits for it.

- [ ] **Step 4: Run e2e**

Run: `pnpm test:e2e`
Expected: all specs PASS on `ipad` and `iphone` (the take test is skipped on `iphone`).

- [ ] **Step 5: Commit**

```bash
git add src/db/seed-data.ts src/db/seed.ts e2e/math-figures.spec.ts
git commit -m "Seed and test math answers and figures end to end"
```

---

### Task 12: Docs and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md** — in "Domain rules that span files", add:

```markdown
- Question text may contain LaTeX between `$…$` (`\$` is a literal dollar). Always render question text with `components/question/RichText` (KaTeX, `trust: false`) and figures with `QuestionPicture`; `lib/rich-text.ts` does the splitting.
- `tra-loi-ngan` / `dien-cho-trong` with `math: true` store LaTeX answer keys (no `$`), show the MathLive keyboard (`take/MathAnswerInput`, lazy-loaded, fonts in `public/mathlive/fonts`) and grade by exact value with `lib/math-answer.ts` (6/8 = 3/4 = 0,75); `simplest: true` also requires lowest terms.
- Figures: `question.image = { path, width, height }` points at `sets/{setId}/{uuid}-figure.jpg`. The scanner returns a 0–1000 box per figure (`lib/figure-crop.ts`), the browser crops and uploads it (`lib/figure-client.ts`), and the review step lets the parent adjust it. Display paths through `getQuestionsWithImages` / `getAttemptDetail`, which add a signed `imageUrl`; `getQuestions` stays raw because attempts snapshot it. `saveExerciseSet` / `deleteExerciseSet` delete figure objects that no question, answer snapshot or attachment references.
```

- [ ] **Step 2: Full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`
Expected: typecheck clean, lint 0 errors, unit tests PASS, build succeeds, e2e PASS.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document formulas, math answers and figures"
```
