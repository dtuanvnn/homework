import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import RichText from "@/components/question/RichText"
import { giantRatScan } from "@/lib/fixtures/giant-rat-scan"
import { editedQuestionSchema } from "@/lib/question-schema"
import { toTakeQuestion } from "@/lib/views/student"
import { scanResponseSchema, toScanResult } from "./scan"
import { leaksAnswer } from "./hints"

describe("scanned inline formatting", () => {
  it("survives scan conversion, editor validation and student/offline question shaping", () => {
    const res = scanResponseSchema.parse({
      ...giantRatScan,
      groups: [{ ...giantRatScan.groups[0], prompt: "**Choose** the ==word== with the <u>underlined</u> sound.", layout: "none", box: [] }],
      questions: [{
        ...giantRatScan.questions[0],
        type: "trac-nghiem",
        prompt: "Find the **different** sound.",
        options: ["ch<u>oo</u>se", "b<u>oo</u>k"],
      }],
    })
    const result = toScanResult(res, { subject: "tieng-anh", grade: 3, kind: "luyen-tap" }, 1, () => "q1")
    const question = editedQuestionSchema.parse(result.items[0].question)
    const take = toTakeQuestion(question)
    expect(take.prompt).toBe("Find the **different** sound.")
    expect(take.group?.prompt).toContain("<u>underlined</u>")
    if (take.type !== "trac-nghiem") throw new Error("Expected multiple choice")
    expect(take.options).toEqual(["ch<u>oo</u>se", "b<u>oo</u>k"])
    expect(renderToStaticMarkup(createElement(RichText, { text: take.options[0] }))).toMatch(/<u[^>]*>oo<\/u>/)
    expect("correctIndex" in take).toBe(false)
  })

  it("still blocks a hint leaking an option whose spelling is split by formatting", () => {
    const question = {
      id: "q", type: "trac-nghiem" as const, prompt: "Which word is different?", points: 1, skills: [],
      options: ["ch<u>oo</u>se", "book"], correctIndex: 0,
    }
    expect(leaksAnswer("The answer is choose.", question)).toBe(true)
    expect(leaksAnswer("The answer is ch<u>oo</u>se.", question)).toBe(true)
    expect(leaksAnswer("Listen to the vowel sound.", question)).toBe(false)
  })
})
