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
