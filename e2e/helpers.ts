import { expect, type Page } from "@playwright/test"

/**
 * Full page load that waits for React to hydrate (AppFrame sets `data-mode` on
 * <html> in an effect), so the first click lands on a live button. Student
 * paths without a student cookie land on the child picker: pick `child`.
 */
export async function open(page: Page, path: string, child = "Minh An") {
  await page.goto(path)
  if (path.startsWith("/student") && new URL(page.url()).pathname === "/pin") {
    await page.getByRole("button", { name: child }).click()
    await page.waitForURL((u) => u.pathname.startsWith("/student"))
  }
  await expect(page.locator("html")).toHaveAttribute("data-mode", path.startsWith("/student") ? "student" : "parent")
}

/**
 * Collects uncaught page errors; assert it stays empty. Ignores the dev overlay
 * failing to fetch source-mapped stacks when a navigation cancels the request,
 * "Can't find variable: AudioContext" in Playwright's WebKit (which has no
 * Web Audio: MathLive's playSound() touches its AudioContext on every keypress
 * even with all sounds set to null; real Safari has it), "Load failed" from
 * WebKit when a full navigation aborts a server-action RSC stream that's still
 * arriving after the action resolved (action → redirect/refresh → goto), and
 * "access control checks" errors from Next.js when navigating away from a page
 * whose data fetch was denied (e.g., switching children mid-load).
 */
export function trackPageErrors(page: Page) {
  const errors: string[] = []
  let lastNavTime = 0
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) lastNavTime = Date.now()
  })
  page.on("pageerror", (e) => {
    const isWebKitLoadFailed = e.message === "Load failed" && Date.now() - lastNavTime < 2000
    const isAccessControlError = e.message.includes("access control checks")
    if (!e.message.includes("__nextjs_original-stack-frames") && !e.message.includes("AudioContext") && !isWebKitLoadFailed && !isAccessControlError) {
      errors.push(e.message)
    }
  })
  return errors
}
