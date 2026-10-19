import { expect, test, type Locator, type Page } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * Vocabulary flashcards: the parent pastes a word list and writes the
 * explanations (by hand here; E2E has no AI key), saves and assigns; the
 * child studies the cards, writes the words from the explanations alone
 * (the word is never on screen), leaves one blank and hands in; the parent
 * marks each word; the child sees the words to practise again.
 */

test.describe.configure({ mode: "serial" })

const WORDS = [
  { word: "nest", explanation: "A bird's home made of twigs and grass." },
  { word: "hive", explanation: "A home where bees live and make honey." },
  { word: "pond", explanation: "A small area of still water where frogs live." },
]

const takeScreen = (page: Page, title: string) => page.getByRole("dialog", { name: `Làm bài: ${title}` })

/** A zig-zag line across a writing strip, drawn with the mouse. */
async function scribble(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.5)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * (0.15 + i * 0.06), box.y + box.height * (0.5 + (i % 2 ? 0.1 : -0.1)), { steps: 3 })
  await page.mouse.up()
}

test("parent makes a word list, child studies and writes it, parent grades", async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors = trackPageErrors(page)
  const title = `E2E từ vựng ${testInfo.project.name} ${Date.now()}`

  await test.step("parent pastes words, writes explanations, saves and assigns", async () => {
    await open(page, "/parent/library")
    await page.getByRole("button", { name: "Thêm bài tập" }).click()
    await page.getByRole("menuitem", { name: /Từ vựng \(Flashcard\)/ }).click()
    await expect(page).toHaveURL(/\/parent\/library\/flashcard\/new$/, { timeout: 15_000 })

    await page.getByLabel("Tên bộ").fill(title)
    await page.getByLabel("Chủ đề").fill("Where Do Animals Live?")
    await page.getByLabel(/Dán danh sách từ/).fill(`${WORDS[0].word}\n\n${WORDS[1].word} / ${WORDS[2].word}\nNest`)
    await expect(page.getByText("Đã nhận 3 từ")).toBeVisible()
    await page.getByRole("button", { name: "Tạo thẻ từ" }).click()

    const explanations = page.getByLabel("Giải thích (tiếng Anh)")
    await expect(explanations).toHaveCount(3)
    for (const [i, w] of WORDS.entries()) {
      await expect(page.getByLabel(`Từ vựng ${i + 1}`)).toHaveValue(w.word)
      await explanations.nth(i).fill(w.explanation)
    }
    await page.getByRole("button", { name: "Lưu & sẵn sàng" }).click()
    await expect(page.getByText("Đã lưu · Bộ từ sẵn sàng để giao")).toBeVisible()
    await page.getByRole("button", { name: "Giao bài này" }).click()
    await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()

    // The library shows it as a word list.
    await open(page, "/parent/library")
    const card = page.locator('[data-slot="card"]').filter({ hasText: title })
    await expect(card.getByText("Flashcard")).toBeVisible()
    await expect(card.getByText("3 từ")).toBeVisible()
  })

  await test.step("child studies every card, then writes two words without seeing them", async () => {
    await open(page, "/student/assignments")
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card.getByRole("button", { name: "Bắt đầu" }).click()
    await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })

    const take = takeScreen(page, title)
    await expect(take.getByRole("tab", { name: "2. Viết từ" })).toBeDisabled()
    await expect(take.getByText(WORDS[0].word, { exact: true }).first()).toBeVisible()
    await take.getByRole("button", { name: "Lật thẻ xem giải thích" }).click()
    await expect(take.getByText(WORDS[0].explanation)).toBeVisible()

    for (const w of WORDS) {
      await expect(take.getByText(w.word, { exact: true }).first()).toBeVisible()
      await take.getByRole("button", { name: "Em thuộc rồi" }).click()
    }
    await expect(take.getByText("Đã thuộc 3/3")).toBeVisible()
    await take.getByRole("button", { name: "Sang phần Viết từ" }).click()

    // Writing: the explanation and the speakers, never the word.
    await expect(take.getByText(WORDS[0].explanation)).toBeVisible()
    await expect(take.getByRole("button", { name: "Nghe đọc từ – Chậm" })).toBeVisible()
    for (const w of WORDS) await expect(take.getByText(w.word, { exact: true })).toHaveCount(0)

    await scribble(page, take.getByRole("img", { name: "Khung viết từ 1" }))
    await expect(take.getByText("Đã viết 1/3")).toBeVisible()
    await take.getByRole("button", { name: "Câu tiếp" }).click()
    await expect(take.getByText(WORDS[1].explanation)).toBeVisible()
    for (const w of WORDS) await expect(take.getByText(w.word, { exact: true })).toHaveCount(0)
    await scribble(page, take.getByRole("img", { name: "Khung viết từ 2" }))
    await take.getByRole("button", { name: "Câu tiếp" }).click()
    await take.getByRole("button", { name: "Xem lại", exact: true }).click()

    await expect(take.getByRole("heading", { name: "Đã viết 2/3 từ" })).toBeVisible()
    await take.getByRole("button", { name: "Nộp bài" }).first().click()
    const confirm = page.getByRole("dialog", { name: "Nộp bài nhé?" })
    await expect(confirm.getByText(/còn 1 từ chưa viết/)).toBeVisible()
    await confirm.getByRole("button", { name: "Nộp bài" }).click()
    await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })
  })

  await test.step("parent marks each word", async () => {
    await open(page, "/parent/grading")
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await expect(card.getByText("3 từ viết tay · chờ chấm")).toBeVisible()
    await card.getByRole("button", { name: "Chấm ngay" }).click()
    await expect(page).toHaveURL(/\/parent\/grading\/[^/]+$/, { timeout: 15_000 })

    await expect(page.getByRole("img", { name: "Chữ viết từ 1" })).toBeVisible()
    await expect(page.getByText("Chưa viết")).toBeVisible()
    const finish = page.getByRole("button", { name: "Hoàn tất chấm bài" })
    await expect(finish).toBeDisabled()
    await page.getByRole("radiogroup", { name: "Chấm từ 1" }).getByRole("radio", { name: "Đúng" }).click()
    await page.getByRole("group", { name: "Nhận xét nhanh từ 2" }).getByRole("button", { name: "Sai chính tả" }).click()
    await expect(page.getByRole("radiogroup", { name: "Chấm từ 2" }).getByRole("radio", { name: "Sai" })).toHaveAttribute("aria-checked", "true")
    await expect(page.getByRole("radiogroup", { name: "Chấm từ 3" }).getByRole("radio", { name: "Sai" })).toHaveAttribute("aria-checked", "true")
    await expect(page.getByText("Đúng 1/3 từ")).toBeVisible()
    await finish.click()
    await expect(page.getByText("Đã chấm: 3,25/10")).toBeVisible()
    await expect(page).toHaveURL(/\/parent\/grading$/, { timeout: 15_000 })
  })

  await test.step("child sees the words to practise again", async () => {
    await open(page, "/student/results")
    await page.getByRole("button", { name: new RegExp(title) }).click()
    await expect(page).toHaveURL(/\/student\/results\/[^/]+$/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Từ cần luyện lại (2)" })).toBeVisible()
    await expect(page.getByText(WORDS[1].word, { exact: true })).toBeVisible()
    await expect(page.getByText(WORDS[2].word, { exact: true })).toBeVisible()
    await expect(page.getByText("Sai chính tả")).toBeVisible()
    await expect(page.getByText("Đã viết đúng 1 từ")).toBeVisible()
  })

  expect(errors).toEqual([])
})
