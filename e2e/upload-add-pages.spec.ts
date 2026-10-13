import { expect, test } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

// An unsaved scan from an earlier visit, so the review step opens without calling the AI.
const draft = {
  version: 1,
  setId: "6f1f2a64-3c55-4a8e-9a43-1c2b3d4e5f60",
  savedAt: new Date().toISOString(),
  meta: { subject: "toan", grade: 3, kind: "luyen-tap" },
  title: "Phiếu đã quét",
  details: { topic: "Phép cộng", description: "", difficulty: 2, estimatedMinutes: 10 },
  items: [
    {
      question: { id: "q-1", type: "tra-loi-ngan", prompt: "Tính 12 + 30", answer: "42", points: 1, skills: ["Phép cộng"] },
      confidence: 0.95,
      page: 1,
      reviewed: false,
    },
  ],
  files: [
    {
      id: "tep-1",
      name: "trang-1.jpg",
      kind: "image",
      sizeKb: 300,
      uploaded: { path: "sets/6f1f2a64-3c55-4a8e-9a43-1c2b3d4e5f60/x-trang-1.jpg", name: "trang-1.jpg", kind: "image", sizeKb: 300 },
    },
  ],
  scannedCount: 1,
}

test("from review, the parent adds pages and can go back without losing questions", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.addInitScript((value) => localStorage.setItem("hh-scan-draft", value), JSON.stringify(draft))
  await open(page, "/parent/library/upload")
  await page.getByRole("button", { name: "Khôi phục" }).click()
  await expect(page.getByText("Tính 12 + 30").first()).toBeVisible()

  await page.getByRole("button", { name: "Thêm trang" }).click()
  await expect(page.getByRole("heading", { name: "Đã quét" })).toBeVisible()
  // Scanned pages can't be removed, and there is nothing new to scan yet.
  await expect(page.getByRole("button", { name: "Gỡ tệp trang-1.jpg" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Quét thêm trang" })).toBeDisabled()

  await page.locator('input[type="file"][multiple]').first().setInputFiles("samples/toán_ôn_tập_10_2.jpg")
  await expect(page.getByRole("heading", { name: "Trang mới" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Quét thêm 1 trang" })).toBeEnabled()

  await page.getByRole("button", { name: "Quay lại câu hỏi" }).click()
  await expect(page.getByText("Tính 12 + 30").first()).toBeVisible()
  expect(errors).toEqual([])
})
