import { expect, test, type Page } from "@playwright/test"
import type { MathfieldElement } from "mathlive"
import { open, trackPageErrors } from "./helpers"

const TITLE = "Phân số và hình vẽ"

async function openSet(page: Page) {
  await open(page, "/parent/library")
  await page.getByText(TITLE, { exact: true }).first().click()
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible()
}

test("formulas and figures render in the library", async ({ page }) => {
  const errors = trackPageErrors(page)
  await openSet(page)
  await expect(page.locator(".katex").first()).toBeVisible()
  const figure = page.getByRole("img", { name: "Hình minh họa" }).first()
  await expect(figure).toBeVisible()
  expect(await figure.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test("child answers a fraction with the math keyboard and an equal value counts", async ({ page }, testInfo) => {
  // Both projects share one seeded database: assign and take only once.
  test.skip(testInfo.project.name !== "ipad", "runs once")
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)

  await openSet(page)
  await page.getByRole("button", { name: "Giao bài này" }).filter({ visible: true }).first().click()
  await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()

  await open(page, "/student/assignments")
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: TITLE, exact: true }) })
  await card.getByRole("button", { name: "Bắt đầu" }).click()
  const take = page.getByRole("dialog", { name: `Làm bài: ${TITLE}` })

  const field = take.locator("math-field")
  await expect(field).toBeVisible()
  await field.click()

  // Use MathLive's virtual keyboard like a child would on iPad
  const keyboard = page.locator('.ML__keyboard')
  await expect(keyboard).toBeVisible({ timeout: 2000 })

  // Tap keycaps directly: 6, "phân số" button, 8 (to enter 6/8 which equals the expected 3/4)
  await keyboard.locator('[data-keycap-value="6"]').click({ force: true })
  await keyboard.locator('[aria-label="phân số"]').click({ force: true })
  await keyboard.locator('[data-keycap-value="8"]').click({ force: true })

  // Verify the field contains a fraction with 6 and 8 (MathLive may use shorthand \frac68 or full \frac{6}{8})
  await expect.poll(async () => await field.evaluate((el: MathfieldElement) => el.value)).toMatch(/\\frac(\{6\}\{8\}|68)/)

  // Click dialog header to dismiss keyboard, then click next
  await take.locator('header').click()
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()

  await expect(take.getByRole("img", { name: "Hình minh họa" })).toBeVisible()
  await take.getByRole("radio", { name: /^B/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()

  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp!")).toBeVisible()
  await expect(page).toHaveURL(/\/student\/results\//, { timeout: 15_000 })
  await expect(page.locator("p").filter({ hasText: "/10" }).first()).toHaveText(/^10\s*\/10$/)

  // The result shows the figure and the child's fraction as a formula, not raw LaTeX.
  await expect(page.locator('img[alt="Hình minh họa"]').first()).toBeVisible()
  const childAnswer = page.locator("p").filter({ hasText: "Em trả lời:" }).first()
  await expect(childAnswer.locator(".katex").first()).toBeVisible()

  // The parent's view of the same (auto-graded) attempt renders them too.
  const attemptId = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1)!)
  await open(page, `/parent/grading/${encodeURIComponent(attemptId)}`)
  await expect(page.locator('img[alt="Hình minh họa"]').first()).toBeVisible()
  for (const label of ["Đáp án đúng", "Con trả lời"]) {
    const box = page.getByText(label, { exact: true }).first().locator("xpath=..")
    await expect(box.locator(".katex").first()).toBeVisible()
  }
  expect(errors).toEqual([])
})

test("parent types a math answer with the virtual keyboard inside the editor sheet", async ({ page }) => {
  const errors = trackPageErrors(page)
  await openSet(page)
  await page.getByRole("button", { name: "Sửa câu 1" }).filter({ visible: true }).first().click()
  const sheet = page.getByRole("dialog", { name: "Sửa câu hỏi" })
  await expect(sheet).toBeVisible()

  const field = sheet.locator("math-field")
  await expect(field).toBeVisible()
  const before = await field.evaluate((el: MathfieldElement) => el.value)
  await field.click()

  // The keyboard mounts on <body>, outside the modal sheet: real taps (no force) must reach it.
  const keyboard = page.locator(".ML__keyboard")
  await expect(keyboard).toBeVisible({ timeout: 2000 })
  await keyboard.locator('[data-keycap-value="7"]').click()
  await expect(sheet).toBeVisible()
  await keyboard.locator('[data-keycap-value="5"]').click()
  await expect(sheet).toBeVisible()

  await expect.poll(async () => await field.evaluate((el: MathfieldElement) => el.value)).not.toBe(before)
  expect(await field.evaluate((el: MathfieldElement) => el.value)).toContain("75")
  expect(errors).toEqual([])
})
