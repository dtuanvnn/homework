import { Resvg } from "@resvg/resvg-js"
import { describe, expect, it } from "vitest"
import {
  MAX_PAGES,
  PAGE_H,
  PAGE_W,
  STRIP_H,
  pageHeight,
  eraseStrokes,
  inkPageSvg,
  inkSchema,
  isInkEmpty,
  newInk,
  paperFor,
  paperLines,
  quantizePoint,
  strokePath,
  trimInk,
  type Ink,
} from "./ink"

const line = (x0: number, x1: number, y: number, step = 10) => {
  const s: number[] = []
  for (let x = x0; x <= x1; x += step) s.push(x, y, 5)
  return s
}

describe("paperFor", () => {
  it("uses ô li up to grade 3 and ruled lines from grade 4", () => {
    expect(paperFor(1)).toBe("o-li")
    expect(paperFor(3)).toBe("o-li")
    expect(paperFor(4)).toBe("ke-ngang")
    expect(paperFor(7)).toBe("ke-ngang")
  })
})

describe("paperLines", () => {
  it("draws ô li as main lines with three minor lines between them", () => {
    const lines = paperLines("o-li")
    const main = lines.filter((l) => l.main)
    expect(main.length).toBeGreaterThanOrEqual(9)
    const gap = main[1].y - main[0].y
    const between = lines.filter((l) => !l.main && l.y > main[0].y && l.y < main[1].y)
    expect(between).toHaveLength(3)
    expect(between.map((l) => l.y)).toEqual([1, 2, 3].map((k) => main[0].y + (gap / 4) * k))
  })

  it("keeps every line inside the page", () => {
    for (const paper of ["o-li", "ke-ngang"] as const) {
      for (const l of paperLines(paper)) {
        expect(l.y).toBeGreaterThan(0)
        expect(l.y).toBeLessThan(PAGE_H)
      }
    }
  })

  it("draws ruled paper with main lines only", () => {
    expect(paperLines("ke-ngang").every((l) => l.main)).toBe(true)
  })
})

describe("quantizePoint", () => {
  it("rounds and clamps to the page and pressure range", () => {
    expect(quantizePoint(10.4, 20.6, 0.53)).toEqual([10, 21, 5])
    expect(quantizePoint(-5, 900, 2)).toEqual([0, PAGE_H, 10])
    expect(quantizePoint(PAGE_W + 3, -1, -1)).toEqual([PAGE_W, 0, 0])
  })
})

describe("strokePath", () => {
  it("returns an empty path for no points", () => {
    expect(strokePath([])).toBe("")
  })

  it("returns a closed outline path for a stroke", () => {
    const d = strokePath(line(100, 200, 50))
    expect(d).toMatch(/^M[\d.]+,[\d.]+ Q/)
    expect(d.endsWith("Z")).toBe(true)
  })

  it("draws a dot for a single point", () => {
    expect(strokePath([100, 100, 5])).not.toBe("")
  })

  it("only writes numbers and path commands", () => {
    expect(strokePath(line(0, 300, 40))).toMatch(/^[MQZ\d., -]+$/)
  })
})

describe("eraseStrokes", () => {
  it("keeps strokes the eraser does not touch (same array)", () => {
    const strokes = [line(100, 200, 50)]
    expect(eraseStrokes(strokes, 500, 500, 20)).toBe(strokes)
  })

  it("removes a stroke completely under the eraser", () => {
    expect(eraseStrokes([[100, 100, 5, 105, 100, 5]], 102, 100, 20)).toEqual([])
  })

  it("splits a stroke into the parts left on both sides", () => {
    const [left, right] = eraseStrokes([line(100, 300, 50)], 200, 50, 15)
    expect(left.at(-3)).toBeLessThan(185)
    expect(right[0]).toBeGreaterThan(215)
    expect(left[0]).toBe(100)
    expect(right.at(-3)).toBe(300)
  })

  it("drops a single point left over from a split", () => {
    // Points at 100, 110, 120; erasing 110–120 leaves only 100.
    expect(eraseStrokes([[100, 0, 5, 110, 0, 5, 120, 0, 5]], 116, 0, 7)).toEqual([])
  })

  it("keeps an untouched dot", () => {
    const strokes = [[100, 100, 5]]
    expect(eraseStrokes(strokes, 300, 300, 10)).toBe(strokes)
  })
})

