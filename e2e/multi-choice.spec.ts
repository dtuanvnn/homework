import { expect, test, type Locator } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * A multiple-choice question with several correct options: the parent ticks
 * two answers in the editor, the child sees "Chọn tất cả đáp án đúng" with
 * checkboxes, picks both and gets full marks. Uses its own uniquely named set.
 */

const PROMPT = "Số nào là số chẵn?"

const visible = (locator: Locator) => locator.filter({ visible: true }).first()

test("a question with several correct answers is taken with checkboxes and graded", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)
  const title = `E2E nhiều đáp án ${testInfo.project.name} ${Date.now()}`

  await test.step("parent ticks two correct options and assigns the set", async () => {
    await open(page, "/parent/library")
    await page.getByRole("button", { name: "Thêm bài tập" }).click()
    await page.getByRole("menuitem", { name: /Soạn thủ công/ }).click()
    await expect(page).toHaveURL(/\/parent\/library\/[^/]+$/, { timeout: 15_000 })
    await page.getByLabel("Tên bộ bài").fill(title)

    await page.getByRole("button", { name: "Thêm câu hỏi" }).last().click()
    await page.getByRole("dialog", { name: "Thêm câu hỏi" }).getByRole("button", { name: /^Trắc nghiệm/ }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByLabel("Câu hỏi").fill(PROMPT)
    for (const [letter, text] of [["A", "12"], ["B", "15"], ["C", "28"], ["D", "33"]]) {
      await sheet.getByLabel(`Phương án ${letter}`, { exact: true }).fill(text)
    }
    await sheet.getByRole("button", { name: "Chọn A là đáp án đúng" }).click()
    await sheet.getByRole("button", { name: "Chọn C là đáp án đúng" }).click()
    await expect(sheet.getByText(/phải chọn đủ 2 đáp án/)).toBeVisible()
    await sheet.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText("Nhiều đáp án đúng · chọn tất cả").first()).toBeVisible()

    await visible(page.getByRole("button", { name: "Lưu & sẵn sàng" })).click()
    await expect(page.getByText("Đã lưu · Bộ bài sẵn sàng để giao")).toBeVisible()
    await visible(page.getByRole("button", { name: "Giao bài này" })).click()
    await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()
  })

  await test.step("student picks every correct option and gets full marks", async () => {
    await open(page, "/student/assignments")
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Bắt đầu" }).click()
    await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })

    const take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
    await expect(take.getByRole("heading", { name: PROMPT })).toBeVisible()
    await expect(take.getByText("Chọn tất cả đáp án đúng")).toBeVisible()
    await expect(take.getByRole("radio")).toHaveCount(0)

    // Ticking toggles: B on and off again, then A and C.
    await take.getByRole("checkbox", { name: /15/ }).click()
    await take.getByRole("checkbox", { name: /15/ }).click()
    await take.getByRole("checkbox", { name: /12/ }).click()
    await take.getByRole("checkbox", { name: /28/ }).click()
    await expect(take.getByRole("checkbox", { checked: true })).toHaveCount(2)
    await expect(take.getByRole("checkbox", { name: /15/ })).toHaveAttribute("aria-checked", "false")

    await take.getByRole("button", { name: "Xem lại", exact: true }).click()
    await expect(take.getByRole("heading", { name: "Em đã làm hết các câu!" })).toBeVisible()
    await take.getByRole("button", { name: "Nộp bài" }).first().click()
    const confirm = page.getByRole("dialog", { name: "Nộp bài nhé?" })
    await confirm.getByRole("button", { name: "Nộp bài" }).click()

    await expect(page).toHaveURL(/\/student\/results\/[^/]+$/, { timeout: 15_000 })
    const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1, name: title }) })
    await expect(hero).toContainText("10/10")
  })

  expect(errors).toEqual([])
})
