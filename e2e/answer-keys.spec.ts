import { expect, test } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

// A transcription-only scan: the review step opens from this draft without calling the AI.
const SET_ID = "7a2e5c10-4b3d-4e8f-9a1b-2c3d4e5f6a7b"
const draft = {
  version: 1,
  setId: SET_ID,
  savedAt: new Date().toISOString(),
  meta: { subject: "toan", grade: 3, kind: "de-thi" },
  title: "Đề chưa có đáp án",
  details: { topic: "Phép nhân", description: "", difficulty: 2, estimatedMinutes: 10 },
  items: [
    {
      question: { id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", type: "trac-nghiem", prompt: "7 × 8 = ?", options: ["54", "56", "63"], correctIndex: 0, points: 1, skills: ["Bảng nhân 7"], answerStatus: "missing" },
      confidence: 0.95,
      page: 1,
      reviewed: false,
    },
  ],
  files: [],
  scannedCount: 0,
}

test("a scan without answers saves as is and offers to solve them later", async ({ page }, testInfo) => {
  // Both projects share one seeded database: save the set only once.
  test.skip(testInfo.project.name !== "ipad", "runs once")
  const errors = trackPageErrors(page)
  await page.addInitScript((value) => localStorage.setItem("hh-scan-draft", value), JSON.stringify(draft))
  await open(page, "/parent/library/upload")
  await page.getByRole("button", { name: "Khôi phục" }).click()
  await expect(page.getByText("Chưa có đáp án").first()).toBeVisible()

  await page.getByRole("button", { name: "Lưu vào kho bài tập" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Đề chưa có đáp án" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Chưa có đáp án").first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Giải đáp án (1 câu)" })).toBeVisible()

  // The editor keeps it keyless until the parent picks an answer.
  await page.getByRole("button", { name: "Sửa câu 1" }).filter({ visible: true }).first().click()
  const sheet = page.getByRole("dialog", { name: "Sửa câu hỏi" })
  await expect(sheet.getByText("Nhập đáp án bên dưới, hoặc để trống")).toBeVisible()
  await expect(sheet.getByLabel("Lời giải (không bắt buộc)")).toBeVisible()

  // Exam questions can be worth more than the quick picks.
  await sheet.getByLabel("Điểm khác").fill("4")
  await sheet.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText("4 điểm", { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})
