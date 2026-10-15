import { expect, test } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

const ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: "/parent", heading: /^(Tổng quan|Chào)/ },
  { path: "/parent/library", heading: "Kho bài tập" },
  { path: "/parent/schedule", heading: "Lịch giao bài" },
  { path: "/parent/grading", heading: "Chấm bài" },
  { path: "/parent/reports", heading: "Báo cáo" },
  { path: "/parent/rewards", heading: "Phần thưởng" },
  { path: "/student", heading: /^Chào / },
  { path: "/student/assignments", heading: "Bài của em" },
  { path: "/student/results", heading: /^Kết quả/ },
  { path: "/student/rewards", heading: "Phần thưởng" },
]

for (const { path, heading } of ROUTES) {
  test(`${path} renders without page errors`, async ({ page }) => {
    const errors = trackPageErrors(page)
    await open(page, path)
    await expect(page.getByRole("main")).toBeVisible()
    // Phone shows the title in the app bar, iPad in the page itself: either is fine.
    await expect(page.getByRole("heading", { level: 1, name: heading }).filter({ visible: true }).first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test("hold avatar to open parent mode from student", async ({ page }) => {
  const errors = trackPageErrors(page)
  // Student mode has no visible way to parent mode; a 2 s hold on the avatar opens it.
  await open(page, "/student")
  await expect(page.getByRole("radiogroup", { name: "Chọn chế độ" })).toHaveCount(0)
  const avatar = page.getByTestId("hold-to-open").filter({ visible: true })
  await avatar.click()
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/student$/)
  const box = (await avatar.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForURL(/\/parent/, { timeout: 5_000 })
  await page.mouse.up()
  expect(errors).toEqual([])
})
