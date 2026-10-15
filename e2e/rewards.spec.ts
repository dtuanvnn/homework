import { expect, test, type Page } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * The parent offers a reward, the child requests it (a double tap still makes
 * one request), the parent declines then hands it over, and adjusts stars by
 * hand. Uses its own uniquely named 1-star reward so seeded data stays usable.
 */

const parentBalance = async (page: Page) => Number(await page.getByTestId("parent-star-balance").textContent())
const section = (page: Page, heading: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: heading, exact: true }) })

test("rewards: request, decline, give and adjust stars", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)
  const name = `Quà E2E ${testInfo.project.name} ${Date.now()}`
  let balance = 0

  await test.step("parent adds a reward", async () => {
    await open(page, "/parent/rewards")
    balance = await parentBalance(page)
    await page.getByRole("button", { name: "Thêm", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Thêm phần thưởng" })
    await dialog.getByLabel("Tên phần thưởng").fill(name)
    await dialog.getByLabel("Số sao").fill("1")
    await dialog.getByRole("button", { name: "Lưu" }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(name)).toBeVisible()
  })

  const requestAsChild = async () => {
    await open(page, "/student/rewards")
    const card = page.getByRole("listitem").filter({ hasText: name })
    await card.getByRole("button", { name: "Đổi", exact: true }).click()
    await page.getByRole("button", { name: "Đổi ngay" }).dblclick()
    await expect(page.getByText("Đã gửi cho bố mẹ!")).toBeVisible()
    await expect(card.getByRole("button", { name: "Đang chờ bố mẹ" })).toBeVisible()
    await expect(page.getByTestId("star-balance")).toHaveText(`⭐${balance - 1} sao`, { timeout: 5_000 })
  }

  await test.step("child requests it once, even with a double tap", async () => {
    await requestAsChild()
    await page.reload()
    await expect(section(page, "Đang chờ bố mẹ").getByText(name, { exact: true })).toHaveCount(1)
  })

  await test.step("parent declines from the dashboard: stars come back", async () => {
    await open(page, "/parent")
    const row = page.getByRole("listitem").filter({ hasText: name })
    await row.getByRole("button", { name: "Từ chối" }).click()
    await expect(row).toBeHidden()
    await open(page, "/parent/rewards")
    await expect.poll(() => parentBalance(page)).toBe(balance)
  })

  await test.step("child asks again and the parent hands it over", async () => {
    await requestAsChild()
    await open(page, "/parent/rewards")
    await section(page, "Yêu cầu đang chờ").getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Đã trao" }).click()
    await expect(section(page, "Lịch sử đổi thưởng").getByRole("listitem").filter({ hasText: name }).first()).toContainText("Đã trao")
    await expect.poll(() => parentBalance(page)).toBe(balance - 1)
  })

  await test.step("parent adds and takes back stars with a reason", async () => {
    await page.getByLabel("Số sao").fill("2")
    await page.getByLabel("Lý do").fill("E2E thưởng thêm")
    await page.getByRole("button", { name: "Cộng sao" }).click()
    await expect(page.getByText("Đã cộng 2 sao")).toBeVisible()
    await expect.poll(() => parentBalance(page)).toBe(balance + 1)
    await page.getByLabel("Số sao").fill("1")
    await page.getByLabel("Lý do").fill("E2E trả lại")
    await page.getByRole("button", { name: "Trừ sao" }).click()
    await expect.poll(() => parentBalance(page)).toBe(balance)
  })

  await test.step("a redeemed reward is hidden instead of deleted", async () => {
    page.once("dialog", (d) => d.accept())
    const row = section(page, "Danh sách phần thưởng").getByRole("listitem").filter({ hasText: name })
    await row.getByRole("button", { name: "Xóa" }).click()
    await expect(page.getByText("Phần thưởng đã có lượt đổi nên được ẩn đi")).toBeVisible()
    await expect(row).toContainText("đang ẩn")
  })

  expect(errors).toEqual([])
})
