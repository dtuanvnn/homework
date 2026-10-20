import { arrayMove } from "@dnd-kit/sortable"
import { describe, expect, it } from "vitest"
import { FIG, lifeInTheWild } from "./fixtures/life-in-the-wild"
import { checkGroups } from "./question-groups"
import {
  applyDrop,
  canRelease,
  createGroup,
  deleteGroup,
  joinGroup,
  releaseQuestion,
  setGroupPoints,
  suggestGroups,
  ungroup,
  updateGroup,
} from "./question-groups-edit"
import type { Question, QuestionGroup } from "./types"

const q = (id: string, prompt = id, group?: QuestionGroup): Question => ({
  id,
  type: "tu-luan",
  prompt,
  points: 1,
  skills: [],
  rubric: "",
  ...(group ? { group } : {}),
})
const G: QuestionGroup = { id: "g", prompt: "Shared" }
const ids = (qs: Question[]) => qs.map((x) => `${x.id}${x.group ? `:${x.group.id}` : ""}`)

describe("suggestGroups", () => {
  it("suggests the three bài of the reference set", () => {
    const { questions, groups } = suggestGroups(lifeInTheWild)
    expect(groups.map((g) => [g.title, g.from, g.to])).toEqual([
      ["Bài 1", 1, 9],
      ["Part 3", 11, 20],
      ["Part 4", 21, 25],
    ])
    expect(questions[0].prompt).toBe("Pandas are usually **kind and soft** animals.")
    expect(questions[0].group?.prompt).toMatch(/^Replace the bold words/)
    expect(questions[9].group).toBeUndefined()
    expect(questions[9].prompt).toBe(lifeInTheWild[9].prompt)
    expect(questions[10].group).toMatchObject({ label: "Part 3", prompt: "Complete the sentences with the correct subject or object pronoun." })
    expect(questions[20].group).toMatchObject({ label: "Part 4", prompt: "Read and write.", image: { path: FIG } })
    expect(questions[20].image).toBeUndefined()
    expect(questions[20].prompt).toBe("Write the sentences about Anna using the table in the picture.\nAnna ___")
    expect(checkGroups(questions)).toBeNull()
  })

  it("ungroup after suggest restores prompts and figures (label token aside)", () => {
    const { questions } = suggestGroups(lifeInTheWild)
    const back = [0, 10, 20].reduce((list, i) => ungroup(list, questions[i].group!.id), questions)
    expect(back[0].prompt).toBe(lifeInTheWild[0].prompt)
    expect(back[10].prompt).toBe(lifeInTheWild[10].prompt.replace(/^Part 3\. /, ""))
    expect(back[20].prompt).toBe(lifeInTheWild[20].prompt.replace(/^Part 4\. /, ""))
    expect(back[20].image?.path).toBe(FIG)
    expect(back.every((x) => !x.group)).toBe(true)
  })

  it("finds nothing when no câu share a first line", () => {
    expect(suggestGroups([q("a"), q("b")]).groups).toEqual([])
  })

  it("does not group a run whose câu would be left empty", () => {
    expect(suggestGroups([q("a", "Same"), q("b", "Same")]).groups).toEqual([])
  })

  it("leaves existing bài alone", () => {
    const qs = [q("a", "X\n1", G), q("b", "X\n2", G), q("c", "X\n3"), q("d", "X\n4")]
    const { questions, groups } = suggestGroups(qs)
    expect(groups.map((g) => [g.from, g.to])).toEqual([[3, 4]])
    expect(questions[0].group).toBe(G)
  })

  it("keeps a label-only bài when nothing follows the label", () => {
    const { questions } = suggestGroups([q("a", "Bài 2:\n5 + 3 = ?"), q("b", "Bài 2:\n6 + 1 = ?")])
    expect(questions[0].group).toMatchObject({ label: "Bài 2", prompt: "" })
    expect(questions[0].prompt).toBe("5 + 3 = ?")
  })
})

