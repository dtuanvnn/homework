import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import { hintsPrompt, leaksAnswer, validateHints, type HintItem } from "./hints"

const sa: Question = { id: "q1", type: "tra-loi-ngan", prompt: "Buổi sáng bán 285 kg, buổi chiều bán nhiều hơn 35 kg. Cả hai buổi bán bao nhiêu ki-lô-gam?", points: 1, skills: [], answer: "605 kg" }
const mc: Question = { id: "q2", type: "trac-nghiem", prompt: "7 × 8 = ?", points: 1, skills: [], options: ["54", "56", "63"], correctIndex: 1 }
const fill: Question = { id: "q3", type: "dien-cho-trong", prompt: "My family and I ___ (have) a great time.", points: 1, skills: [], answers: ["are having"] }

describe("leaksAnswer", () => {
  it("catches the answer, or its number alone", () => {
    expect(leaksAnswer("Đáp án là 605 kg nhé.", sa)).toBe(true)
    expect(leaksAnswer("Kết quả là 605.", sa)).toBe(true)
    expect(leaksAnswer("Em tìm buổi chiều trước: lấy 285 cộng 35, rồi cộng thêm buổi sáng.", sa)).toBe(false)
  })

  it("catches the correct option and missing words, not numbers inside other numbers", () => {
    expect(leaksAnswer("Em nhẩm lại bảng nhân 7 nhé, 7 × 8 bằng 56.", mc)).toBe(true)
    expect(leaksAnswer("Em đọc lại bảng nhân 7, đếm thêm 7 từ 7 × 7 = 49.", mc)).toBe(false)
    expect(leaksAnswer("Câu đang nói việc đang xảy ra, em dùng thì hiện tại tiếp diễn: am/is/are + V-ing.", fill)).toBe(false)
    expect(leaksAnswer("Em viết are having là đúng.", fill)).toBe(true)
  })
})

describe("validateHints", () => {
  const items: HintItem[] = [
    { id: "a1", question: sa, response: "570 kg" },
    { id: "a2", question: mc, response: 0 },
  ]

  it("keeps clean hints for known ids and drops leaks and strangers", () => {
    const out = validateHints(
      {
        hints: [
          { id: "a1", hint: "  Em quên tính số gạo buổi chiều rồi. Hãy tìm buổi chiều trước nhé!  " },
          { id: "a2", hint: "Đáp án là 56." },
          { id: "zz", hint: "Không có câu này" },
        ],
      },
      items,
    )
    expect(out).toEqual({ a1: "Em quên tính số gạo buổi chiều rồi. Hãy tìm buổi chiều trước nhé!" })
  })

  it("puts the child's answer and the hidden key in the prompt", () => {
    const text = hintsPrompt(items, "toan", 3)
    expect(text).toContain("Môn Toán, lớp 3.")
    expect(text).toContain("id: a1 (trả lời ngắn)")
    expect(text).toContain("Em trả lời: 570 kg")
    expect(text).toContain("Đáp án đúng (không được nói ra): 605 kg")
    expect(text).toContain("Các lựa chọn: 54 | 56 | 63")
  })
})
