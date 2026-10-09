import { expect, test, type Locator, type Page } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * The core loop end to end: the parent builds and assigns a set, the student
 * does it (with a mid-way exit), the parent grades it and allows a retry, the
 * student sees the score and hands in attempt 2.
 *
 * Every run creates its own uniquely named set, so the spec never depends on
 * the seeded data staying untouched (both projects share one seeded database).
 */

test.describe.configure({ mode: "serial" })

const MC_PROMPT = "7 × 8 = ?"
const TF_PROMPT = "Số 450 đọc là: Bốn trăm năm mươi."
const ESSAY_PROMPT = "Viết 2 câu về con mèo của em."
const ESSAY_TEXT = "Con mèo nhà em tên là Mướp. Mướp rất thích nằm sưởi nắng."
const ESSAY_COMMENT = "Con viết câu rõ ràng, nhớ thêm dấu chấm nhé."
const FEEDBACK = "Con làm khá tốt, xem lại phép nhân nhé!"

/** Elements rendered for both layouts (desktop header vs phone action bar): the one on screen. */
const visible = (locator: Locator) => locator.filter({ visible: true }).first()

/** A student assignment card (Hôm nay / Bài của em) by title. */
const studentCard = (page: Page, title: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })

/** A grading-queue card by title. */
const gradingCard = (page: Page, title: string) =>
  page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: title, exact: true }) })

const takeScreen = (page: Page, title: string) => page.getByRole("dialog", { name: `Làm bài: ${title}` })

async function nextQuestion(take: Locator, label: "Câu tiếp" | "Xem lại" = "Câu tiếp") {
  await take.getByRole("button", { name: label, exact: true }).click()
}

async function submitTake(page: Page, take: Locator) {
  await expect(take.getByRole("heading", { name: "Em đã làm hết các câu!" })).toBeVisible()
  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  const confirm = page.getByRole("dialog", { name: "Nộp bài nhé?" })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp!")).toBeVisible()
  // An essay needs the parent, so the student goes back to Hôm nay.
  await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })
}

async function expectWaitingInMyAssignments(page: Page, title: string) {
  await open(page, "/student/assignments")
  await page.getByRole("tab", { name: /^Chờ chấm/ }).click()
  const card = studentCard(page, title)
  await expect(card).toBeVisible()
  await expect(card.getByRole("button", { name: "Đang chờ bố mẹ chấm" })).toBeDisabled()
}

