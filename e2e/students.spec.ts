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
