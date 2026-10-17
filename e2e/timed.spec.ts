import { expect, test, type Page } from "@playwright/test"
import pg from "pg"
import { open, trackPageErrors } from "./helpers"

/*
 * Exam mode: the parent sets a time limit when assigning, the child starts the
 * clock, gets the last-minute warning and the work is handed in at zero. A
 * child who leaves mid-way finds the attempt handed in once time has passed.
 *
 * Only the browser clock can be faked (page.clock), so the server-side expiry
 * is reached by moving the attempt's start back in the database.
 */

test.describe.configure({ mode: "serial" })

process.loadEnvFile(".env.local")
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
test.afterAll(() => pool.end())

const sql = async <T extends pg.QueryResultRow>(text: string, params: unknown[] = []) => (await pool.query<T>(text, params)).rows

const mc = (prompt: string, options: string[], correctIndex: number) => ({ type: "trac-nghiem", prompt, options, correctIndex, points: 5, skills: ["Tính nhẩm"] })

/** A ready two-question set with a unique title. */
async function createSet(title: string) {
  const [{ household_id }] = await sql<{ household_id: string }>(`select household_id from students order by created_at limit 1`)
  const [set] = await sql<{ id: string }>(
    `insert into exercise_sets (household_id, title, subject, grade, estimated_minutes, kind, source, status) values ($1, $2, 'toan', 3, 10, 'luyen-tap', 'thu-cong', 'san-sang') returning id`,
    [household_id, title],
  )
  const questions = [mc("7 × 8 = ?", ["54", "56", "58", "64"], 1), mc("9 × 6 = ?", ["45", "54", "56", "63"], 1)]
  for (const [position, content] of questions.entries()) {
    await sql(`insert into questions (set_id, position, content) values ($1, $2, $3)`, [set.id, position, JSON.stringify(content)])
  }
  return set.id
}

const takeScreen = (page: Page, title: string) => page.getByRole("dialog", { name: `Làm bài: ${title}` })

async function startTimed(page: Page, assignmentId: string, title: string, minutes: number) {
  await open(page, `/student/assignments/${assignmentId}/do`)
  const start = page.getByRole("dialog", { name: `Bắt đầu: ${title}` })
  await expect(start.getByText(`${minutes} phút`)).toBeVisible()
  await start.getByRole("button", { name: "Bắt đầu" }).click()
  const take = takeScreen(page, title)
  await expect(take.getByRole("timer")).toBeVisible()
  return take
}

test("parent assigns with a time limit; the child gets warned and the work is handed in at zero", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors = trackPageErrors(page)
  const title = `Thi ${testInfo.project.name} ${Date.now()}`
  await createSet(title)

  await test.step("parent picks a 2-minute limit in the assign sheet", async () => {
    await open(page, "/parent/schedule")
    // "Giao bài mới" in the header on iPad, a floating "Giao bài" on phones.
    await page.getByRole("button", { name: /^Giao bài( mới)?$/ }).filter({ visible: true }).first().click()
    const sheet = page.getByRole("dialog", { name: "Giao bài mới" })
    await sheet.getByLabel("Tìm bộ bài tập").fill(title)
    await sheet.getByRole("radio", { name: new RegExp(title) }).click()
    await sheet.getByRole("radio", { name: "Khác" }).click()
    await sheet.locator("#assign-limit-minutes").fill("2")
    await sheet.getByRole("button", { name: "Giao bài", exact: true }).click()
    await expect(page.getByText(/^Đã giao 1 bài/)).toBeVisible()
  })

  const [{ id: assignmentId, time_limit_minutes }] = await sql<{ id: string; time_limit_minutes: number }>(
    `select a.id, a.time_limit_minutes from assignments a join exercise_sets s on s.id = a.set_id where s.title = $1`,
    [title],
  )
  expect(time_limit_minutes).toBe(2)

  await test.step("the child sees the chip, starts the clock and answers", async () => {
    await open(page, "/student")
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await expect(card.getByText("⏱ 2 phút")).toBeVisible()

    await page.clock.install()
    const take = await startTimed(page, assignmentId, title, 2)
    await take.getByRole("radio", { name: /56/ }).click()
    await expect(take.getByText("Đã lưu")).toBeVisible()
  })

  await test.step("one minute left: red clock and a warning", async () => {
    await page.clock.fastForward("01:05")
    await expect(page.getByText("Còn 1 phút!")).toBeVisible()
    await expect(takeScreen(page, title).getByRole("timer")).toHaveAccessibleName(/^Còn 00:5\d$/)
  })

  await test.step("at zero the work is handed in and graded", async () => {
    await page.clock.fastForward("01:00")
    await expect(page.getByText("Hết giờ!")).toBeVisible()
    await expect(page).toHaveURL(/\/student\/results\//, { timeout: 15_000 })
    await expect(page.getByText(/Thời gian làm bài: \d+\/2 phút/)).toBeVisible()
  })

  expect(errors).toEqual([])
})

