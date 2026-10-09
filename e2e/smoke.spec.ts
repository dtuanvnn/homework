import { expect, test } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

const ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: "/parent", heading: /^(Tổng quan|Chào)/ },
  { path: "/parent/library", heading: "Kho bài tập" },
  { path: "/parent/schedule", heading: "Lịch giao bài" },
  { path: "/parent/grading", heading: "Chấm bài" },
  { path: "/parent/reports", heading: "Báo cáo" },
  { path: "/student", heading: /^Chào / },
  { path: "/student/assignments", heading: "Bài của em" },
  { path: "/student/results", heading: /^Kết quả/ },
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

test("mode toggle switches between parent and student", async ({ page }) => {
  const errors = trackPageErrors(page)
  const toggle = page.getByRole("radiogroup", { name: "Chọn chế độ" }).filter({ visible: true })
  // The dev-tools badge sits on top of the collapsed iPad sidebar's toggle.
  const hideDevBadge = () => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })

  await open(page, "/parent")
  await hideDevBadge()
  await toggle.getByRole("radio", { name: "Học sinh" }).tap()
  await expect(page).toHaveURL(/\/student$/)
  await expect(page.getByText("Đã chuyển sang chế độ Học sinh")).toBeVisible()
  await expect(toggle.getByRole("radio", { name: "Học sinh" })).toHaveAttribute("aria-checked", "true")

  // Fresh load: on the phone the confirmation toast covers the app-bar toggle for a while.
  await open(page, "/student")
  await hideDevBadge()
  await toggle.getByRole("radio", { name: "Phụ huynh" }).tap()
  await expect(page).toHaveURL(/\/parent$/)
  await expect(page.getByText("Đã chuyển sang chế độ Phụ huynh")).toBeVisible()
  await expect(toggle.getByRole("radio", { name: "Phụ huynh" })).toHaveAttribute("aria-checked", "true")
  expect(errors).toEqual([])
})
