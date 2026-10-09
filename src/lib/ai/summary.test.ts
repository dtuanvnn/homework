import { describe, expect, it } from "vitest"
import type { Report, SetSkills } from "@/lib/analytics"
import { candidateSets, summaryFacts, validateSummary } from "./summary"

const kpis = { completed: 4, average: 7.83, onTime: 75, retryGain: 1.25 }
const report: Report = {
  kpis,
  previous: { completed: 3, average: 7.2, onTime: null, retryGain: null },
  weekly: [{ weekStart: "2026-09-14T00:00:00.000Z", toan: 7.5 }, { weekStart: "2026-09-21T00:00:00.000Z", toan: 8, "tieng-viet": 9 }],
  subjectAverages: { toan: 7.8, "tieng-viet": 9 },
  skills: [
    { subject: "toan", skill: "Bảng nhân 7", accuracy: 50, wrongCount: 3, totalCount: 6, attempts: 2 },
    { subject: "toan", skill: "Đo lường", accuracy: 85, wrongCount: 1, totalCount: 4, attempts: 2 },
    { subject: "tieng-viet", skill: "Chính tả", accuracy: 95, wrongCount: 0, totalCount: 5, attempts: 2 },
  ],
  weakSkills: [],
  retries: [{ assignmentId: "x", title: "Bảng nhân", subject: "toan", first: 6, second: 8, gradedAt: "2026-09-20T00:00:00.000Z" }],
  activity: [],
  minutes: { toan: 12 },
}

const set = (id: string, extra: Partial<SetSkills> = {}): SetSkills => ({ id, title: id, subject: "toan", status: "san-sang", kind: "luyen-tap", skills: [], ...extra })

describe("candidateSets", () => {
  it("keeps ready sets of the selected subjects, weak-skill sets first, tests last", () => {
    const sets = [
      set("exam", { kind: "de-thi", skills: ["Bảng nhân 7"] }),
      set("other", { skills: ["Đo lường"] }),
      set("nhan7", { skills: ["Bảng nhân 7", "Đo lường"] }),
      set("draft", { status: "nhap", skills: ["Bảng nhân 7"] }),
      set("tv", { subject: "tieng-viet" }),
    ]
    expect(candidateSets(sets, report, ["toan"]).map((s) => s.id)).toEqual(["nhan7", "exam", "other"])
    expect(candidateSets(sets, report, ["toan"], 1).map((s) => s.id)).toEqual(["nhan7"])
  })
})

describe("summaryFacts", () => {
  it("sends compact rounded numbers with subject names", () => {
    const facts = summaryFacts({
      studentName: "An",
      grade: 3,
      period: { from: "2026-09-14", to: "2026-10-09" },
      subjects: ["toan", "tieng-viet"],
      report,
      feedback: [{ title: "Bài 1", subject: "toan", gradedAt: "2026-09-20T10:00:00.000Z", score: 8, feedback: "Con cẩn thận hơn nhé" }],
    })
    expect(facts.kpis).toEqual({ completedAssignments: 4, averageScore: 7.8, onTimeRatePercent: 75, averageRetryGain: 1.3 })
    expect(facts.subjectAverages).toEqual({ Toán: 7.8, "Tiếng Việt": 9 })
    expect(facts.weeklyAverages[1]).toEqual({ weekStart: "2026-09-21", Toán: 8, "Tiếng Việt": 9 })
    expect(facts.weakestSkills[0]).toMatchObject({ skill: "Bảng nhân 7", accuracyPercent: 50, answers: 6 })
    expect(facts.strongestSkills.map((s) => s.skill)).toEqual(["Chính tả", "Đo lường"])
    expect(facts.recentParentFeedback[0]).toMatchObject({ date: "2026-09-20", feedback: "Con cẩn thận hơn nhé" })
  })
})

describe("validateSummary", () => {
  const candidates = [set("s1", { subject: "toan" }), set("s2", { subject: "tieng-viet" })]
  it("keeps up to 3 steps, drops unknown and repeated set ids, adds the set's subject", () => {
    const res = validateSummary(
      {
        summary: "  An làm tốt.  ",
        steps: [
          { text: "Luyện bảng nhân 7", detail: "Đúng 50%", setId: "s1" },
          { text: "Ôn chính tả", detail: "…", setId: "made-up" },
          { text: "", detail: "empty", setId: null },
          { text: "Thêm bài nhân", detail: "…", setId: "s1" },
          { text: "Bước 4", detail: "…", setId: "s2" },
        ],
      },
      candidates,
      "2026-10-09T12:00:00.000Z",
    )
    expect(res.summary).toBe("An làm tốt.")
    expect(res.generatedAt).toBe("2026-10-09T12:00:00.000Z")
    expect(res.steps).toEqual([
      { text: "Luyện bảng nhân 7", detail: "Đúng 50%", setId: "s1", subject: "toan" },
      { text: "Ôn chính tả", detail: "…", setId: null, subject: null },
      { text: "Thêm bài nhân", detail: "…", setId: null, subject: "toan" },
    ])
  })
})
