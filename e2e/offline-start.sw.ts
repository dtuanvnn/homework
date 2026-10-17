import { expect, test } from "@playwright/test"
import { assign, attemptsOf, closeDb, createSet } from "./db"
import { open } from "./helpers"

/*
 * Cold start without network, through the service worker. Runs against a
 * production build in Chromium (Playwright's WebKit can't drive service
 * workers): pnpm build && pnpm exec playwright test -c playwright.sw.config.ts
 */

test.afterAll(() => closeDb())

test("a reload without network opens the offline screen, and work handed in there is sent later", async ({ page, context }) => {
  const title = `Offline SW ${Date.now()}`
  const assignmentId = await assign(await createSet(title))

  await open(page, "/student/assignments")
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/offline"))), { timeout: 20_000 }).toBe(true)
  const card = page.locator("article", { hasText: title })
  await expect(card.getByText("Đã tải ✓")).toBeVisible({ timeout: 20_000 })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole("heading", { name: "Làm bài offline" })).toBeVisible()
  const item = page.locator("li", { hasText: title })
  await item.getByRole("button", { name: "Bắt đầu" }).click()

  const take = page.getByRole("dialog", { name: `Làm bài: ${title}` })
  await take.getByRole("radio", { name: /56/ }).click()
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
  await take.getByRole("radio", { name: /54/ }).click()
  await take.getByRole("button", { name: "Xem lại", exact: true }).click()
  await take.getByRole("button", { name: "Nộp bài" }).first().click()
  await page.getByRole("dialog", { name: "Nộp bài nhé?" }).getByRole("button", { name: "Nộp bài" }).click()
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()
  await page.getByRole("button", { name: "Về danh sách bài" }).click()
  await expect(item.getByText("Chờ gửi", { exact: true })).toBeVisible()

  // Parent pages need the network.
  const parent = await context.newPage()
  await parent.goto("/parent").catch(() => {})
  await expect(parent.getByRole("heading", { name: "Không có mạng" })).toBeVisible()
  await parent.close()

  await context.setOffline(false)
  await expect.poll(() => attemptsOf(assignmentId), { timeout: 20_000 }).toEqual([
    { attempt_no: 1, submitted: true, submitted_offline: true, score: 10, answered: 2 },
  ])
  await expect(item).toHaveCount(0)
})
