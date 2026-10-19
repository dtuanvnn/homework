import { describe, expect, it } from "vitest"
import { buildExplainPrompt, EXPLAIN_SYSTEM_PROMPT, explainInputSchema, explanationLeaks, mapExplanations } from "./flashcard"

describe("explanationLeaks", () => {
  it("catches the word and its forms", () => {
    expect(explanationLeaks("rainforest", "A rainforest is a wet forest.")).toBe(true)
    expect(explanationLeaks("burrow", "Rabbits burrowed under the ground.")).toBe(true)
    expect(explanationLeaks("Nest", "Birds lay eggs in a NEST.")).toBe(true)
    expect(explanationLeaks("bees", "A bee makes honey.")).toBe(true)
  })

  it("checks each part of a multi-word item", () => {
    expect(explanationLeaks("polar bear", "A big white bear that lives in the cold.")).toBe(true)
  })

  it("lets unrelated explanations through", () => {
    expect(explanationLeaks("nest", "A bird's home made of twigs.")).toBe(false)
    expect(explanationLeaks("ant", "A tiny insect that lives in big groups.")).toBe(false)
  })
})

describe("mapExplanations", () => {
  it("matches by word, keeps the parent's spelling and drops leaking or empty ones", () => {
    const out = mapExplanations(["nest", "hive", "pond"], {
      items: [
        { word: "Hive", definition: " A home where bees make honey. " },
        { word: "nest", definition: "A nest of twigs." },
        { word: "pond", definition: "  " },
      ],
    })
    expect(out).toEqual({ hive: "A home where bees make honey." })
  })

  it("falls back to position when the model changed a word", () => {
    expect(mapExplanations(["colour"], { items: [{ word: "color", definition: "Red, blue or green." }] })).toEqual({ colour: "Red, blue or green." })
  })

  it("drops overlong explanations", () => {
    expect(mapExplanations(["ocean"], { items: [{ word: "ocean", definition: "x ".repeat(200) }] })).toEqual({})
  })
})

describe("buildExplainPrompt", () => {
  it("lists the words with topic and grade", () => {
    const prompt = buildExplainPrompt(explainInputSchema.parse({ words: ["habitat", "polar bear"], topic: "Where Do Animals Live?", grade: 3 }))
    expect(prompt).toContain("1. habitat")
    expect(prompt).toContain("2. polar bear")
    expect(prompt).toContain("Where Do Animals Live?")
    expect(prompt).toContain("Grade: 3")
  })

  it("asks for new wording when rewriting", () => {
    const prompt = buildExplainPrompt(explainInputSchema.parse({ words: ["nest"], topic: "", grade: 2, avoid: { nest: "A bird's home." } }))
    expect(prompt).toContain("A bird's home.")
    expect(prompt).toMatch(/different/i)
  })

  it("system prompt forbids the word itself and Vietnamese", () => {
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/never contain the word/i)
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/no Vietnamese/i)
  })
})
