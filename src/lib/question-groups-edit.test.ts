import { arrayMove } from "@dnd-kit/sortable"
import { describe, expect, it } from "vitest"
import { FIG, lifeInTheWild } from "./fixtures/life-in-the-wild"
import { checkGroups } from "./question-groups"
import {
  applyDrop,
  canApplyMove,
  canRelease,
  canSplitBlanks,
  createGroup,
  deleteGroup,
  hasBlanks,
  isBlankGroup,
  joinGroup,
  mergeBlanks,
  releaseQuestion,
  setGroupPoints,
  splitBlanks,
  suggestGroups,
  ungroup,
  updateGroup,
} from "./question-groups-edit"
import type { Question, QuestionGroup, ShortAnswerQuestion } from "./types"

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
  it("suggests the bài of the reference set and splits its passage", () => {
    const { questions, groups } = suggestGroups(lifeInTheWild)
    expect(groups.map((g) => [g.title, g.from, g.to, g.blanks])).toEqual([
      ["Bài 1", 1, 9, undefined],
      ["Bài 2", 10, 12, 3],
      ["Part 3", 13, 22, undefined],
      ["Part 4", 23, 27, undefined],
    ])
    expect(questions[0].prompt).toBe("Pandas are usually **kind and soft** animals.")
    expect(questions[0].group?.prompt).toMatch(/^Replace the bold words/)
    expect(questions[9]).toMatchObject({ type: "tra-loi-ngan", blank: 1, prompt: "", points: 1 })
    expect(questions[9].group?.prompt).toBe(lifeInTheWild[9].prompt)
    expect(questions[12].group).toMatchObject({ label: "Part 3", prompt: "Complete the sentences with the correct subject or object pronoun." })
    expect(questions.filter((x) => x.group?.label === "Part 3").every((x) => x.type === "dien-cho-trong")).toBe(true)
    expect(questions[22].group).toMatchObject({ label: "Part 4", prompt: "Read and write.", image: { path: FIG } })
    expect(questions[22].image).toBeUndefined()
    expect(questions[22].prompt).toBe("Write the sentences about Anna using the table in the picture.\nAnna ___")
    expect(checkGroups(questions)).toBeNull()
  })

  it("ungroup after suggest restores prompts and figures (label token aside)", () => {
    const { questions } = suggestGroups(lifeInTheWild)
    const back = [0, 12, 22].reduce((list, i) => ungroup(list, questions[i].group!.id), questions)
    expect(back[0].prompt).toBe(lifeInTheWild[0].prompt)
    expect(back[12].prompt).toBe(lifeInTheWild[10].prompt.replace(/^Part 3\. /, ""))
    expect(back[22].prompt).toBe(lifeInTheWild[20].prompt.replace(/^Part 4\. /, ""))
    expect(back[22].image?.path).toBe(FIG)
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

describe("split passage blanks", () => {
  const keyed: Question = {
    id: "p",
    type: "dien-cho-trong",
    prompt: "Part 2. Fill in.\nThey are ___ and ___. Lions ___.",
    answers: ["gentle", "fierce", "hunt"],
    points: 9,
    skills: ["vocab"],
    solution: "S",
    image: { path: FIG, width: 1, height: 1 },
  }
  const short = (x: Question) => x as ShortAnswerQuestion

  it("splits a passage into one short answer per blank", () => {
    const out = splitBlanks([keyed], "p")
    expect(out.map((x) => x.type)).toEqual(["tra-loi-ngan", "tra-loi-ngan", "tra-loi-ngan"])
    expect(out.map((x) => short(x).answer)).toEqual(["gentle", "fierce", "hunt"])
    expect(out.map((x) => short(x).blank)).toEqual([1, 2, 3])
    expect(out.every((x) => x.points === 1 && x.prompt === "" && x.id !== "p" && x.skills[0] === "vocab")).toBe(true)
    expect(new Set(out.map((x) => x.id)).size).toBe(3)
    expect(out[0].group).toMatchObject({ label: "Part 2", prompt: "Fill in.\nThey are ___ and ___. Lions ___.", image: keyed.image })
    expect(out[0].image).toBeUndefined()
    expect(out[0].solution).toBe("S")
    expect(out[1].solution).toBeUndefined()
    expect(checkGroups(out)).toBeNull()
  })

  it("pads missing keys and drops extra ones", () => {
    const out = splitBlanks([{ ...keyed, answers: ["gentle"] }], "p")
    expect(out.map((x) => x.answerStatus)).toEqual([undefined, "missing", "missing"])
    expect(checkGroups(out)).toBeNull()
    expect(splitBlanks([{ ...keyed, answers: ["a", "b", "c", "d"] }], "p")).toHaveLength(3)
  })

  it("refuses a 1-blank question or one already in a bài", () => {
    const one: Question[] = [{ ...keyed, prompt: "A ___." }]
    expect(splitBlanks(one, "p")).toBe(one)
    const inBai: Question[] = [{ ...keyed, group: G }]
    expect(canSplitBlanks(inBai, "p")).toBe(false)
    expect(splitBlanks(inBai, "p")).toBe(inBai)
    expect(canSplitBlanks([keyed], "p")).toBe(true)
    expect(canSplitBlanks([keyed], "p", 4)).toBe(false)
  })

  it("merge undoes split", () => {
    const split = splitBlanks([q("a"), keyed, q("b")], "p")
    expect(isBlankGroup(split, split[1].group!.id)).toBe(true)
    const merged = mergeBlanks(split, split[1].group!.id)
    expect(ids(merged)).toEqual(["a", merged[1].id, "b"])
    expect(merged[1]).toMatchObject({ type: "dien-cho-trong", prompt: keyed.prompt, answers: keyed.answers, points: 3, skills: ["vocab"], solution: "S", image: keyed.image })
    expect(merged[1].group).toBeUndefined()
    expect(merged[1].answerStatus).toBeUndefined()
  })

  it("merge takes the weakest answerStatus and keeps notes", () => {
    const split = splitBlanks([keyed], "p")
    const gid = split[0].group!.id
    const status = (a: Question["answerStatus"], b: Question["answerStatus"]) =>
      mergeBlanks([{ ...split[0], answerStatus: a }, { ...split[1], answerStatus: b }, split[2]], gid)[0].answerStatus
    expect(status("ai", "missing")).toBe("missing")
    expect(status("ai", "ai-check")).toBe("ai-check")
    expect(status("ai", undefined)).toBe("ai")
    const noted = mergeBlanks([split[0], { ...split[1], prompt: "x" }, split[2]], gid)[0]
    expect(noted.solution).toBe("S\n(2) x")
  })

  it("merging a bài with ordinary câu among its blanks puts them after the passage", () => {
    const split = splitBlanks([keyed], "p")
    const gid = split[0].group!.id
    const mixed = [split[0], { ...q("z"), group: split[0].group }, split[1], split[2]]
    expect(hasBlanks(mixed, gid)).toBe(true)
    expect(isBlankGroup(mixed, gid)).toBe(false)
    const out = mergeBlanks(mixed, gid)
    expect(out.map((x) => x.type)).toEqual(["dien-cho-trong", "tu-luan"])
    expect(out[0]).toMatchObject({ answers: keyed.answers, points: 3 })
    expect(out[1].group).toBeUndefined()
    expect(checkGroups(out)).toBeNull()
  })

  it("pads blanks without a key as missing even after AI solved the passage", () => {
    const out = splitBlanks([{ ...keyed, answers: ["gentle"], answerStatus: "ai" }], "p")
    expect(out.map((x) => x.answerStatus)).toEqual(["ai", "missing", "missing"])
  })

  it("refuses moves that break blank order but allows ordinary câu among them", () => {
    const other: Question = { id: "x", type: "tra-loi-ngan", prompt: "Q", answer: "a", points: 1, skills: [] }
    const s = splitBlanks([keyed, other], "p")
    expect(canApplyMove(s)).toBe(true)
    expect(canApplyMove([s[0], s[2], s[1], s[3]])).toBe(false)
    expect(canApplyMove([s[0], { ...s[3], group: s[0].group }, s[1], s[2]])).toBe(true)
    expect(canApplyMove([s[1], s[2], s[3], { ...s[0], group: undefined }])).toBe(false)
  })
})
