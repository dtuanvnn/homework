import { expect, test, type Locator, type Page } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

const PROMPT = "Choose and unscramble the sentences.\nMark --- They"
const SENTENCE = "They didn't invite Mark."
const OPTIONS = ["didn't invite", "didn't invited"]
const visible = (locator: Locator) => locator.filter({ visible: true }).first()

async function writeStroke(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) throw new Error("Không thấy khung viết tay")
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.25, { steps: 8 })
  await page.mouse.up()
}

async function expectInk(target: Locator) {
  await expect.poll(() => target.locator("canvas").first().evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data
    return data?.some((value, i) => i % 4 === 3 && value > 0) ?? false
  })).toBe(true)
}

test("parent creates a choose-and-rewrite essay, student writes it, parent grades both parts", async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors = trackPageErrors(page)
  const title = `E2E chọn và viết ${testInfo.project.name} ${Date.now()}`

  await open(page, "/parent/library")
  await page.getByRole("button", { name: "Thêm bài tập" }).click()
  await page.getByRole("menuitem", { name: /Soạn thủ công/ }).click()
  await expect(page).toHaveURL(/\/parent\/library\/[^/]+$/, { timeout: 15_000 })
  await page.getByLabel("Tên bộ bài").fill(title)
  await page.getByRole("button", { name: "Thêm câu hỏi" }).last().click()
  await page.getByRole("dialog").getByRole("button", { name: /^Tự luận/ }).click()
  let sheet = page.getByRole("dialog")
  await sheet.getByLabel("Đề bài").fill(PROMPT)
  await sheet.getByRole("button", { name: "Thêm phần chọn phương án" }).click()
  await sheet.getByLabel("Phương án A", { exact: true }).fill(OPTIONS[0])
  await sheet.getByLabel("Phương án B", { exact: true }).fill(OPTIONS[1])
  await sheet.getByLabel("Gợi ý chấm (không bắt buộc)").fill(SENTENCE)
  await sheet.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click()
  await expect(sheet).toBeHidden()
  await page.getByRole("button", { name: "Sửa câu 1", exact: true }).click()
  sheet = page.getByRole("dialog")
  await expect(sheet.getByLabel("Phương án A", { exact: true })).toHaveValue(OPTIONS[0])
  await expect(sheet.getByLabel("Phương án B", { exact: true })).toHaveValue(OPTIONS[1])
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await visible(page.getByRole("button", { name: "Lưu & sẵn sàng" })).click()
  await expect(page.getByText("Đã lưu · Bộ bài sẵn sàng để giao")).toBeVisible()
  await visible(page.getByRole("button", { name: "Giao bài này" })).click()
  await expect(page.getByText(/^Đã giao bài cho /)).toBeVisible()

  await open(page, "/student/assignments")
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
  await card.getByRole("button", { name: "Bắt đầu" }).click()
  let take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
  await take.getByRole("radio", { name: /didn't invite$/ }).click()
  await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  await take.getByLabel("Bài viết của em").fill(SENTENCE)
  await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")
  await take.getByRole("radio", { name: /didn't invited$/ }).click()
  await expect(take.getByLabel("Bài viết của em")).toHaveValue(SENTENCE)

  await take.getByRole("button", { name: "Thoát" }).click()
  await page.getByRole("dialog", { name: "Lưu và thoát?" }).getByRole("button", { name: "Lưu và thoát" }).click()
  await expect(page).toHaveURL(/\/student$/)
  await open(page, "/student/assignments")
  await card.getByRole("button", { name: "Làm tiếp" }).click()
  take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
  await expect(take.getByRole("radio", { name: /didn't invited$/ })).toHaveAttribute("aria-checked", "true")
  await expect(take.getByLabel("Bài viết của em")).toHaveValue(SENTENCE)
  await take.getByRole("radio", { name: /didn't invite$/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()
  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 })

  await open(page, "/parent/grading")
  const gradingCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: title, exact: true }) })
  await gradingCard.getByRole("button", { name: "Chấm ngay" }).click()
  await expect(page.getByText(/Đã chọn: didn't invite/)).toBeVisible()
  await page.getByRole("radiogroup", { name: "Kết quả câu 1" }).getByRole("radio", { name: "Đúng" }).click()
  await page.getByRole("button", { name: "Hoàn tất chấm bài" }).click()
  await expect(page).toHaveURL(/\/parent\/grading$/)
  await open(page, "/student/results")
  await page.getByRole("button", { name: new RegExp(title) }).click()
  await expect(page.getByText(/Đã chọn: didn't invite/)).toBeVisible()
  expect(errors).toEqual([])
})

test("choose-and-rewrite offline keeps choice with text and handwriting after reload and queues both parts", async ({ page }, testInfo) => {
  const errors = trackPageErrors(page)
  const title = `Chọn và viết offline ${testInfo.project.name}`
  await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true }))
  await page.goto("/offline")
  await expect(page.getByRole("heading", { name: "Làm bài offline" })).toBeVisible()
  await page.evaluate(async ({ title, prompt, options }) => {
    const request = indexedDB.open("hh-offline", 1)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction(["meta", "packs"], "readwrite")
    tx.objectStore("meta").put("choose-child", "lastStudentId")
    tx.objectStore("meta").put("Bé chọn và viết", "lastStudentName")
    tx.objectStore("packs").put({
      studentId: "choose-child", assignmentId: "choose-assignment", version: "1", setVersion: new Date().toISOString(),
      title, subject: "tieng-anh", dueAt: new Date(Date.now() + 864e5).toISOString(),
      availableFrom: new Date(Date.now() - 864e5).toISOString(), timeLimitMinutes: null, attemptNo: 1,
      questions: [{ id: "choose-question", type: "tu-luan", prompt, options, points: 1, skills: [] }],
      draft: null, complete: true,
    })
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, { title, prompt: PROMPT, options: OPTIONS })
  await page.goto("/offline?a=choose-assignment")
  let take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
  await expect(take.getByRole("radio", { checked: true })).toHaveCount(0)
  await take.getByRole("radio", { name: /didn't invite$/ }).click()
  await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  await take.getByLabel("Bài viết của em").fill(SENTENCE)
  await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")
  await take.getByRole("button", { name: "Thoát" }).click()
  await page.getByRole("dialog", { name: "Lưu và thoát?" }).getByRole("button", { name: "Lưu và thoát" }).click()
  await page.goto("/offline?a=choose-assignment")
  take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
  await expect(take.getByRole("radio", { name: /didn't invite$/ })).toHaveAttribute("aria-checked", "true")
  await expect(take.getByLabel("Bài viết của em")).toHaveValue(SENTENCE)
  await take.getByLabel("Bài viết của em").fill("")
  await take.getByRole("button", { name: "Viết tay", exact: true }).click()
  await writeStroke(page, take.getByRole("img", { name: "Trang 1 – khung viết tay" }))
  await expect(take.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")
  await expect(take.getByRole("radio", { name: /didn't invite$/ })).toHaveAttribute("aria-checked", "true")
  await take.getByRole("radio", { name: /didn't invited$/ }).click()
  await expectInk(take.getByRole("img", { name: "Trang 1 – khung viết tay" }))
  await take.getByRole("button", { name: "Thoát" }).click()
  await page.getByRole("dialog", { name: "Lưu và thoát?" }).getByRole("button", { name: "Lưu và thoát" }).click()
  await page.goto("/offline?a=choose-assignment")
  take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
  await expect(take.getByRole("radio", { name: /didn't invited$/ })).toHaveAttribute("aria-checked", "true")
  await expectInk(take.getByRole("img", { name: "Trang 1 – khung viết tay" }))
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()
  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()
  const queued = await page.evaluate(async () => {
    const request = indexedDB.open("hh-offline", 1)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const outbox = db.transaction("outbox").objectStore("outbox").getAll()
    const items = await new Promise<{ responses: Record<string, { choice?: number; ink?: { pages: { strokes: number[][] }[] } }> }[]>((resolve, reject) => {
      outbox.onsuccess = () => resolve(outbox.result)
      outbox.onerror = () => reject(outbox.error)
    })
    db.close()
    return items[0]?.responses["choose-question"]
  })
  expect(queued?.choice).toBe(1)
  expect(queued?.ink?.pages[0].strokes).toHaveLength(1)
  expect(errors).toEqual([])
})
