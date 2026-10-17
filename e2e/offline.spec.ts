import { expect, test, type Page } from "@playwright/test"
import { assign, attemptsOf, closeDb, createSet, sql } from "./db"
import { open } from "./helpers"

/*
 * Offline homework on the open app (docs/superpowers/specs/2026-10-17-pwa-offline-design.md):
 * the take page keeps working without network, hand-ins wait on the device and
 * are sent when the network returns. The dev server has no service worker, so
 * each test opens the take page online first; the cold start through the
 * worker is e2e/offline-start.sw.ts.
 */

test.describe.configure({ mode: "serial" })
test.afterAll(() => closeDb())

const takeScreen = (page: Page, title: string) => page.getByRole("dialog", { name: `Làm bài: ${title}` })

/** The device's queued hand-ins, read straight from IndexedDB. */
const readOutbox = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const req = indexedDB.open("hh-offline")
        req.onsuccess = () => {
          const get = req.result.transaction("outbox").objectStore("outbox").getAll()
          get.onsuccess = () => resolve(get.result)
          get.onerror = () => reject(get.error)
        }
      }),
  )

const writeOutbox = (page: Page, items: unknown[]) =>
  page.evaluate(
    (items) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("hh-offline")
        req.onsuccess = () => {
          const tx = req.result.transaction("outbox", "readwrite")
          for (const item of items) tx.objectStore("outbox").put(item)
          tx.oncomplete = () => resolve()
        }
      }),
    items,
  )

async function answerBoth(page: Page, title: string) {
  const take = takeScreen(page, title)
  await take.getByRole("radio", { name: /56/ }).click()
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
  await take.getByRole("radio", { name: /54/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()
  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
}

test("hands in offline and syncs later", async ({ page, context }, testInfo) => {
  const title = `Offline ${testInfo.project.name} ${Date.now()}`
  const assignmentId = await assign(await createSet(title))

  await open(page, "/student/assignments")
  await expect(page.locator("article", { hasText: title }).getByText("Đã tải ✓")).toBeVisible({ timeout: 20_000 })
  await open(page, `/student/assignments/${assignmentId}/do`)
  await expect(takeScreen(page, title)).toBeVisible()

  await context.setOffline(true)
  await answerBoth(page, title)
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()
  expect(await attemptsOf(assignmentId)).toEqual([])

  await context.setOffline(false)
  await expect(page.getByText("Đã gửi 1 bài")).toBeVisible({ timeout: 20_000 })
  expect(await attemptsOf(assignmentId)).toEqual([{ attempt_no: 1, submitted: true, submitted_offline: true, score: 10, answered: 2 }])

  const [{ id }] = await sql<{ id: string }>(`select id from attempts where assignment_id = $1`, [assignmentId])
  await open(page, `/parent/grading/${id}`)
  await expect(page.getByText("Nộp offline")).toBeVisible()
})

test("a timed attempt started offline runs on the device and is handed in at zero", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000)
  const title = `Offline thi ${testInfo.project.name} ${Date.now()}`
  const assignmentId = await assign(await createSet(title), 1)

  await page.clock.install()
  await open(page, `/student/assignments/${assignmentId}/do`)
  const start = page.getByRole("dialog", { name: `Bắt đầu: ${title}` })
  await expect(start.getByText("1 phút")).toBeVisible()

  await context.setOffline(true)
  await start.getByRole("button", { name: "Bắt đầu" }).click()
  const take = takeScreen(page, title)
  await expect(take.getByRole("timer")).toBeVisible()
  await take.getByRole("radio", { name: /56/ }).click()
  await page.clock.fastForward("01:00")
  await expect(page.getByText("Hết giờ!")).toBeVisible()
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()
  expect(await attemptsOf(assignmentId)).toEqual([])

  await context.setOffline(false)
  await expect(page.getByText("Đã gửi 1 bài")).toBeVisible({ timeout: 20_000 })
  const [attempt] = await attemptsOf(assignmentId)
  expect(attempt).toMatchObject({ attempt_no: 1, submitted: true, submitted_offline: true, answered: 1 })
  const [{ duration_seconds }] = await sql<{ duration_seconds: number }>(`select duration_seconds from attempts where assignment_id = $1`, [assignmentId])
  expect(duration_seconds).toBeLessThanOrEqual(60)
})

test("retry of a lost sync reply is idempotent", async ({ page, context }, testInfo) => {
  const title = `Offline lặp ${testInfo.project.name} ${Date.now()}`
  const assignmentId = await assign(await createSet(title))

  await open(page, `/student/assignments/${assignmentId}/do`)
  await expect(takeScreen(page, title)).toBeVisible()
  await context.setOffline(true)
  await answerBoth(page, title)
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()
  const queued = await readOutbox(page)
  expect(queued).toHaveLength(1)

  await context.setOffline(false)
  await expect(page.getByText("Đã gửi 1 bài")).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => readOutbox(page)).toEqual([])

  // The reply was "lost": the device sends the same hand-in again.
  await writeOutbox(page, queued)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect.poll(() => readOutbox(page), { timeout: 20_000 }).toEqual([])
  expect(await attemptsOf(assignmentId)).toEqual([{ attempt_no: 1, submitted: true, submitted_offline: true, score: 10, answered: 2 }])
})

test("time runs out on the server while offline: the offline answers replace the timer's hand-in", async ({ page, context }, testInfo) => {
  const title = `Offline hết giờ ${testInfo.project.name} ${Date.now()}`
  const assignmentId = await assign(await createSet(title), 5)

  await open(page, `/student/assignments/${assignmentId}/do`)
  await page.getByRole("dialog", { name: `Bắt đầu: ${title}` }).getByRole("button", { name: "Bắt đầu" }).click()
  const take = takeScreen(page, title)
  await take.getByRole("radio", { name: /56/ }).click()
  await expect(take.getByText("Đã lưu")).toBeVisible()

  await context.setOffline(true)
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
  await take.getByRole("radio", { name: /54/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()
  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()

  // Meanwhile the server's clock ran out: its sweep hands the attempt in with the one answer it had.
  await sql(`update attempts set started_at = now() - interval '10 minutes' where assignment_id = $1`, [assignmentId])

  await context.setOffline(false)
  await expect(page.getByText("Đã gửi 1 bài")).toBeVisible({ timeout: 20_000 })
  expect(await attemptsOf(assignmentId)).toEqual([{ attempt_no: 1, submitted: true, submitted_offline: true, score: 10, answered: 2 }])
})
