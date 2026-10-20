import { describe, expect, it } from "vitest"
import { checkGroups, fullPrompt, groupBlocks, normalizeGroups, questionFigures } from "./question-groups"
import type { QuestionGroup } from "./types"

const g = (id: string, extra: Partial<QuestionGroup> = {}): QuestionGroup => ({ id, prompt: "Part 3 text", ...extra })
const items = [{ id: "a" }, { id: "b", group: g("x") }, { id: "c", group: g("x") }, { id: "d", group: g("y", { label: "Part 4" }) }]

describe("groupBlocks", () => {
  it("numbers câu by position and titles bài", () => {
    const b = groupBlocks(items)
    expect(b.map((x) => x.kind)).toEqual(["single", "group", "group"])
    expect(b[0]).toMatchObject({ kind: "single", number: 1, item: { id: "a" } })
    expect(b[1]).toMatchObject({ title: "Bài 1", order: 1, items: [{ number: 2 }, { number: 3 }] })
    expect(b[2]).toMatchObject({ title: "Part 4", order: 2, items: [{ number: 4 }] })
  })

  it("honours numberOf (filtered result lists)", () => {
    expect(groupBlocks([items[2]], () => 3)[0]).toMatchObject({ items: [{ number: 3 }] })
  })
})

describe("checkGroups", () => {
  it("requires the same layout on every câu of a bài", () => {
    expect(checkGroups([{ group: g("x", { layout: "doan-van" }) }, { group: g("x") }])).toMatch(/cùng đề chung/)
  })

  it("rejects a split bài", () => {
    expect(checkGroups([{ group: g("x") }, {}, { group: g("x") }])).toMatch(/liền nhau/)
    expect(checkGroups(items)).toBeNull()
  })

  it("rejects members that disagree", () => {
    expect(checkGroups([{ group: g("x") }, { group: g("x", { prompt: "other" }) }])).toMatch(/đề chung/)
  })
})

it("normalizeGroups copies the first member's group", () => {
  const out = normalizeGroups([{ group: g("x", { label: "Part 3" }) }, { group: g("x", { prompt: "other" }) }])
  expect(out[1].group).toEqual({ id: "x", label: "Part 3", prompt: "Part 3 text" })
  expect(checkGroups(out)).toBeNull()
})

it("fullPrompt prepends label and shared prompt", () => {
  expect(fullPrompt({ prompt: "David ___", group: g("x", { label: "Part 3" }) })).toBe("Part 3\nPart 3 text\nDavid ___")
  expect(fullPrompt({ prompt: "Q", group: { id: "x", prompt: "" } })).toBe("Q")
  expect(fullPrompt({ prompt: "Q" })).toBe("Q")
})

it("questionFigures puts the shared figure first and de-duplicates", () => {
  const img = { path: "p", width: 1, height: 1 }
  const own = { path: "o", width: 1, height: 1 }
  expect(questionFigures({ image: img, group: g("x", { image: img }) })).toEqual([img])
  expect(questionFigures({ image: own, group: g("x", { image: img }) })).toEqual([img, own])
  expect(questionFigures({})).toEqual([])
})

describe("split passage (blank câu)", () => {
  const passage: QuestionGroup = { id: "g", prompt: "They are ___ and ___. Lions ___." }
  const b = (k: number) => ({ group: passage, blank: k })

  it("accepts blank câu 1..N in order, plus ordinary câu", () => {
    expect(checkGroups([b(1), b(2), { group: passage }, b(3)])).toBeNull()
  })

  it("refuses a blank câu outside a bài", () => {
    expect(checkGroups([{ blank: 1 }])).toBe("Câu điền chỗ trống phải nằm trong một bài.")
  })

  it("refuses blank câu that don't match the ___ in the shared prompt", () => {
    expect(checkGroups([b(1), b(2)])).toBe("Số chỗ trống trong đề chung phải bằng số câu điền chỗ trống.")
    expect(checkGroups([b(1), b(3), b(2)])).toBe("Các câu điền chỗ trống phải theo đúng thứ tự.")
  })

  it("leaves bài without blank câu alone even if the prompt has ___", () => {
    expect(checkGroups([{ group: passage }])).toBeNull()
  })

  it("fullPrompt marks which blank a blank câu answers", () => {
    expect(fullPrompt({ prompt: "", group: { id: "g", label: "Part 2", prompt: "A ___ b ___." }, blank: 2 })).toBe("Part 2\nA ___ b [___].\nChỗ trống số 2")
  })
})
