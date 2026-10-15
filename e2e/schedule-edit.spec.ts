import { expect, test, type Locator } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * The parent reschedules an assignment from the calendar, then deletes it.
 * Uses its own uniquely named set so the seeded data stays untouched.
 */

/** Elements rendered for both layouts (week grid vs phone agenda): the one on screen. */
const visible = (locator: Locator) => locator.filter({ visible: true }).first()

test("parent edits and deletes an assignment on the schedule", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)
  const title = `E2E lịch ${testInfo.project.name} ${Date.now()}`
  const note = "Con làm trước bữa tối nhé!"

  await test.step("parent creates a one-question set and assigns it", async () => {
    await open(page, "/parent/library")
    await page.getByRole("button", { name: "Thêm bài tập" }).click()
    await page.getByRole("menuitem", { name: /Soạn thủ công/ }).click()
    await expect(page).toHaveURL(/\/parent\/library\/[^/]+$/, { timeout: 15_000 })
    await page.getByLabel("Tên bộ bài").fill(title)

    await page.getByRole("button", { name: "Thêm câu hỏi" }).last().click()
    await page.getByRole("dialog", { name: "Thêm câu hỏi" }).getByRole("button", { name: /^Đúng \/ Sai/ }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByLabel("Nhận định").fill("2 + 2 = 4")
    await sheet.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click()
    await expect(sheet).toBeHidden()

    await visible(page.getByRole("button", { name: "Lưu & sẵn sàng" })).click()
    await expect(page.getByText("Đã lưu · Bộ bài sẵn sàng để giao")).toBeVisible()
    await visible(page.getByRole("button", { name: "Giao bài này" })).click()
    await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()
  })

  const card = () => visible(page.getByRole("button", { name: `Sửa bài giao: ${title}` }))
  const editor = page.getByRole("dialog", { name: "Sửa bài giao" })

  await test.step("parent changes due time, attempts and note", async () => {
    await open(page, "/parent/schedule")
    await card().click()
    await expect(editor).toBeVisible()
    const dueDay = (await editor.getByLabel("Hạn nộp").inputValue()).slice(0, 10)
    await editor.getByLabel("Hạn nộp").fill(`${dueDay}T21:30`)
    await editor.getByRole("radio", { name: "1 lần" }).click()
    await editor.getByLabel("Ghi chú cho con").fill(note)
    await editor.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(page.getByText("Đã cập nhật bài giao")).toBeVisible()
    await expect(editor).toBeHidden()

    // Saved on the server: a fresh load shows the new values.
    await open(page, "/parent/schedule")
    await card().click()
    await expect(editor.getByLabel("Hạn nộp")).toHaveValue(`${dueDay}T21:30`)
    await expect(editor.getByRole("radio", { name: "1 lần" })).toHaveAttribute("aria-checked", "true")
    await expect(editor.getByLabel("Ghi chú cho con")).toHaveValue(note)
  })

  await test.step("parent deletes it", async () => {
    await editor.getByRole("button", { name: "Xóa bài giao" }).click()
    await expect(editor.getByText("Xóa bài giao này khỏi lịch?")).toBeVisible()
    await editor.getByRole("button", { name: "Xóa", exact: true }).click()
    await expect(page.getByText("Đã xóa bài giao")).toBeVisible()
    await expect(page.getByRole("button", { name: `Sửa bài giao: ${title}` })).toHaveCount(0)

    await open(page, "/parent/schedule")
    await expect(page.getByRole("button", { name: `Sửa bài giao: ${title}` })).toHaveCount(0)
  })

  expect(errors).toEqual([])
})
