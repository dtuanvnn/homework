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
  await expect(page.locator("html")).toHaveAttribute("data-mode", "student")
  // Verify cookie switch by checking her graded work on results page
  await page.goto("/student/results")
  await expect(page.getByText("Chu vi hình chữ nhật, hình vuông")).toBeVisible()
  // Navigate to assignments and verify Minh An's draft doesn't appear
  await page.goto("/student/assignments")
  await expect(page.getByText("Chính tả: Mùa thu của em")).toHaveCount(0)

  // Check errors before attempting the 404 (which may cause a page error on iPhone)
  expect(errors).toEqual([])
  const response = await page.goto(anResult)
  expect(response?.status()).toBe(404)
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
  await page.getByTestId("year-row").first().waitFor()
  const before = await page.getByTestId("year-row").count()
  await page.getByRole("button", { name: "Lên lớp" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toContainText("→")
  await sheet.getByLabel("Tên lớp").fill("4C1")
  await sheet.getByRole("button", { name: /Lên lớp 🎉/ }).click()
  await expect(page.getByTestId("year-row")).toHaveCount(before + 1)
  await expect(page.getByTestId("year-row").first()).toContainText("4C1")
  await open(page, "/parent/students")
  await expect(page.getByTestId("student-card").filter({ hasText: "Minh An" }).getByTestId("student-stars")).toHaveText(starsBefore!)
})

test("a locked child sees the lock screen until unlocked", async ({ browser }, testInfo) => {
  // Two devices: separate cookie jars.
  const parentCtx = await browser.newContext(testInfo.project.use)
  const childCtx = await browser.newContext(testInfo.project.use)
  const p = await parentCtx.newPage()
  const c = await childCtx.newPage()
  let unlocked = false
  try {
    await open(c, "/student")
    await open(p, "/parent/students")
    await p.getByTestId("student-card").filter({ hasText: "Minh An" }).getByRole("button").first().click()
    await p.getByRole("button", { name: "Khoá tài khoản" }).click()
    const sheet = p.getByRole("dialog")
    await sheet.getByRole("radio", { name: "Đến khi mở" }).click()
    await sheet.getByLabel("Lời nhắn").fill("Nghỉ ngơi chút nhé")
    await sheet.getByRole("button", { name: "Khoá", exact: true }).click()
    await expect(p.getByRole("button", { name: "Mở khoá" })).toBeVisible()

    await c.reload()
    await expect(c.getByText("Tài khoản đang tạm khoá")).toBeVisible()
    await expect(c.getByText("Nghỉ ngơi chút nhé")).toBeVisible()

    await p.getByRole("button", { name: "Mở khoá" }).click()
    await expect(p.getByRole("button", { name: "Khoá tài khoản" })).toBeVisible()
    unlocked = true
    await c.reload()
    await expect(c.locator("html")).toHaveAttribute("data-mode", "student")
    await expect(c.getByText("Tài khoản đang tạm khoá")).toHaveCount(0)
  } finally {
    // Ensure Minh An is unlocked for subsequent tests; the button may still be on its way after a slow refresh.
    if (!unlocked) await p.getByRole("button", { name: "Mở khoá" }).click({ timeout: 15_000 }).catch(() => {})
    await parentCtx.close()
    await childCtx.close()
  }
})

test("one set assigned to both children reaches both", async ({ page }) => {
  await open(page, "/parent/schedule")
  await page.getByRole("button", { name: /^Giao bài( mới)?$/ }).filter({ visible: true }).first().click()
  const sheet = page.getByRole("dialog", { name: "Giao bài mới" })
  await sheet.getByLabel("Tìm bộ bài tập").fill("Unit 5")
  await sheet.getByRole("radio", { name: /Unit 5: My family/ }).click()
  await sheet.getByRole("checkbox", { name: "Bảo Ngọc" }).check({ force: true })
  await sheet.getByRole("button", { name: "Giao bài", exact: true }).click()
  await expect(page.getByText(/cho Minh An, Bảo Ngọc/)).toBeVisible()

  // Verify the assignment appears for the currently viewing child (Minh An)
  await expect(page.getByText("Unit 5: My family").filter({ visible: true }).first()).toBeVisible()

  // Switch to Bảo Ngọc and verify she also has the assignment
  await page.getByRole("button", { name: /Đang xem: Minh An/ }).filter({ visible: true }).click()
  await page.getByRole("menuitemradio", { name: /Bảo Ngọc/ }).click()
  await expect(page.getByRole("button", { name: /Đang xem: Bảo Ngọc/ }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Unit 5: My family").filter({ visible: true }).first()).toBeVisible()
})

test("reports can show last school year", async ({ page }) => {
  await open(page, "/parent/reports")
  const chips = page.getByRole("button", { name: /^\d{4}–\d{4}$/ })
  await expect(chips.first()).toBeVisible()
  const count = await chips.count()
  expect(count).toBeGreaterThanOrEqual(2)
  const lastYear = chips.last()
  await lastYear.click()
  await expect(lastYear).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByLabel("Từ ngày")).toHaveValue(/-09-05$/)
})
