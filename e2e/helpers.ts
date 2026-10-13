import { expect, type Page } from "@playwright/test"

/**
 * Full page load that waits for React to hydrate (AppFrame sets `data-mode` on
 * <html> in an effect), so the first click lands on a live button.
 */
export async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator("html")).toHaveAttribute("data-mode", path.startsWith("/student") ? "student" : "parent")
}

/**
 * Collects uncaught page errors; assert it stays empty. Ignores the dev overlay
 * failing to fetch source-mapped stacks when a navigation cancels the request,
 * and "Can't find variable: AudioContext" in Playwright's WebKit, which has no
 * Web Audio: MathLive's playSound() touches its AudioContext on every keypress
 * even with all sounds set to null (real Safari has it).
 */
export function trackPageErrors(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (e) => {
    if (!e.message.includes("__nextjs_original-stack-frames") && !e.message.includes("AudioContext")) {
      errors.push(e.message)
    }
  })
  return errors
}
