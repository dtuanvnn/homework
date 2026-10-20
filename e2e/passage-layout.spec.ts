import { expect, test, type Page } from "@playwright/test"
import { assign, createSetWithQuestions } from "./db"
import { open, trackPageErrors } from "./helpers"

/*
 * Formatted passages: a bài laid out like the paper (instruction, title,
 * paragraphs) with "Nghe cả bài" on the take screen, and a scanned worksheet
 * arriving in the review step already grouped into bài.
 */

// No closeDb() here: the pool is shared by every spec in the worker.
test.describe.configure({ mode: "serial" })

const INSTRUCTION = "Read the text, then answer the questions in FULL sentences."
const PASSAGE = `**${INSTRUCTION}**\n# A Giant Rat\nRats and mice are well-known rodents.\nThe capybara lives near fresh water and loves swimming.`
const group = { id: "bai-rat", prompt: PASSAGE, layout: "doan-van" }
const essay = (prompt: string, extra: object = {}) => ({ type: "tu-luan", prompt, points: 1, skills: [], rubric: "", ...extra })

/** WebKit in CI has no voices: a fake speechSynthesis that records what it is asked to say and never finishes on its own. */
async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const said: string[] = []
    let cancels = 0
    let speaking: Utterance | null = null
    class Utterance {
      text: string
      lang = ""
      rate = 1
      voice: unknown = null
      onstart: (() => void) | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) {
        this.text = text
      }
    }
    const synth: { cancel: () => void; [key: string]: unknown } = {
      getVoices: () => [
        { lang: "en-US", name: "Test English" },
        { lang: "vi-VN", name: "Test Vietnamese" },
      ],
      // Like browsers, cancelling (also done by each speak) ends the utterance being spoken.
      speak: (u: Utterance) => {
        synth.cancel()
        cancels -= 1
        said.push(u.text)
        speaking = u
        u.onstart?.()
      },
      cancel: () => {
        cancels += 1
        const u = speaking
        speaking = null
        u?.onend?.()
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true })
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true })
    Object.defineProperty(window, "__speech", { value: { said, cancels: () => cancels }, configurable: true })
  })
}

const speech = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __speech: { said: string[]; cancels: () => number } }).__speech
    return { said: [...s.said], cancels: s.cancels() }
  })

async function startTake(page: Page, title: string) {
  await open(page, "/student/assignments")
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
  await card.getByRole("button", { name: "Bắt đầu" }).click()
  await expect(page).toHaveURL(/\/student\/assignments\/[^/]+\/do$/, { timeout: 15_000 })
  return page.getByRole("dialog", { name: `Làm bài: ${title}` })
}

test("a formatted passage reads like the paper and is read aloud", async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors = trackPageErrors(page)
  await stubSpeech(page)
  const title = `E2E đoạn văn ${testInfo.project.name} ${Date.now()}`
  const setId = await createSetWithQuestions(title, [
    essay("How do capybaras look different from rats and mice?", { group }),
    essay("Where does the capybara live?", { group }),
    essay("Write one sentence about your pet."),
  ])
  await assign(setId)

  const take = await startTake(page, title)
  const box = take.getByRole("region", { name: "Bài 1" })
  await expect(box.getByText("A Giant Rat", { exact: true })).toBeVisible()
  await expect(box.getByText("A Giant Rat", { exact: true })).toHaveCSS("text-align", "center")
  const instruction = box.getByText(INSTRUCTION, { exact: true })
  await expect(instruction).toBeVisible()
  expect(Number(await instruction.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700)
  await expect(box.getByText("**")).toHaveCount(0)

  await box.getByRole("button", { name: "Nghe cả bài" }).click()
  await expect(box.getByRole("button", { name: "Dừng" })).toBeVisible()
  let s = await speech(page)
  expect(s.said[0]).toBe("A Giant Rat")
  expect(s.said.join(" ")).not.toContain(INSTRUCTION)
  const cancelsWhileReading = s.cancels

  // Moving between câu of the same bài keeps reading.
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
  await expect(box.getByRole("button", { name: "Dừng" })).toBeVisible()
  expect((await speech(page)).cancels).toBe(cancelsWhileReading)

  // Leaving the bài stops it.
  await take.getByRole("button", { name: "Câu tiếp", exact: true }).click()
  await expect(take.getByRole("heading", { name: "Write one sentence about your pet." })).toBeVisible()
  await expect(box).toHaveCount(0)
  s = await speech(page)
  expect(s.cancels).toBeGreaterThan(cancelsWhileReading)

  expect(errors).toEqual([])
})

// A scan draft: the review step opens from it without calling the AI.
const SET_ID = "8b3f6d21-5c4e-4f9a-8b2c-3d4e5f6a7b8c"
const scanGroup = { id: "bai-scan-e2e", prompt: PASSAGE, layout: "doan-van" }
const draftItem = (id: string, prompt: string) => ({ question: essay(prompt, { id, group: scanGroup }), confidence: 0.95, page: 1, reviewed: false })
const draft = {
  version: 1,
  setId: SET_ID,
  savedAt: new Date().toISOString(),
  meta: { subject: "tieng-anh", grade: 3, kind: "chu-de" },
  title: "Reading Worksheet 3 – E2E",
  details: { topic: "Đọc hiểu", description: "", difficulty: 3, estimatedMinutes: 15 },
  items: [
    draftItem("2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4be1", "How do capybaras look different from rats and mice?"),
    draftItem("2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4be2", "What is the same thing between capybaras and most rodents?"),
    draftItem("2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4be3", "How does a capybara keep its teeth short?"),
  ],
  files: [],
  scannedCount: 0,
}

test("a scanned worksheet arrives as one bài", async ({ page }, testInfo) => {
  // Both projects share one seeded database: save the set only once.
  test.skip(testInfo.project.name !== "ipad", "runs once")
  const errors = trackPageErrors(page)
  await page.addInitScript((value) => localStorage.setItem("hh-scan-draft", value), JSON.stringify(draft))
  await open(page, "/parent/library/upload")
  await page.getByRole("button", { name: "Khôi phục" }).click()

  const bai1 = page.getByRole("listitem", { name: "Bài 1" })
  await expect(bai1.getByText("A Giant Rat", { exact: true })).toBeVisible()
  await expect(page.getByText("A Giant Rat", { exact: true })).toHaveCount(1)

  await page.locator("#review-2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4be2").getByRole("button", { name: "Tách thành bài riêng" }).click()
  await expect(page.getByRole("listitem", { name: "Bài 2" })).toBeVisible()
  await page.getByRole("button", { name: "Hoàn tác" }).click()
  await expect(page.getByRole("listitem", { name: "Bài 2" })).toHaveCount(0)

  await page.getByRole("button", { name: "Lưu vào kho bài tập" }).click()
  await expect(page.getByRole("heading", { level: 1, name: draft.title })).toBeVisible({ timeout: 15_000 })
  const saved = page.getByRole("listitem", { name: "Bài 1" })
  await expect(saved.getByText("3 câu · 3 điểm")).toBeVisible()
  await expect(saved.getByText("A Giant Rat", { exact: true })).toBeVisible()

  expect(errors).toEqual([])
})
