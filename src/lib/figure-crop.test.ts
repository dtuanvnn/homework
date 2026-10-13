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
    expect(cropRect([100, 200, 500, 600], 2000, 1000)).toEqual({ x: 140, y: 170, width: 920, height: 460 })
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
