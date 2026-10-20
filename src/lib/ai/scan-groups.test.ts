import { describe, expect, it } from "vitest"
import { parsePassage } from "@/lib/passage"
import { checkGroups } from "@/lib/question-groups"
import type { Question, QuestionGroup, ShortAnswerQuestion } from "@/lib/types"
import { finalizeScanGroups, joinPages } from "./scan-groups"
import type { ScannedQuestion, ScanPart } from "./scan"

let n = 0
const essay = (prompt: string, group?: QuestionGroup): Question => ({ id: `q${++n}`, type: "tu-luan", prompt, rubric: "", points: 1, skills: [], ...(group ? { group } : {}) })
const cloze = (prompt: string, answers: string[], group?: QuestionGroup): Question => ({
  id: `q${++n}`,
  type: "dien-cho-trong",
  prompt,
  answers,
  points: answers.length,
  skills: [],
  ...(group ? { group } : {}),
})
const item = (question: Question, page: number, extra: Partial<ScannedQuestion> = {}): ScannedQuestion => ({ question, confidence: 0.9, page, ...extra })
const placeholder = (group: QuestionGroup, page: number): ScannedQuestion =>
  item({ id: `q${++n}`, type: "tu-luan", prompt: "", rubric: "", points: 0, skills: [], group }, page, { placeholder: true, confidence: 1 })

const part = (items: ScannedQuestion[], extra: Partial<ScanPart> = {}): ScanPart => ({
  title: "t",
  topic: "",
  description: "",
  difficulty: 3,
  estimatedMinutes: 10,
  items,
  ...extra,
})
const tailOf = (items: ScannedQuestion[]): ScanPart["tail"] => {
  const g = [...items].reverse().find((i) => i.question.group)?.question.group
  return g ? { groupId: g.id, empty: items.filter((i) => i.question.group?.id === g.id).every((i) => i.placeholder) } : undefined
}
const groupIds = (items: ScannedQuestion[]) => items.map((i) => i.question.group?.id ?? "-")