describe("manual bài editing", () => {
  it("createGroup makes a one-câu bài with an empty prompt", () => {
    const out = createGroup([q("a"), q("b")], "b")
    expect(out[1].group).toMatchObject({ prompt: "" })
    expect(out[0].group).toBeUndefined()
  })

  it("joinGroup joins the neighbour's bài", () => {
    const out = joinGroup([q("a", "a", G), q("b")], "b", "up")
    expect(out[1].group).toEqual(G)
  })

  it("joinGroup with a standalone neighbour forms a new bài with an empty prompt", () => {
    const out = joinGroup([q("a"), q("b")], "a", "down")
    expect(out[0].group?.id).toBe(out[1].group?.id)
    expect(out[0].group?.prompt).toBe("")
  })

  it("releaseQuestion refuses a middle câu and releases the last losslessly", () => {
    const img = { path: FIG, width: 1, height: 1 }
    const g = { ...G, image: img }
    const qs = [q("a", "1", g), q("b", "2", g), q("c", "3", g)]
    expect(canRelease(qs, "b")).toBe(false)
    expect(releaseQuestion(qs, "b")).toBe(qs)
    expect(canRelease(qs, "c")).toBe(true)
    const out = releaseQuestion(qs, "c")
    expect(out[2]).toMatchObject({ prompt: "Shared\n3", image: img })
    expect(out[2].group).toBeUndefined()
    expect(checkGroups(out)).toBeNull()
  })

  it("updateGroup writes the shared part to every câu", () => {
    const out = updateGroup([q("a", "1", G), q("b", "2", G)], "g", { label: "Part 1", prompt: "New" })
    expect(out.map((x) => x.group)).toEqual([{ id: "g", label: "Part 1", prompt: "New" }, { id: "g", label: "Part 1", prompt: "New" }])
  })

  it("setGroupPoints splits exactly", () => {
    const out = setGroupPoints([q("a", "1", G), q("b", "2", G), q("c", "3", G), q("d")], "g", 1)
    expect(out.slice(0, 3).map((x) => x.points)).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(out[3].points).toBe(1)
  })

  it("deleteGroup removes the bài and its câu", () => {
    expect(ids(deleteGroup([q("a"), q("b", "b", G), q("c", "c", G)], "g"))).toEqual(["a"])
  })
})

describe("applyDrop", () => {
  const H: QuestionGroup = { id: "h", prompt: "Other" }
  const drop = (qs: Question[], from: number, to: number) => applyDrop(arrayMove(qs, from, to), qs[from].id)

  it("keeps a câu moved to the last slot of its own bài", () => {
    const qs = [q("b", "b", G), q("c", "c", G), q("d", "d", G), q("e")]
    expect(ids(drop(qs, 0, 2))).toEqual(["c:g", "d:g", "b:g", "e"])
  })

  it("joins a bài when dropped between two of its câu", () => {
    const qs = [q("a"), q("b", "b", G), q("c", "c", G)]
    const out = drop(qs, 0, 1)
    expect(ids(out)).toEqual(["b:g", "a:g", "c:g"])
    expect(out[1].group).toEqual(G)
  })

  it("moves a câu from one bài into another, releasing it first", () => {
    const qs = [q("a", "1", H), q("b", "2", H), q("c", "3", G), q("d", "4", G)]
    const out = drop(qs, 0, 2)
    expect(ids(out)).toEqual(["b:h", "c:g", "a:g", "d:g"])
    expect(out[2].prompt).toBe("Other\n1")
  })

  it("releases a câu dragged away from its bài, losslessly", () => {
    const qs = [q("a", "1", G), q("b", "2", G), q("c"), q("d")]
    const out = drop(qs, 0, 3)
    expect(ids(out)).toEqual(["b:g", "c", "d", "a"])
    expect(out[3].prompt).toBe("Shared\n1")
    expect(checkGroups(out)).toBeNull()
  })

  it("leaves standalone moves alone", () => {
    const qs = [q("a"), q("b"), q("c")]
    expect(ids(drop(qs, 0, 2))).toEqual(["b", "c", "a"])
  })
})