test("a timed attempt left mid-way is handed in once its time has passed", async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors = trackPageErrors(page)
  const title = `Thi dở ${testInfo.project.name} ${Date.now()}`
  const setId = await createSet(title)
  const [{ id: assignmentId }] = await sql<{ id: string }>(
    `insert into assignments (student_id, set_id, available_from, due_at, mode, max_attempts, time_limit_minutes)
     select id, $1, now() - interval '1 hour', now() + interval '1 day', 'web', 2, 10 from students order by created_at limit 1 returning id`,
    [setId],
  )

  await test.step("the child starts, answers one question and leaves", async () => {
    const take = await startTimed(page, assignmentId, title, 10)
    await take.getByRole("radio", { name: /56/ }).click()
    await expect(take.getByText("Đã lưu")).toBeVisible()
    await take.getByRole("button", { name: "Thoát" }).click()
    const confirm = page.getByRole("dialog", { name: "Lưu và thoát?" })
    await expect(confirm.getByText(/Đồng hồ vẫn chạy/)).toBeVisible()
    await confirm.getByRole("button", { name: "Lưu và thoát" }).click()
    await expect(page).toHaveURL(/\/student$/)
  })

  // Pretend the child started an hour ago: ten minutes plus the grace period are long gone.
  const [attempt] = await sql<{ id: string }>(
    `update attempts set started_at = now() - interval '1 hour' where assignment_id = $1 returning id`,
    [assignmentId],
  )

  await test.step("opening the app hands it in with the saved answer", async () => {
    await open(page, "/student/assignments")
    const [row] = await sql<{ submitted_at: Date | null; duration_seconds: number; score: number | null }>(
      `select submitted_at, duration_seconds, score from attempts where id = $1`,
      [attempt.id],
    )
    expect(row.submitted_at).not.toBeNull()
    expect(row.duration_seconds).toBe(600)
    expect(row.score).toBe(5)
  })

  await test.step("the parent sees it was handed in by the timer", async () => {
    await open(page, `/parent/grading/${attempt.id}`)
    await expect(page.getByText("⏰ Hết giờ – tự nộp")).toBeVisible()
    await expect(page.getByText("Làm trong 10/10 phút")).toBeVisible()
  })

  expect(errors).toEqual([])
})

test("time runs out while offline: the work is handed in on the device and sent later", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000)
  const title = `Thi mất mạng ${testInfo.project.name} ${Date.now()}`
  const setId = await createSet(title)
  const [{ id: assignmentId }] = await sql<{ id: string }>(
    `insert into assignments (student_id, set_id, available_from, due_at, mode, max_attempts, time_limit_minutes)
     select id, $1, now() - interval '1 hour', now() + interval '1 day', 'web', 2, 1 from students order by created_at limit 1 returning id`,
    [setId],
  )

  await page.clock.install()
  const take = await startTimed(page, assignmentId, title, 1)
  await take.getByRole("radio", { name: /56/ }).click()
  await expect(take.getByText("Đã lưu")).toBeVisible()

  await context.setOffline(true)
  await page.clock.fastForward("01:00")
  await expect(page.getByText("Hết giờ!")).toBeVisible()
  // No network: the hand-in waits in the device's queue.
  await expect(page.getByText("Đã nộp — sẽ gửi khi có mạng")).toBeVisible()
  await expect(page).toHaveURL(/\/do$/)

  // Back online: the queued hand-in is sent and graded on the server, answers kept.
  await context.setOffline(false)
  await expect(page.getByText("Đã gửi 1 bài")).toBeVisible({ timeout: 20_000 })
  const [attempt] = await sql<{ submitted_offline: boolean; submitted: boolean; answered: number }>(
    `select a.submitted_offline, a.submitted_at is not null as submitted,
            (select count(*)::int from answers w where w.attempt_id = a.id and w.response is not null) as answered
       from attempts a where a.assignment_id = $1`,
    [assignmentId],
  )
  expect(attempt).toEqual({ submitted_offline: true, submitted: true, answered: 1 })
})
