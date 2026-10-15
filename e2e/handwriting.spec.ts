import { expect, test, type Locator, type Page } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * Handwritten essay on pages: the student writes with the mouse (as the
 * Pencil would), adds a page, undoes, leaves and comes back to the saved
 * pages, submits; the parent sees both pages and grades; the student sees
 * the pages on the result screen.
 */

test.describe.configure({ mode: "serial" })

const ESSAY_PROMPT = "Viết đoạn văn ngắn kể về một buổi đi chơi."

const visible = (locator: Locator) => locator.filter({ visible: true }).first()
const takeScreen = (page: Page, title: string) => page.getByRole("dialog", { name: `Làm bài: ${title}` })
const writingPage = (take: Locator, n: number) => take.getByRole("img", { name: `Trang ${n} – khung viết tay` })

/** A zig-zag line across a page, drawn with the mouse. */
async function scribble(page: Page, target: Locator, y: number) {
  await target.scrollIntoViewIfNeeded()
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + box.width * (0.15 + i * 0.05), box.y + box.height * (y + (i % 2 ? 0.04 : -0.04)), { steps: 3 })
  }
  await page.mouse.up()
}

test("student writes an essay on two pages, parent grades it", async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors = trackPageErrors(page)
  const title = `E2E viết tay ${testInfo.project.name} ${Date.now()}`

  await test.step("parent creates and assigns an essay set", async () => {
    await open(page, "/parent/library")
    await page.getByRole("button", { name: "Thêm bài tập" }).click()
    await page.getByRole("menuitem", { name: /Soạn thủ công/ }).click()
    await expect(page).toHaveURL(/\/parent\/library\/[^/]+$/, { timeout: 15_000 })
    await page.getByLabel("Tên bộ bài").fill(title)
    await page.getByRole("button", { name: "Thêm câu hỏi" }).last().click()
    await page.getByRole("dialog", { name: "Thêm câu hỏi" }).getByRole("button", { name: /^Tự luận/ }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByLabel("Đề bài").fill(ESSAY_PROMPT)
    await sheet.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click()
    await expect(sheet).toBeHidden()
    await visible(page.getByRole("button", { name: "Lưu & sẵn sàng" })).click()
    await expect(page.getByText("Đã lưu · Bộ bài sẵn sàng để giao")).toBeVisible()
    await visible(page.getByRole("button", { name: "Giao bài này" })).click()
    await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()
  })

  await test.step("student writes on two pages, leaves and comes back", async () => {
    await open(page, "/student/assignments")
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Bắt đầu" }).click()
    await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })

    let take = takeScreen(page, title)
    await expect(take.getByRole("heading", { name: ESSAY_PROMPT })).toBeVisible()
    await take.getByRole("button", { name: "Viết tay" }).click()
    const undo = take.getByRole("button", { name: "Hoàn tác" })
    await expect(undo).toBeDisabled()

    await scribble(page, writingPage(take, 1), 0.2)
    await scribble(page, writingPage(take, 1), 0.4)
    await expect(undo).toBeEnabled()
    await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")

    await take.getByRole("button", { name: "Thêm trang" }).click()
    await expect(take.getByText("Trang 2/2")).toBeVisible()
    await scribble(page, writingPage(take, 2), 0.3)
    await undo.click()
    await take.getByRole("button", { name: "Làm lại" }).click()

    await take.getByRole("button", { name: "Thoát" }).click()
    await page.getByRole("dialog", { name: "Lưu và thoát?" }).getByRole("button", { name: "Lưu và thoát" }).click()
    await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })

    await open(page, "/student/assignments")
    await card.getByRole("button", { name: "Làm tiếp" }).click()
    take = takeScreen(page, title)
    // Saved pages come back in handwriting mode.
    await expect(writingPage(take, 2)).toBeVisible()
    await expect(take.getByText("Trang 2/2")).toBeVisible()

    await take.getByRole("button", { name: "Xem lại", exact: true }).click()
    await expect(take.getByRole("heading", { name: "Em đã làm hết các câu!" })).toBeVisible()
    await take.getByRole("button", { name: "Nộp bài" }).first().click()
    await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
    await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })
  })

  await test.step("parent sees both pages, zooms in and grades", async () => {
    await open(page, "/parent/grading")
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Chấm ngay" }).click()
    await expect(page).toHaveURL(/\/parent\/grading\/[^/]+$/, { timeout: 15_000 })

    await expect(page.getByText("Bài viết tay · xem bên dưới")).toBeVisible()
    await expect(page.getByRole("img", { name: "Bài viết tay câu 1, trang 1/2" })).toBeVisible()
    await expect(page.getByRole("img", { name: "Bài viết tay câu 1, trang 2/2" })).toBeVisible()
    expect(await page.getByRole("img", { name: "Bài viết tay câu 1, trang 1/2" }).locator("path").count()).toBe(2)

    await page.getByRole("button", { name: "Xem lớn Bài viết tay câu 1, trang 1" }).click()
    const viewer = page.getByRole("dialog", { name: /Bài viết tay câu 1 · Trang 1\/2/ })
    await expect(viewer).toBeVisible()
    await viewer.getByRole("button", { name: "Phóng to" }).click()
    await viewer.getByRole("button", { name: "Trang sau" }).click()
    await expect(page.getByRole("dialog", { name: /Trang 2\/2/ })).toBeVisible()
    await page.getByRole("button", { name: "Đóng" }).click()

    await page.getByRole("radiogroup", { name: "Kết quả câu 1" }).getByRole("radio", { name: "Đúng" }).click()
    await page.getByRole("button", { name: "Hoàn tất chấm bài" }).click()
    await expect(page).toHaveURL(/\/parent\/grading$/, { timeout: 15_000 })
  })

  await test.step("student sees the pages on the result screen", async () => {
    await open(page, "/student/results")
    await page.getByRole("button", { name: new RegExp(title) }).click()
    await expect(page).toHaveURL(/\/student\/results\/[^/]+$/, { timeout: 15_000 })
    await expect(page.getByRole("img", { name: "Bài viết của em, câu 1, trang 1/2" })).toBeVisible()
    await expect(page.getByRole("img", { name: "Bài viết của em, câu 1, trang 2/2" })).toBeVisible()
  })

  expect(errors).toEqual([])
})
