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

const PASSAGE = "Life in the Wild\nThey are ___ and ___. Lions ___ other animals."
const sentence = { type: "dien-cho-trong", prompt: "___ always helps ___.", answers: ["He", "her"], points: 1, skills: [] }

test("parent splits a passage's blanks with Tự chia bài", async ({ page }, testInfo) => {
  const errors = trackPageErrors(page)
  const title = `E2E tách chỗ trống ${testInfo.project.name} ${Date.now()}`
  const setId = await createSetWithQuestions(
    title,
    [{ type: "dien-cho-trong", prompt: PASSAGE, answers: ["gentle", "fierce", "hunt"], points: 3, skills: [] }, sentence],
    "nhap",
  )

  await open(page, `/parent/library/${setId}`)
  await page.getByRole("button", { name: "Tự chia bài" }).click()
  const sheet = page.getByRole("dialog", { name: "Tự chia bài" })
  await expect(sheet.getByText(/câu 1–3\s*· tách 3 chỗ trống/)).toBeVisible()
  await sheet.getByRole("button", { name: "Áp dụng" }).click()

  await visible(page.getByRole("button", { name: "Lưu nháp" })).click()
  await expect(page.getByText("Đã lưu nháp")).toBeVisible()
  await open(page, `/parent/library/${setId}`)
  const bai = page.getByRole("listitem", { name: "Bài 1" })
  await expect(bai.getByText("3 câu · 3 điểm")).toBeVisible()
  for (const n of [1, 2, 3]) await expect(bai.getByText(`Chỗ trống (${n})`, { exact: true })).toBeVisible()
  // The 2-blank sentence stays one question.
  await expect(page.getByRole("button", { name: "Sửa câu 4" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sửa câu 5" })).toHaveCount(0)

  expect(errors).toEqual([])
})

test("child answers a split passage blank by blank; the result marks each blank", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)
  const title = `E2E đoạn văn ${testInfo.project.name} ${Date.now()}`
  const group = { id: "bai-passage", prompt: PASSAGE }
  const blankCau = (blank: number, answer: string) => ({ type: "tra-loi-ngan", prompt: "", answer, blank, points: 1, skills: [], group })
  const setId = await createSetWithQuestions(title, [blankCau(1, "gentle"), blankCau(2, "fierce"), blankCau(3, "hunt"), sentence])
  await assign(setId)

  await test.step("child takes it", async () => {
    await open(page, "/student/assignments")
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Bắt đầu" }).click()
    await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })
    const take = takeScreen(page, title)
    const box = take.getByRole("region", { name: "Bài 1" })
    const current = box.locator("[aria-current='true']")

    for (const [n, word] of [[1, "gentle"], [2, "calm"], [3, "hunt"]] as const) {
      await expect(take.getByRole("heading", { name: `Chỗ trống (${n})` })).toBeVisible()
      await expect(current).toHaveText(`(${n}) ___`)
      await take.getByLabel("Câu trả lời").fill(word)
      await expect(current).toHaveText(`(${n}) ${word}`)
      await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
    }
    await expect(box).toHaveCount(0)
    await take.getByLabel("Chỗ trống 1").fill("He")
    await take.getByLabel("Chỗ trống 2").fill("him")
    await take.getByRole("button", { name: "Xem lại", exact: true }).click()

    await expect(take.getByRole("heading", { name: "Em đã làm hết các câu!" })).toBeVisible()
    await take.getByRole("button", { name: "Nộp bài" }).first().click()
    await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  })

  await test.step("the result marks each blank", async () => {
    // Every câu is auto-graded, so handing in opens the result.
    await expect(page).toHaveURL(/\/student\/results\/[^/]+$/, { timeout: 15_000 })
    const header = page.locator("div").filter({ has: page.locator("p", { hasText: /^Bài 1/ }) }).last()
    await expect(header.getByText("2/3")).toBeVisible()
    await expect(header.getByText("(2) calm")).toBeVisible()
    // Wrong: câu 2 (calm) and câu 4 (one blank of two).
    await expect(page.getByLabel("Sai", { exact: true })).toHaveCount(2)
    await expect(page.getByText("Câu 4 · 1/2 ô đúng")).toBeVisible()
  })

  expect(errors).toEqual([])
})
