import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.E2E_SW_PORT ?? 3300)

/*
 * Service worker checks (e2e/*.sw.ts): a production server, because the worker
 * is only registered in production builds, and Chromium, because Playwright's
 * WebKit can't drive service workers. Run `pnpm build` first.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.sw.ts",
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1024, height: 1366 },
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    // Production refuses to sign PIN cookies without a secret; any value works for the local run.
    env: { SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-sw-local-secret-0123456789abcdef" },
    url: `http://localhost:${PORT}/offline`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