describe("isInkEmpty / trimInk", () => {
  it("treats missing ink and pages without strokes as empty", () => {
    expect(isInkEmpty(undefined)).toBe(true)
    expect(isInkEmpty(newInk("o-li"))).toBe(true)
    expect(isInkEmpty({ v: 1, paper: "o-li", pages: [{ strokes: [] }, { strokes: [[1, 1, 5]] }] })).toBe(false)
  })

  it("drops trailing blank pages but keeps one", () => {
    const ink: Ink = { v: 1, paper: "o-li", pages: [{ strokes: [[1, 1, 5]] }, { strokes: [] }, { strokes: [] }] }
    expect(trimInk(ink).pages).toHaveLength(1)
    expect(trimInk(newInk("ke-ngang")).pages).toHaveLength(1)
    const middle: Ink = { v: 1, paper: "o-li", pages: [{ strokes: [] }, { strokes: [[1, 1, 5]] }] }
    expect(trimInk(middle).pages).toHaveLength(2)
  })
})

describe("inkPageSvg", () => {
  const ink: Ink = { v: 1, paper: "o-li", pages: [{ strokes: [line(100, 300, 60)] }] }

  it("builds a standalone SVG with paper and strokes", () => {
    const svg = inkPageSvg(ink, 0, { width: 1500 })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain(`viewBox="0 0 ${PAGE_W} ${PAGE_H}"`)
    expect(svg).toContain('width="1500" height="1050"')
    expect(svg.match(/<line /g)?.length).toBe(paperLines("o-li").length + 1) // + margin line
    expect(svg.match(/<path /g)?.length).toBe(1)
    expect(svg.endsWith("</svg>")).toBe(true)
  })

  it("renders to a PNG of the requested size with resvg (as AI grading does)", () => {
    const image = new Resvg(inkPageSvg(ink, 0, { width: 1500 })).render()
    expect([image.width, image.height]).toEqual([1500, 1050])
    expect([...image.asPng().subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it("draws an empty page for a missing page index", () => {
    expect(inkPageSvg(ink, 5).match(/<path /g)).toBeNull()
  })
})

describe("inkSchema", () => {
  const valid: Ink = { v: 1, paper: "ke-ngang", pages: [{ strokes: [line(0, 100, 10)] }] }

  it("accepts valid ink", () => {
    expect(inkSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects points off the page, bad pressure, broken triples and non-integers", () => {
    const bad = (stroke: number[]) => inkSchema.safeParse({ ...valid, pages: [{ strokes: [stroke] }] }).success
    expect(bad([PAGE_W + 1, 0, 5])).toBe(false)
    expect(bad([0, PAGE_H + 1, 5])).toBe(false)
    expect(bad([0, 0, 11])).toBe(false)
    expect(bad([0, 0])).toBe(false)
    expect(bad([0.5, 0, 5])).toBe(false)
    expect(bad([])).toBe(false)
  })

  it("rejects too many pages and unknown paper", () => {
    const pages = Array.from({ length: MAX_PAGES + 1 }, () => ({ strokes: [] }))
    expect(inkSchema.safeParse({ ...valid, pages }).success).toBe(false)
    expect(inkSchema.safeParse({ ...valid, paper: "grid" }).success).toBe(false)
    expect(inkSchema.safeParse({ ...valid, pages: [] }).success).toBe(false)
  })
})

describe("strip ink (one written word)", () => {
  it("has its own page height and validates strokes against it", () => {
    expect(pageHeight({ size: "strip" })).toBe(STRIP_H)
    expect(pageHeight({})).toBe(PAGE_H)
    const strip = newInk("o-li", "strip")
    expect(strip.size).toBe("strip")
    expect(inkSchema.safeParse({ ...strip, pages: [{ strokes: [[10, STRIP_H - 10, 5, 20, STRIP_H - 10, 5]] }] }).success).toBe(true)
    expect(inkSchema.safeParse({ ...strip, pages: [{ strokes: [[10, STRIP_H + 10, 5, 20, STRIP_H + 10, 5]] }] }).success).toBe(false)
    expect(inkSchema.safeParse({ ...newInk("o-li"), pages: [{ strokes: [[10, 690, 5, 20, 690, 5]] }] }).success).toBe(true)
  })

  it("draws paper lines only inside the strip", () => {
    expect(paperLines("o-li", STRIP_H).every((l) => l.y < STRIP_H)).toBe(true)
    expect(paperLines("o-li", STRIP_H).length).toBeLessThan(paperLines("o-li").length)
  })

  it("renders a strip SVG with the strip's aspect ratio", () => {
    const svg = inkPageSvg(newInk("ke-ngang", "strip"), 0, { width: 500 })
    expect(svg).toContain(`viewBox="0 0 ${PAGE_W} ${STRIP_H}"`)
    expect(svg).toContain(`height="${(500 * STRIP_H) / PAGE_W}"`)
  })
})