test("parent assigns, student does it, parent grades, student retries", async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  const errors = trackPageErrors(page)
  const title = `E2E ${testInfo.project.name} ${Date.now()}`
  let assignmentId = ""

  await test.step("parent creates a set manually, marks it ready and assigns it", async () => {
    await open(page, "/parent/library")
    await page.getByRole("button", { name: "Thêm bài tập" }).click()
    await page.getByRole("menuitem", { name: /Soạn thủ công/ }).click()
    await expect(page).toHaveURL(/\/parent\/library\/[^/]+$/, { timeout: 15_000 })

    await page.getByLabel("Tên bộ bài").fill(title)

    const addQuestion = async (type: RegExp) => {
      await page.getByRole("button", { name: "Thêm câu hỏi" }).last().click()
      const sheet = page.getByRole("dialog", { name: "Thêm câu hỏi" })
      await expect(sheet).toBeVisible()
      await sheet.getByRole("button", { name: type }).click()
      return page.getByRole("dialog")
    }
    const confirmQuestion = async (sheet: Locator) => {
      await sheet.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click()
      await expect(sheet).toBeHidden()
    }

    // 1. Multiple choice, B is right.
    let sheet = await addQuestion(/^Trắc nghiệm/)
    await sheet.getByLabel("Câu hỏi").fill(MC_PROMPT)
    for (const [letter, text] of [["A", "54"], ["B", "56"], ["C", "58"], ["D", "64"]]) {
      await sheet.getByLabel(`Phương án ${letter}`, { exact: true }).fill(text)
    }
    await sheet.getByRole("button", { name: "Chọn B là đáp án đúng" }).click()
    await confirmQuestion(sheet)

    // 2. True / false, the statement is true (the default).
    sheet = await addQuestion(/^Đúng \/ Sai/)
    await sheet.getByLabel("Nhận định").fill(TF_PROMPT)
    await confirmQuestion(sheet)

    // 3. Essay, graded by the parent.
    sheet = await addQuestion(/^Tự luận/)
    await sheet.getByLabel("Đề bài").fill(ESSAY_PROMPT)
    await confirmQuestion(sheet)

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible()
    await expect(page.getByText(/^3 câu · 4 điểm/).first()).toBeVisible()

    await visible(page.getByRole("button", { name: "Lưu & sẵn sàng" })).click()
    await expect(page.getByText("Đã lưu · Bộ bài sẵn sàng để giao")).toBeVisible()
    await expect(page.getByText("Sẵn sàng", { exact: true })).toBeVisible()

    await visible(page.getByRole("button", { name: "Giao bài này" })).click()
    await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()
    await expect(page.getByText(/Đã giao 1 lần/)).toBeVisible()
  })

  await test.step("student sees it, starts it, exits mid-way and resumes", async () => {
    // "Giao bài này" is due tomorrow 20:00, so Hôm nay lists it under "Sắp tới".
    await open(page, "/student")
    const upcoming = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sắp tới" }) })
    await expect(upcoming.getByText(title, { exact: true })).toBeVisible()

    await open(page, "/student/assignments")
    const card = studentCard(page, title)
    await card.getByRole("button", { name: "Bắt đầu" }).click()
    await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })
    assignmentId = decodeURIComponent(page.url().split("/").at(-2)!)

    let take = takeScreen(page, title)
    await expect(take.getByRole("heading", { name: MC_PROMPT })).toBeVisible()
    await take.getByRole("radio", { name: /54/ }).click() // wrong on purpose
    await nextQuestion(take)
    await expect(take.getByRole("heading", { name: TF_PROMPT })).toBeVisible()
    await take.getByRole("radio", { name: /Đúng/ }).click()
    await nextQuestion(take)
    await expect(take.getByRole("heading", { name: ESSAY_PROMPT })).toBeVisible()
    await take.getByLabel("Bài viết của em").fill(ESSAY_TEXT)

    await take.getByRole("button", { name: "Thoát" }).click()
    const exit = page.getByRole("dialog", { name: "Lưu và thoát?" })
    await exit.getByRole("button", { name: "Lưu và thoát" }).click()
    await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })
    await expect(page.getByText("Đã lưu bài làm. Em làm tiếp sau nhé!")).toBeVisible()

    await open(page, "/student/assignments")
    await card.getByRole("button", { name: "Làm tiếp" }).click()
    await expect(page).toHaveURL(new RegExp(`/student/assignments/${assignmentId}/do$`), { timeout: 15_000 })

    take = takeScreen(page, title)
    await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3")
    await expect(take.getByRole("radio", { name: /54/ })).toHaveAttribute("aria-checked", "true")
    await nextQuestion(take)
    await expect(take.getByRole("radio", { name: /Đúng/ })).toHaveAttribute("aria-checked", "true")
    await nextQuestion(take)
    await expect(take.getByLabel("Bài viết của em")).toHaveValue(ESSAY_TEXT)
    await nextQuestion(take, "Xem lại")
    await submitTake(page, take)
    await expect(page.getByText("Em đã nộp bài, giỏi quá! 🎉")).toBeVisible()

    await expectWaitingInMyAssignments(page, title)
  })

  await test.step("parent grades the essay and allows a retry", async () => {
    await open(page, "/parent/grading")
    const card = gradingCard(page, title)
    await expect(card).toBeVisible()
    await expect(card.getByText("Lần 1")).toBeVisible()
    await expect(card.getByText(/Tự chấm: 1\/3 câu/)).toBeVisible()
    await card.getByRole("button", { name: "Chấm ngay" }).click()
    await expect(page).toHaveURL(/\/parent\/grading\/[^/]+$/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { level: 1, name: title }).last()).toBeVisible()

    await expect(page.getByText(ESSAY_TEXT)).toBeVisible()
    await page.getByRole("radiogroup", { name: "Kết quả câu 3" }).getByRole("radio", { name: "Đúng" }).click()
    const points = page.getByRole("group", { name: "Điểm câu 3" })
    await points.getByRole("button", { name: "Bớt điểm" }).click() // steps of 0,25
    await expect(points).toContainText("1,75/2")
    await points.getByRole("button", { name: "Bớt điểm" }).click()
    await expect(points).toContainText("1,5/2")
    await page.getByLabel("Nhận xét câu 3").fill(ESSAY_COMMENT)
    await page.getByLabel("Nhận xét chung").fill(FEEDBACK)

    const retry = page.getByRole("switch", { name: /Cho phép làm lại lần 2/ })
    if ((await retry.getAttribute("aria-checked")) !== "true") await retry.click()
    await expect(retry).toHaveAttribute("aria-checked", "true")

    // 0/1 + 1/1 + 1.5/2 = 2.5/4 → 6.25/10
    await expect(page.getByText("Tổng 2,5/4 điểm")).toBeVisible()
    await page.getByRole("button", { name: "Hoàn tất chấm bài" }).click()
    await expect(page).toHaveURL(/\/parent\/grading$/, { timeout: 15_000 })
    await expect(page.getByText("Đã chấm: 6,25/10")).toBeVisible()

    await page.getByRole("tab", { name: "Đã chấm" }).click()
    const graded = gradingCard(page, title)
    await expect(graded.getByText("6,25", { exact: false })).toBeVisible()
    await expect(graded.getByText("Chờ con làm lại lần 2")).toBeVisible()
  })

  await test.step("student sees the result and does attempt 2", async () => {
    // Graded today with a retry allowed: back on Hôm nay as a card.
    await open(page, "/student")
    const card = studentCard(page, title)
    await expect(card.getByText("Đã chấm", { exact: true })).toBeVisible()
    await expect(card.getByRole("button", { name: "Làm lại lần 2" })).toBeVisible()
    await card.getByRole("button", { name: "Xem kết quả" }).click()

    await expect(page).toHaveURL(/\/student\/results\/[^/]+$/, { timeout: 15_000 })
    const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1, name: title }) })
    await expect(hero).toContainText("6,25/10")
    await expect(hero).toContainText("Lần 1")
    await expect(page.getByText(FEEDBACK)).toBeVisible()

    await page.getByRole("button", { name: "Làm lại lần 2" }).click()
    await expect(page).toHaveURL(new RegExp(`/student/assignments/${assignmentId}/do$`), { timeout: 15_000 })

    const take = takeScreen(page, title)
    await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
    await expect(take.getByRole("radio", { checked: true })).toHaveCount(0)
    await take.getByRole("radio", { name: /56/ }).click()
    await nextQuestion(take)
    await expect(take.getByRole("radio", { checked: true })).toHaveCount(0)
    await take.getByRole("radio", { name: /Đúng/ }).click()
    await nextQuestion(take)
    const essay = take.getByLabel("Bài viết của em")
    await expect(essay).toHaveValue("")
    await essay.fill(`${ESSAY_TEXT} Em rất yêu Mướp.`)
    await nextQuestion(take, "Xem lại")
    await submitTake(page, take)

    await expectWaitingInMyAssignments(page, title)
  })

  await test.step("parent dashboard shows the pending attempt", async () => {
    await open(page, "/parent/grading")
    const pendingTab = page.getByRole("tab", { name: /^Chờ chấm \(\d+\)$/ })
    await expect(pendingTab).toBeVisible()
    const pending = Number((await pendingTab.textContent())!.match(/\d+/)![0])
    expect(pending).toBeGreaterThanOrEqual(1)
    const card = gradingCard(page, title)
    await expect(card.getByText("Lần 2")).toBeVisible()
    await expect(card.getByRole("button", { name: "Chấm ngay" })).toBeVisible()

    await open(page, "/parent")
    await expect(page.getByRole("button", { name: `${pending} bài chờ chấm, mở trang Chấm bài` })).toBeVisible()
  })

  expect(errors).toEqual([])
})
