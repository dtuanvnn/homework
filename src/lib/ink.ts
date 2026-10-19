/**
 * Handwritten essay answers as vector strokes ("ink"). Pure: the same code
 * draws on the take canvas, in the grading/result SVGs and in the SVG the
 * server rasterizes for AI grading, so writing looks the same everywhere.
 *
 * A page is PAGE_W × PAGE_H units whatever the screen; renderers only scale.
 * A "strip" (one word of a flashcard set) is PAGE_W × STRIP_H.
 * A stroke is a flat [x, y, p, x, y, p, …] of integers, p = pressure 0–10.
 */
import { getStroke } from "perfect-freehand"
import { z } from "zod"

export const PAGE_W = 1000
export const PAGE_H = 700
/** Height of a one-line strip, e.g. a handwritten word. */
export const STRIP_H = 300
export const MAX_PAGES = 10
export const MAX_PRESSURE = 10
const MAX_STROKES_PER_PAGE = 3000
const MAX_POINTS_PER_STROKE = 4000

export type Paper = "o-li" | "ke-ngang"
export type InkSize = "strip"

export interface InkPage {
  strokes: number[][]
}

export interface Ink {
  v: 1
  /** Kept with the ink so old work keeps the paper it was written on. */
  paper: Paper
  /** Absent: notebook pages (PAGE_W × PAGE_H); "strip": PAGE_W × STRIP_H. */
  size?: InkSize
  pages: InkPage[]
}

export function pageHeight(ink: { size?: InkSize }): number {
  return ink.size === "strip" ? STRIP_H : PAGE_H
}

export const INK_COLOR = "#1e293b"
export const PAPER_COLORS = { main: "#a5b4fc", minor: "#e0e7ff", ruled: "#cbd5e1", margin: "#fca5a5" } as const
/** Red margin line on the left, as in Vietnamese notebooks. */
export const MARGIN_X = 70

const strokeSchema = z
  .array(z.number().int())
  .min(3)
  .max(MAX_POINTS_PER_STROKE * 3)
  .refine((s) => {
    if (s.length % 3) return false
    for (let i = 0; i < s.length; i += 3) {
      if (s[i] < 0 || s[i] > PAGE_W || s[i + 1] < 0 || s[i + 1] > PAGE_H || s[i + 2] < 0 || s[i + 2] > MAX_PRESSURE) return false
    }
    return true
  }, "Nét viết không hợp lệ")

export const inkSchema = z
  .object({
    v: z.literal(1),
    paper: z.enum(["o-li", "ke-ngang"]),
    size: z.literal("strip").optional(),
    pages: z
      .array(z.object({ strokes: z.array(strokeSchema).max(MAX_STROKES_PER_PAGE) }))
      .min(1)
      .max(MAX_PAGES),
  })
  .refine((ink) => {
    const h = pageHeight(ink)
    return h === PAGE_H || ink.pages.every((p) => p.strokes.every((s) => s.every((v, i) => i % 3 !== 1 || v <= h)))
  }, "Nét viết không hợp lệ")

export function newInk(paper: Paper, size?: InkSize): Ink {
  return size ? { v: 1, paper, size, pages: [{ strokes: [] }] } : { v: 1, paper, pages: [{ strokes: [] }] }
}

/** Ô li (4-ô-ly notebook) for the early grades, ruled lines once the child writes smaller. */
export function paperFor(grade: number): Paper {
  return grade <= 3 ? "o-li" : "ke-ngang"
}

/** Horizontal paper lines; ô li has three minor lines between main lines. */
export function paperLines(paper: Paper, height = PAGE_H): { y: number; main: boolean }[] {
  const lines: { y: number; main: boolean }[] = []
  if (paper === "o-li") {
    const gap = 64
    for (let y = 48; y < height; y += gap) {
      lines.push({ y, main: true })
      for (let k = 1; k < 4 && y + (gap / 4) * k < height; k++) lines.push({ y: y + (gap / 4) * k, main: false })
    }
  } else {
    for (let y = 56; y < height; y += 56) lines.push({ y, main: true })
  }
  return lines
}

/** Page coordinates and a 0–1 pressure → the stored integers. */
export function quantizePoint(x: number, y: number, pressure: number): [number, number, number] {
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)))
  return [clamp(x, PAGE_W), clamp(y, PAGE_H), clamp(pressure * MAX_PRESSURE, MAX_PRESSURE)]
}

