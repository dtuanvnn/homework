import { expect, test } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * Multi-child behaviour on the seed household: Minh An (grade 3, most demo
 * data) and Bảo Ngọc (grade 5). "Chính tả: Mùa thu của em", "Unit 5: My family"
 * and "Đọc hiểu: Cậu bé thông minh" are assigned to Minh An only.
 */

test("a child only sees their own work", async ({ page }) => {
  const errors = trackPageErrors(page)
  await open(page, "/student/results")
  await page.getByTestId("result-item").first().click()
  await page.waitForURL(/\/student\/results\/.+/)
  const anResult = page.url()

  await page.goto("/pin?role=student")
  await page.getByRole("button", { name: "Bảo Ngọc" }).click()
  await page.waitForURL((u) => u.pathname === "/student")
  await open(page, "/student/results", "Bảo Ngọc")
  await expect(page.getByText("Chính tả: Mùa thu của em")).toHaveCount(0)
  await expect(page.getByText("Chu vi hình chữ nhật, hình vuông")).toHaveCount(1)

  const response = await page.goto(anResult)
  expect(response?.status()).toBe(404)
  expect(errors).toEqual([])
})

test("parent switches the viewing child from the header", async ({ page }) => {
  await open(page, "/parent/grading")
  await expect(page.getByText("Đọc hiểu: Cậu bé thông minh").first()).toBeVisible()
  await page.getByRole("button", { name: /Đang xem: Minh An/ }).filter({ visible: true }).click()
  await page.getByRole("menuitemradio", { name: /Bảo Ngọc/ }).click()
  await expect(page.getByRole("button", { name: /Đang xem: Bảo Ngọc/ }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Đọc hiểu: Cậu bé thông minh")).toHaveCount(0)
})

test("parent adds a child with a PIN, who then signs in; archive and restore", async ({ page }) => {
  await open(page, "/parent/students")
  await page.getByRole("button", { name: "Thêm học sinh" }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByRole("button", { name: "🐰" }).click()
  await sheet.getByLabel("Tên", { exact: true }).fill("Gia Huy")
  await sheet.getByRole("radio", { name: "Lớp 1" }).click()
  await sheet.getByRole("textbox", { name: "Mã PIN" }).fill("2468")
  await sheet.getByRole("button", { name: "Thêm học sinh" }).click()
  const card = page.getByTestId("student-card").filter({ hasText: "Gia Huy" })
  await expect(card).toContainText("Lớp 1")
  await expect(card).toContainText("Có PIN")

  await page.goto("/pin?role=student")
  await page.getByRole("button", { name: "Gia Huy" }).first().click()
  await page.getByRole("textbox", { name: "Mã PIN" }).fill("2468")
  await page.getByRole("button", { name: "Vào học" }).click()
  await page.waitForURL((u) => u.pathname === "/student")

  await open(page, "/parent/students")
  await page.getByTestId("student-card").filter({ hasText: "Gia Huy" }).getByRole("button").first().click()
  await page.waitForURL(/\/parent\/students\/.+/)
  await page.getByRole("button", { name: "Lưu trữ học sinh" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Lưu trữ" }).click()
  await page.waitForURL(/\/parent\/students$/)
  await page.getByRole("button", { name: /Đã lưu trữ/ }).click()
  await page.getByTestId("student-card").filter({ hasText: "Gia Huy" }).getByRole("button", { name: "Khôi phục" }).click()
  await expect(page.getByRole("button", { name: "Sửa Gia Huy" }).first()).toBeVisible()
})

test("promoting keeps stars and adds a school year", async ({ page }) => {
  await open(page, "/parent/students")
  const card = page.getByTestId("student-card").filter({ hasText: "Minh An" })
  const starsBefore = await card.getByTestId("student-stars").textContent()
  await card.getByRole("button").first().click()
  await page.waitForURL(/\/parent\/students\/.+/)
  await expect(page.getByTestId("year-row")).toHaveCount(2)
  await page.getByRole("button", { name: "Lên lớp" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toContainText("Lớp 3")
  await sheet.getByLabel("Tên lớp").fill("4C1")
  await sheet.getByRole("button", { name: /Lên lớp 🎉/ }).click()
  await expect(page.getByTestId("year-row")).toHaveCount(3)
  await expect(page.getByTestId("year-row").first()).toContainText("Lớp 4 · 4C1")
  await open(page, "/parent/students")
  await expect(page.getByTestId("student-card").filter({ hasText: "Minh An" }).getByTestId("student-stars")).toHaveText(starsBefore!)
})
