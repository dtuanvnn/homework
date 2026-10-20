import { expect, test, type Locator, type Page } from "@playwright/test"
import { assign, createSetWithQuestions } from "./db"
import { open, trackPageErrors } from "./helpers"

/*
 * Bài (grouped questions): the parent splits a scanned-style set into bài with
 * "Tự chia bài"; the child sees a bài's shared prompt above each of its câu;
 * grading and the result show the bài with its score.
 */

// No closeDb() here: the pool is shared by every spec in the worker, and offline.spec runs later.
test.describe.configure({ mode: "serial" })

const visible = (locator: Locator) => locator.filter({ visible: true }).first()
const takeScreen = (page: Page, title: string) => page.getByRole("dialog", { name: `Làm bài: ${title}` })
const mc = (prompt: string, options: string[], correctIndex: number, extra: object = {}) => ({ type: "trac-nghiem", prompt, options, correctIndex, points: 1, skills: [], ...extra })

test("parent splits a set into bài with Tự chia bài", async ({ page }, testInfo) => {
  const errors = trackPageErrors(page)
  const title = `E2E chia bài ${testInfo.project.name} ${Date.now()}`
  const shared = "Part 3. Complete the sentences."
  const setId = await createSetWithQuestions(
    title,
    [
      { type: "tra-loi-ngan", prompt: `${shared}\nDavid is kind. ___ helps me.`, points: 1, skills: [], answer: "He" },
      { type: "tra-loi-ngan", prompt: `${shared}\nLily is here. ___ is my friend.`, points: 1, skills: [], answer: "She" },
      { type: "tra-loi-ngan", prompt: `${shared}\nTom and I play. ___ are happy.`, points: 1, skills: [], answer: "We" },
      mc("2 + 2 = ?", ["3", "4"], 1),
    ],
    "nhap",
  )

  await open(page, `/parent/library/${setId}`)
  await page.getByRole("button", { name: "Tự chia bài" }).click()
  const sheet = page.getByRole("dialog", { name: "Tự chia bài" })
  await expect(sheet.getByText(/Part 3\s*· câu 1–3/)).toBeVisible()
  await sheet.getByRole("button", { name: "Áp dụng" }).click()

  const bai = page.getByRole("listitem", { name: "Part 3" })
  await expect(bai.getByText("3 câu · 3 điểm")).toBeVisible()
  await expect(bai.getByText("Complete the sentences.", { exact: true })).toBeVisible()
  await expect(bai.getByText("David is kind. ___ helps me.")).toBeVisible()

  await visible(page.getByRole("button", { name: "Lưu nháp" })).click()
  await expect(page.getByText("Đã lưu nháp")).toBeVisible()
  await open(page, `/parent/library/${setId}`)
  await expect(page.getByRole("listitem", { name: "Part 3" }).getByText("3 câu · 3 điểm")).toBeVisible()

  // "Bỏ bài" puts the shared instruction back in front of each câu.
  await page.getByRole("button", { name: "Thêm thao tác cho Part 3" }).click()
  await page.getByRole("menuitem", { name: "Bỏ bài" }).click()
  await expect(page.getByRole("listitem", { name: "Part 3" })).toHaveCount(0)
  await expect(page.getByText("Complete the sentences.\nDavid is kind. ___ helps me.")).toBeVisible()

  expect(errors).toEqual([])
})

test("child sees the shared prompt on each câu; grading and result show the bài", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)
  const title = `E2E bài ${testInfo.project.name} ${Date.now()}`
  const group = { id: "bai-e2e", label: "Part 3", prompt: "Choose or write the right answer." }
  const setId = await createSetWithQuestions(title, [
    mc("7 × 8 = ?", ["54", "56"], 1, { group }),
    mc("9 × 6 = ?", ["54", "56"], 0, { group }),
    { type: "tu-luan", prompt: "Write one sentence about your cat.", points: 1, skills: [], rubric: "", group },
    mc("2 + 2 = ?", ["3", "4"], 1),
  ])
  await assign(setId)

  await test.step("child takes it", async () => {
    await open(page, "/student/assignments")
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Bắt đầu" }).click()
    await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })
    const take = takeScreen(page, title)
    const box = take.getByRole("region", { name: "Part 3" })

    await expect(box.getByText(group.prompt)).toBeVisible()
    await take.getByRole("radio", { name: /56/ }).click()
    await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
    await expect(box.getByText(group.prompt)).toBeVisible()
    await take.getByRole("radio", { name: /54/ }).click()
    await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
    await expect(box).toBeVisible()
    await take.getByLabel("Bài viết của em").fill("My cat is fluffy.")
    await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
    await expect(take.getByRole("heading", { name: "2 + 2 = ?" })).toBeVisible()
    await expect(box).toHaveCount(0)
    await take.getByRole("radio", { name: /4/ }).click()
    await take.getByRole("button", { name: "Xem lại", exact: true }).click()

    await expect(take.getByRole("heading", { name: "Em đã làm hết các câu!" })).toBeVisible()
    await take.getByRole("button", { name: "Nộp bài" }).first().click()
    await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
    await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })
  })

  await test.step("parent grades under the bài header", async () => {
    await open(page, "/parent/grading")
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Chấm ngay" }).click()
    await expect(page).toHaveURL(/\/parent\/grading\/[^/]+$/, { timeout: 15_000 })
    const bai = page.getByRole("region", { name: "Part 3" })
    await expect(bai.getByText("2/3")).toBeVisible()
    await bai.getByRole("radiogroup", { name: "Kết quả câu 3" }).getByRole("radio", { name: "Đúng" }).click()
    await expect(bai.getByText("3/3")).toBeVisible()
    await page.getByRole("button", { name: "Hoàn tất chấm bài" }).click()
    await expect(page.getByText("Đã chấm: 10/10")).toBeVisible()
    await expect(page).toHaveURL(/\/parent\/grading$/, { timeout: 15_000 })
  })

  await test.step("child's result shows the bài", async () => {
    await open(page, "/student/results")
    await page.getByRole("button", { name: new RegExp(title) }).click()
    await expect(page).toHaveURL(/\/student\/results\/[^/]+$/, { timeout: 15_000 })
    const header = page.locator("p").filter({ hasText: /^Part 3/ })
    await expect(header).toBeVisible()
    await expect(header.getByText("3/3")).toBeVisible()
    await expect(page.getByText("Câu 4")).toBeVisible()
  })

  expect(errors).toEqual([])
})