const STROKE_OPTIONS = { size: 5, thinning: 0.6, smoothing: 0.5, streamline: 0.35, simulatePressure: false }

const fmt = (n: number) => String(Math.round(n * 100) / 100)

/**
 * SVG path `d` of a stroke's filled outline (perfect-freehand). `last: false`
 * while the stroke is still being drawn. Feeds both `Path2D` and `<path>`.
 */
export function strokePath(stroke: number[], last = true): string {
  if (stroke.length < 3) return ""
  const points: number[][] = []
  for (let i = 0; i + 2 < stroke.length; i += 3) points.push([stroke[i], stroke[i + 1], stroke[i + 2] / MAX_PRESSURE])
  const outline = getStroke(points, { ...STROKE_OPTIONS, last })
  if (outline.length < 2) return ""
  // Quadratic curves through the midpoints of the outline points.
  const parts = [`M${fmt(outline[0][0])},${fmt(outline[0][1])} Q`]
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % outline.length]
    parts.push(`${fmt(x0)},${fmt(y0)} ${fmt((x0 + x1) / 2)},${fmt((y0 + y1) / 2)}`)
  }
  parts.push("Z")
  return parts.join(" ")
}

/**
 * Erases the points within `r` of (cx, cy). A stroke the eraser cuts is split
 * into the runs left on each side; leftover single points are dropped (an
 * untouched one-point dot stays). Returns `strokes` itself when nothing changed.
 */
export function eraseStrokes(strokes: number[][], cx: number, cy: number, r: number): number[][] {
  const r2 = r * r
  const inside = (s: number[], i: number) => (s[i] - cx) ** 2 + (s[i + 1] - cy) ** 2 <= r2
  let changed = false
  const out: number[][] = []
  for (const s of strokes) {
    let hit = false
    for (let i = 0; i < s.length && !hit; i += 3) hit = inside(s, i)
    if (!hit) {
      out.push(s)
      continue
    }
    changed = true
    let run: number[] = []
    const flush = () => {
      if (run.length >= 6) out.push(run)
      run = []
    }
    for (let i = 0; i < s.length; i += 3) {
      if (inside(s, i)) flush()
      else run.push(s[i], s[i + 1], s[i + 2])
    }
    flush()
  }
  return changed ? out : strokes
}

export function pageIsEmpty(page: InkPage | undefined): boolean {
  return !page || page.strokes.length === 0
}

export function isInkEmpty(ink: Ink | null | undefined): boolean {
  return !ink || ink.pages.every(pageIsEmpty)
}

/** Drops blank pages at the end, keeping at least one page. */
export function trimInk(ink: Ink): Ink {
  let n = ink.pages.length
  while (n > 1 && pageIsEmpty(ink.pages[n - 1])) n--
  return n === ink.pages.length ? ink : { ...ink, pages: ink.pages.slice(0, n) }
}

/** Color and width of a paper line, shared by the canvas and the SVGs. */
export function paperLineStyle(paper: Paper, main: boolean): { color: string; width: number } {
  if (paper === "ke-ngang") return { color: PAPER_COLORS.ruled, width: 1.5 }
  return main ? { color: PAPER_COLORS.main, width: 1.5 } : { color: PAPER_COLORS.minor, width: 1 }
}

/** Standalone SVG of one page (paper + strokes); only numbers and fixed strings go in. */
export function inkPageSvg(ink: Ink, pageIndex: number, { width = PAGE_W }: { width?: number } = {}): string {
  const pageH = pageHeight(ink)
  const height = Math.round((width * pageH) / PAGE_W)
  const lines = paperLines(ink.paper, pageH)
    .map((l) => {
      const { color, width: w } = paperLineStyle(ink.paper, l.main)
      return `<line x1="0" y1="${l.y}" x2="${PAGE_W}" y2="${l.y}" stroke="${color}" stroke-width="${w}"/>`
    })
    .join("")
  const margin = `<line x1="${MARGIN_X}" y1="0" x2="${MARGIN_X}" y2="${pageH}" stroke="${PAPER_COLORS.margin}" stroke-width="1.5"/>`
  const strokes = (ink.pages[pageIndex]?.strokes ?? [])
    .map((s) => strokePath(s))
    .filter(Boolean)
    .map((d) => `<path d="${d}" fill="${INK_COLOR}"/>`)
    .join("")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${pageH}" width="${width}" height="${height}">` +
    `<rect width="${PAGE_W}" height="${pageH}" fill="#ffffff"/>${lines}${margin}${strokes}</svg>`
  )
}