describe("joinPages", () => {
  it("joins a bài continued on the next page", () => {
    const a: QuestionGroup = { id: "a", prompt: "First half.", layout: "doan-van" }
    const b: QuestionGroup = { id: "b", prompt: "Second half.", layout: "doan-van" }
    const p1 = [item(essay("Q1", a), 1)]
    const p2 = [item(essay("Q2", b), 2), item(essay("Q3"), 2)]
    const out = joinPages([part(p1, { tail: tailOf(p1) }), part(p2, { lead: { groupId: "b", continues: true, midParagraph: false }, tail: tailOf(p2) })])
    expect(groupIds(out)).toEqual(["a", "a", "-"])
    expect(out[0].question.group?.prompt).toBe("First half.\nSecond half.")
    expect(out[1].question.group).toEqual(out[0].question.group)
    expect(checkGroups(out.map((i) => i.question))).toBeNull()
  })

  it("joins a paragraph cut by the page break into one paragraph", () => {
    const a: QuestionGroup = { id: "a", prompt: "# Title\nThe capybara lives near", layout: "doan-van" }
    const b: QuestionGroup = { id: "b", prompt: "fresh water.", layout: "doan-van" }
    const p1 = [item(essay("Q1", a), 1)]
    const out = joinPages([part(p1, { tail: tailOf(p1) }), part([item(essay("Q2", b), 2)], { lead: { groupId: "b", continues: true, midParagraph: true } })])
    expect(out[0].question.group?.prompt).toBe("# Title\nThe capybara lives near fresh water.")
    expect(parsePassage(out[0].question.group!.prompt, "doan-van").map((x) => x.kind)).toEqual(["title", "paragraph"])
  })

  it("does not join bài whose labels differ", () => {
    const a: QuestionGroup = { id: "a", label: "Part 2", prompt: "x" }
    const b: QuestionGroup = { id: "b", label: "Part 3", prompt: "y" }
    const p1 = [item(essay("Q1", a), 1)]
    const out = joinPages([part(p1, { tail: tailOf(p1) }), part([item(essay("Q2", b), 2)], { lead: { groupId: "b", continues: true, label: "Part 3", midParagraph: false } })])
    expect(groupIds(out)).toEqual(["a", "b"])
  })

  it("never joins past an adjacent page", () => {
    const a: QuestionGroup = { id: "a", prompt: "x" }
    const c: QuestionGroup = { id: "c", prompt: "z" }
    const p1 = [item(essay("Q1", a), 1)]
    const p2 = [item(essay("Q2"), 2)]
    const out = joinPages([part(p1, { tail: tailOf(p1) }), part(p2), part([item(essay("Q3", c), 3)], { lead: { groupId: "c", continues: true, midParagraph: false } })])
    expect(groupIds(out)).toEqual(["a", "-", "c"])
  })

  it("merges a cloze passage cut across pages before it is split", () => {
    const a: QuestionGroup = { id: "a", prompt: "**Fill in.**", layout: "doan-van" }
    const b: QuestionGroup = { id: "b", prompt: "", layout: "doan-van" }
    const p1 = [item(cloze("One ___ two ___ three ___ four ___ and", ["1", "2", "3", "4"], a), 1)]
    const p2 = [item(cloze("then ___ five ___ six ___.", ["5", "6", "7"], b), 2)]
    const joined = joinPages([part(p1, { tail: tailOf(p1) }), part(p2, { lead: { groupId: "b", continues: true, midParagraph: true } })])
    expect(joined).toHaveLength(1)
    const out = finalizeScanGroups(joined)
    expect(out).toHaveLength(7)
    expect(out.map((i) => (i.question as ShortAnswerQuestion).blank)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(out.map((i) => (i.question as ShortAnswerQuestion).answer)).toEqual(["1", "2", "3", "4", "5", "6", "7"])
    expect(out[0].question.group?.prompt).toBe("**Fill in.**\nOne ___ two ___ three ___ four ___ and then ___ five ___ six ___.")
    expect(checkGroups(out.map((i) => i.question))).toBeNull()
  })

  it("gives an empty passage the câu that open the next page", () => {
    const a: QuestionGroup = { id: "a", prompt: "A passage", layout: "doan-van" }
    const p1 = [item(essay("Q0"), 1), placeholder(a, 1)]
    const out = joinPages([part(p1, { tail: tailOf(p1) }), part([item(essay("Q1"), 2), item(essay("Q2"), 2), item(essay("Q3", { id: "z", prompt: "other" }), 2)])])
    expect(out.some((i) => i.placeholder)).toBe(false)
    expect(groupIds(out)).toEqual(["-", "a", "a", "z"])
  })

  it("keeps an empty passage on the last page as a placeholder", () => {
    const a: QuestionGroup = { id: "a", prompt: "A passage", layout: "doan-van" }
    const p1 = [item(essay("Q0"), 1), placeholder(a, 1)]
    const out = joinPages([part(p1, { tail: tailOf(p1) })])
    expect(out.at(-1)?.placeholder).toBe(true)
  })

  it("fills an empty passage from the continued bài of the next page", () => {
    const a: QuestionGroup = { id: "a", prompt: "Story text", layout: "doan-van" }
    const b: QuestionGroup = { id: "b", prompt: "", layout: "doan-van" }
    const p1 = [placeholder(a, 1)]
    const out = joinPages([part(p1, { tail: tailOf(p1) }), part([item(essay("Q1", b), 2)], { lead: { groupId: "b", continues: true, midParagraph: false } })])
    expect(out).toHaveLength(1)
    expect(out[0].placeholder).toBeUndefined()
    expect(out[0].question.group).toMatchObject({ id: "a", prompt: "Story text" })
  })
})

describe("finalizeScanGroups", () => {
  it("releases a bài the AI split into two runs", () => {
    const a: QuestionGroup = { id: "a", prompt: "Shared" }
    const out = finalizeScanGroups([item(essay("Q1", a), 1), item(essay("Q2"), 1), item(essay("Q3", a), 1)])
    expect(out.every((i) => !i.question.group)).toBe(true)
    expect(out[0].question.prompt).toBe("Shared\nQ1")
    expect(checkGroups(out.map((i) => i.question))).toBeNull()
  })

  it("splits a standalone cloze passage into a formatted bài", () => {
    const out = finalizeScanGroups([item(cloze("I ___ a ___ cat ___.", ["have", "big", "too"]), 1, { figure: { page: 1, box: [1, 2, 3, 4] } })])
    expect(out).toHaveLength(3)
    expect(out[0].question.group?.layout).toBe("doan-van")
    expect(out.every((i) => i.page === 1 && i.groupFigure?.box.join() === "1,2,3,4" && !i.figure)).toBe(true)
  })

  it("keeps item details on câu it does not touch", () => {
    const a: QuestionGroup = { id: "a", prompt: "Shared" }
    const items = [item(essay("Q1", a), 2, { note: "mờ", groupFigure: { page: 2, box: [0, 0, 9, 9] } }), item(essay("Q2", a), 2)]
    const out = finalizeScanGroups(items)
    expect(out[0]).toMatchObject({ page: 2, note: "mờ" })
    expect(out[1].question.group).toEqual(out[0].question.group)
  })
})
