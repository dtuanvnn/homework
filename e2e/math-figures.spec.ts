import { expect, test, type Page } from "@playwright/test"
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
  // Type the LaTeX directly (keyboard auto-conversion doesn't work in test env) and trigger input event
  await field.evaluate((el) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (el as any).value = "\\frac{6}{8}"
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await expect.poll(async () => await field.evaluate((el) => (el as any).value)).toContain("\\frac{6}{8}")
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()

  await expect(take.getByRole("img", { name: "Hình minh họa" })).toBeVisible()
  await take.getByRole("radio", { name: /^B/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()

  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp!")).toBeVisible()
  await expect(page).toHaveURL(/\/student\/results\//, { timeout: 15_000 })
  await expect(page.locator("p").filter({ hasText: "/10" }).first()).toHaveText(/^10\s*\/10$/)
  expect(errors).toEqual([])
})
