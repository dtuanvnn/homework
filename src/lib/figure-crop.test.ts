import { describe, expect, it } from "vitest"
import { boxFromPercent, cropRect, inkMap, percentFromBox, repairBox, sameBox, snapBox, type InkMap } from "./figure-crop"

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
  it("converts to pixels without padding by default", () => {
    expect(cropRect([100, 200, 500, 600], 2000, 1000)).toEqual({ x: 200, y: 200, width: 800, height: 400 })
  })
  it("pads by a share of the page", () => {
    expect(cropRect([100, 200, 500, 600], 2000, 1000, 0.03)).toEqual({ x: 140, y: 170, width: 920, height: 460 })
  })
  it("never leaves the page", () => {
    expect(cropRect([0, 0, 1000, 990], 1000, 1000, 0.03)).toEqual({ x: 0, y: 0, width: 1000, height: 1000 })
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

/** A white 1000×1000 page with dark rectangles [x0, y0, x1, y1] (inclusive pixels). */
function page(...rects: number[][]): InkMap {
  const ink = new Uint8Array(1000 * 1000)
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) ink.fill(1, y * 1000 + x0, y * 1000 + x1 + 1)
  return { width: 1000, height: 1000, ink }
}

describe("snapBox", () => {
  it("grows edges that cut through the drawing, then trims white margins", () => {
    // Drawing 300–600 × 300–500 plus a label at 250–290; the AI box cuts the label and the bottom.
    const map = page([300, 300, 600, 500], [250, 380, 290, 400])
    expect(snapBox(map, [270, 250, 640, 450], { margin: 0 })).toEqual([250, 300, 601, 501])
  })
  it("jumps word gaps when growing sideways", () => {
    // "30 cm" left of the drawing: two words 10px apart; the box cuts the second.
    const map = page([300, 300, 600, 500], [230, 380, 245, 400], [256, 380, 290, 400])
    expect(snapBox(map, [270, 290, 610, 510], { margin: 0 })).toEqual([230, 300, 601, 501])
  })
  it("drops a line of page text the box cut through, but keeps a label under the drawing", () => {
    const answers = [100, 520, 900, 535]
    expect(snapBox(page([300, 300, 600, 500], answers), [280, 280, 620, 540], { margin: 0 })).toEqual([300, 300, 601, 501])
    const label = [420, 515, 480, 530]
    expect(snapBox(page([300, 300, 600, 500], label), [280, 280, 620, 540], { margin: 0 })).toEqual([300, 300, 601, 531])
  })
  it("adds margin only into blank space", () => {
    const map = page([300, 300, 600, 500], [100, 505, 900, 520])
    expect(snapBox(map, [290, 290, 610, 502], { margin: 0.02 })).toEqual([280, 280, 621, 505])
  })
  it("adds a small margin and stays on the page", () => {
    const map = page([50, 300, 600, 500], [990, 0, 999, 999])
    expect(snapBox(map, [100, 320, 560, 480], { margin: 0.01 })).toEqual([40, 290, 611, 511])
    expect(snapBox(map, [960, 320, 995, 480], { margin: 0.02 })).toEqual([970, 240, 1000, 560])
  })
  it("ignores ink outside the box's columns when trimming", () => {
    // Question text above, to the left of the figure: not part of the box's columns.
    const map = page([0, 100, 200, 120], [400, 200, 700, 400])
    expect(snapBox(map, [380, 90, 720, 420], { margin: 0 })).toEqual([400, 200, 701, 401])
  })
  it("stops growing after maxGrow of the page", () => {
    const map = page([0, 0, 999, 999])
    expect(snapBox(map, [400, 400, 600, 600], { margin: 0, maxGrow: 0.05 })).toEqual([350, 350, 650, 650])
  })
  it("keeps the box when there is no ink in it", () => {
    expect(snapBox(page(), [100, 100, 300, 300])).toEqual([100, 100, 300, 300])
  })
})

describe("inkMap", () => {
  it("marks pixels much darker than the paper", () => {
    // Four pixels: paper, light shadow, gray line, black.
    const rgba = new Uint8ClampedArray([250, 250, 250, 255, 225, 225, 225, 255, 120, 120, 120, 255, 0, 0, 0, 255])
    expect([...inkMap(rgba, 4, 1).ink]).toEqual([0, 0, 1, 1])
  })
})
