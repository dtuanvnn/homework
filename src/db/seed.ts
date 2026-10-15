/**
 * Resets the database to a realistic demo: one Grade 3 student, the seed
 * library, six weeks of graded history and a current week with every
 * assignment state (graded, awaiting grading, in progress, overdue, upcoming).
 *
 * Scores come from simulated answers run through the real grader, so
 * dashboards and skill analytics are computed from actual answer rows.
 *
 *   pnpm db:seed            (local database only)
 *   pnpm db:seed --force    (any DATABASE_URL — wipes it!)
 */
process.env.TZ = "Asia/Ho_Chi_Minh"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { eq } from "drizzle-orm"
import { createClient } from "@supabase/supabase-js"
import { gradeAttempt, scoreOutOf10, type Response } from "@/lib/grading"
import { addDays, startOfDay } from "@/lib/dates"
import { computeRewards } from "@/lib/views/rewards"
import type { Question } from "@/lib/types"
import { loadRewardFacts } from "./reward-facts"
import * as schema from "./schema"
import { DEMO_WORKSHEET_URL, SEED_SETS } from "./seed-data"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url)
if (!isLocal && !process.argv.includes("--force")) {
  throw new Error("Refusing to wipe a non-local database. Re-run with --force if you really mean it.")
}

const client = postgres(url, { prepare: false, max: 1 })
const db = drizzle(client, { schema, casing: "snake_case" })

/* ---------- Deterministic randomness ---------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = mulberry32(20261015)

/* ---------- Simulated answers ---------- */

/** Skills the demo child struggles with, so "Cần chú ý" has something to say. */
const WEAK_SKILLS = new Set(["Toán có lời văn", "Dấu hỏi/ngã", "Số đếm 11–20", "Grammar: to be"])

function correctResponse(q: Question): Response {
  switch (q.type) {
    case "trac-nghiem": return q.correctIndex
    case "dung-sai": return q.answer
    case "dien-cho-trong": return q.answers
    case "tra-loi-ngan": return q.answer
    case "noi": return Object.fromEntries(q.pairs.map((_, i) => [String(i), i]))
    case "sap-xep": return q.tokens.map((_, i) => i)
    case "tu-luan": return { text: "Em viết bài theo yêu cầu của đề." }
  }
}

function wrongResponse(q: Question): Response {
  switch (q.type) {
    case "trac-nghiem": return (q.correctIndex + 1) % q.options.length
    case "dung-sai": return !q.answer
    case "dien-cho-trong": return q.answers.map((a, i) => (i === q.answers.length - 1 ? `${a}?` : a))
    case "tra-loi-ngan": return "0"
    case "noi": return Object.fromEntries(q.pairs.map((_, i) => [String(i), i < 2 ? 1 - i : i]))
    case "sap-xep": return q.shuffled
    case "tu-luan": return { text: "Em chưa viết xong." }
  }
}

/** `skill` is the child's overall accuracy (0–1) at the time of the attempt. */
function simulate(questions: Question[], skill: number): Record<string, Response> {
  return Object.fromEntries(
    questions.map((q) => {
      const p = q.skills.some((s) => WEAK_SKILLS.has(s)) ? skill - 0.35 : skill
      return [q.id, random() < p ? correctResponse(q) : wrongResponse(q)]
    }),
  )
}

/** Parent-style points for an essay: proportional to skill, in half points. */
const essayPoints = (q: Question, skill: number) => Math.min(q.points, Math.round(q.points * Math.min(1, skill + (random() - 0.5) * 0.2) * 2) / 2)

const FEEDBACK = [
  [9, "Rất tốt! Con làm gần như đúng hết."],
  [8, "Giỏi lắm! Chỉ cần cẩn thận thêm một chút."],
  [7, "Khá tốt, con xem lại những câu sai nhé."],
  [5, "Con cố lên nhé! Mẹ con mình cùng ôn lại phần này."],
  [0, "Không sao đâu, mình làm lại lần 2 nhé!"],
] as const
const feedbackFor = (score: number) => FEEDBACK.find(([min]) => score >= min)![1]

const ESSAY_COMMENTS = ["Ý hay, trình bày rõ ràng.", "Con viết đúng ý, chú ý dấu câu nhé.", "Cần viết đầy đủ câu trả lời hơn."]

/* ---------- Helpers ---------- */

const now = new Date()
const today = startOfDay(now)
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = addDays(today, dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}
const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000)

type SetRow = typeof schema.exerciseSets.$inferSelect
type Loaded = { row: SetRow; questions: Question[] }

interface AttemptPlan {
  /** Accuracy 0–1 used to simulate answers. */
  skill: number
  /** Leave essays/paper answers ungraded (awaiting the parent). */
  awaitingParent?: boolean
  /** Saved draft, never submitted. */
  draft?: boolean
  /** Parent closed the assignment instead of allowing a retry. */
  noRetry?: boolean
  dayOffset: number
  hour: number
}

interface AssignmentPlan {
  set: string
  availableDay: number
  dueDay: number
  dueHour: number
  mode?: "web" | "paper"
  maxAttempts?: 1 | 2
  note?: string
  attempts?: AttemptPlan[]
}

/* ---------- Plan ---------- */

/** Skill grows from ~0.72 six weeks ago to ~0.9 now. */
const skillAt = (dayOffset: number) => 0.9 + (dayOffset / 42) * 0.19

function history(): AssignmentPlan[] {
  const rotation = ["bt-01", "bt-07", "bt-13", "bt-04", "bt-08", "bt-12", "bt-02", "bt-09", "bt-14", "bt-03", "bt-07", "bt-13", "bt-14", "bt-05", "bt-10", "bt-12", "bt-03"]
  const days = [-40, -38, -37, -33, -32, -30, -26, -24, -23, -19, -18, -17, -16, -12, -11, -10, -8]
  return rotation.map((set, i) => {
    const d = days[i]
    const skill = skillAt(d)
    const retry = i % 4 === 0
    return {
      set,
      availableDay: d,
      dueDay: d,
      dueHour: 20,
      mode: i % 5 === 2 ? "paper" : "web",
      maxAttempts: retry ? 2 : 1,
      attempts: [
        { skill: skill - (retry ? 0.15 : 0), dayOffset: d, hour: 19 },
        ...(retry ? [{ skill: skill + 0.1, dayOffset: d + 1, hour: 18 }] : []),
      ],
    } satisfies AssignmentPlan
  })
}

const CURRENT: AssignmentPlan[] = [
  // Graded, with a second attempt that improved the score.
  { set: "bt-01", availableDay: -3, dueDay: -3, dueHour: 20, attempts: [{ skill: 0.6, dayOffset: -3, hour: 19 }, { skill: 0.92, dayOffset: -2, hour: 18 }] },
  // Graded paper work, single attempt.
  { set: "bt-07", availableDay: -3, dueDay: -2, dueHour: 20, mode: "paper", maxAttempts: 1, attempts: [{ skill: 0.82, dayOffset: -2, hour: 19, noRetry: true }] },
  // Graded, second attempt still available.
  { set: "bt-12", availableDay: -2, dueDay: -2, dueHour: 20, attempts: [{ skill: 0.7, dayOffset: -2, hour: 19 }] },
  // Overdue: never started (four days back, so the last three days still make a streak).
  { set: "bt-02", availableDay: -5, dueDay: -4, dueHour: 20, note: "Con nhớ kiểm tra lại số dư nhé!" },
  // Awaiting grading: web attempt with an essay.
  { set: "bt-08", availableDay: -1, dueDay: -1, dueHour: 20, attempts: [{ skill: 0.85, dayOffset: -1, hour: 19, awaitingParent: true }] },
  // Awaiting grading: paper submission.
  { set: "bt-06", availableDay: 0, dueDay: 0, dueHour: 17, mode: "paper", note: "Con nhớ đặt tính thẳng hàng nhé!", attempts: [{ skill: 0.8, dayOffset: 0, hour: 16, awaitingParent: true }] },
  // In progress: draft answers saved.
  { set: "bt-11", availableDay: 0, dueDay: 0, dueHour: 19, note: "Viết cẩn thận, chú ý dấu thanh.", attempts: [{ skill: 0.9, dayOffset: 0, hour: 15, draft: true }] },
  // Not started yet.
  { set: "bt-15", availableDay: 0, dueDay: 0, dueHour: 20, note: "Con làm cẩn thận nhé!" },
  // Upcoming.
  { set: "bt-03", availableDay: 0, dueDay: 1, dueHour: 20 },
  { set: "bt-14", availableDay: 0, dueDay: 1, dueHour: 20 },
  { set: "bt-09", availableDay: 1, dueDay: 2, dueHour: 19, mode: "paper", maxAttempts: 1 },
  // Scheduled: hidden from the student until it opens.
  { set: "bt-04", availableDay: 3, dueDay: 4, dueHour: 20, note: "Nhớ tóm tắt đề trước khi giải nhé." },
]

/* ---------- Run ---------- */

/** 1×1 PNG; the browser scales it to the stored size. Enough to test that figures load. */
const SEED_FIGURE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

async function seedFigure(set: Loaded) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return console.log("No SUPABASE_URL/SUPABASE_SECRET_KEY: skipping the seed figure")
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage
  const bucket = process.env.STORAGE_BUCKET ?? "homework"
  const { data } = await storage.getBucket(bucket)
  if (!data) await storage.createBucket(bucket, { public: false, fileSizeLimit: "20MB" })
  const path = `sets/${set.row.id}/${crypto.randomUUID()}-figure.jpg`
  const { error } = await storage.from(bucket).upload(path, SEED_FIGURE, { contentType: "image/png", upsert: true })
  if (error) throw error
  const question = set.questions.find((x) => x.type === "trac-nghiem")
  if (!question) return
  const { id, ...content } = { ...question, image: { path, width: 240, height: 160 } }
  await db.update(schema.questions).set({ content }).where(eq(schema.questions.id, id))
}

async function main() {
  console.log("Resetting tables…")
  await client`truncate table answers, attachments, attempts, assignments, questions, exercise_sets, students, reward_redemptions, rewards, star_adjustments, badge_seen restart identity cascade`

  const [student] = await db.insert(schema.students).values({ name: "Minh An", grade: 3, avatarEmoji: "🦊" }).returning()

  console.log(`Inserting ${SEED_SETS.length} exercise sets…`)
  const sets = new Map<string, Loaded>()
  for (const s of SEED_SETS) {
    const created = minutes(addDays(today, -s.ageDays), 9 * 60)
    const [row] = await db
      .insert(schema.exerciseSets)
      .values({
        title: s.title, subject: s.subject, grade: s.grade, topic: s.topic, description: s.description,
        estimatedMinutes: s.estimatedMinutes, difficulty: s.difficulty, kind: s.kind, source: s.source, status: s.status,
        createdAt: created, updatedAt: created,
      })
      .returning()
    const qRows = await db
      .insert(schema.questions)
      .values(s.questions.map((content, position) => ({ setId: row.id, position, content })))
      .returning()
    sets.set(s.key, { row, questions: qRows.map((q) => ({ ...q.content, id: q.id }) as Question) })
    if (s.source === "tai-len") {
      await db.insert(schema.attachments).values([
        { setId: row.id, name: "phieu-bai-tap-trang-1.jpg", kind: "image", sizeKb: 842, externalUrl: DEMO_WORKSHEET_URL, position: 0 },
      ])
    }
  }

  await seedFigure(sets.get("bt-20")!)

  const plans = [...history(), ...CURRENT]
  console.log(`Inserting ${plans.length} assignments with attempts…`)
  for (const plan of plans) {
    const set = sets.get(plan.set)
    if (!set) throw new Error(`Unknown seed set ${plan.set}`)
    const mode = plan.mode ?? "web"
    const [assignment] = await db
      .insert(schema.assignments)
      .values({
        studentId: student.id,
        setId: set.row.id,
        availableFrom: at(plan.availableDay, 6),
        dueAt: at(plan.dueDay, plan.dueHour),
        mode,
        maxAttempts: plan.maxAttempts ?? 2,
        parentNote: plan.note ?? null,
        createdAt: at(plan.availableDay - 1, 21),
      })
      .returning()

    const attemptPlans = plan.attempts ?? []
    for (const [index, a] of attemptPlans.entries()) {
      await insertAttempt(assignment.id, index + 1, mode, set, a, index === attemptPlans.length - 1)
    }
  }

  await seedRewards()

  const counts = await Promise.all(
    [schema.exerciseSets, schema.questions, schema.assignments, schema.attempts, schema.answers].map((t) => db.$count(t)),
  )
  console.log(`Done: ${counts.join(" / ")} (sets / questions / assignments / attempts / answers)`)
  await client.end()
}

const SEED_REWARDS = [
  { name: "Xem TV 30 phút", emoji: "📺", cost: 20 },
  { name: "Chơi game 1 giờ", emoji: "🎮", cost: 40 },
  { name: "Đi ăn kem", emoji: "🍦", cost: 50 },
  { name: "Mua truyện mới", emoji: "📚", cost: 80 },
]

async function seedRewards() {
  const rows = await db
    .insert(schema.rewards)
    .values(SEED_REWARDS.map((r, position) => ({ ...r, position, createdAt: at(-30, 21) })))
    .returning()
  const tv = rows[0]
  await db.insert(schema.rewardRedemptions).values([
    { rewardId: tv.id, name: tv.name, emoji: tv.emoji, cost: tv.cost, status: "given", requestedAt: at(-9, 19), decidedAt: at(-9, 20) },
    { rewardId: tv.id, name: tv.name, emoji: tv.emoji, cost: tv.cost, status: "pending", requestedAt: at(-1, 19, 30) },
  ])
  await db.insert(schema.starAdjustments).values({ amount: 10, reason: "Tự giác ôn bài cả tuần", createdAt: at(-6, 20) })
  // Everything earned so far was already celebrated, so the Today page starts calm (E2E relies on it).
  const { facts, seen } = await loadRewardFacts(db)
  const state = computeRewards(facts, seen, now)
  const ids = state.celebrations.map((c) => c.id)
  if (ids.length) await db.insert(schema.badgeSeen).values(ids.map((badgeId) => ({ badgeId })))
  console.log(`Rewards: ${state.ledger.balance} stars, streak ${state.streak.current}, ${state.badges.filter((b) => b.earnedAt).length} badges`)
}

async function insertAttempt(assignmentId: string, attemptNo: number, mode: "web" | "paper", set: Loaded, plan: AttemptPlan, isLast: boolean) {
  const { questions } = set
  const started = at(plan.dayOffset, plan.hour, Math.floor(random() * 30))
  const duration = Math.round(set.row.estimatedMinutes * (0.7 + random() * 0.6))

  if (plan.draft) {
    const drafted = questions.slice(0, 2)
    const responses = simulate(drafted, plan.skill)
    const [attempt] = await db.insert(schema.attempts).values({ assignmentId, attemptNo, mode, startedAt: started }).returning()
    await db.insert(schema.answers).values(
      drafted.map((q, position) => ({ attemptId: attempt.id, questionId: q.id, position, question: q, response: responses[q.id] })),
    )
    return
  }

  const submitted = minutes(started, duration)
  const paper = mode === "paper"
  const responses = paper ? {} : simulate(questions, plan.skill)
  const auto = gradeAttempt(questions, responses)
  // Paper work has no typed answers: the parent marks each question from the scan.
  const rows = questions.map((q, position) => {
    const g = auto.grades[position]
    if (plan.awaitingParent && (paper || g.isCorrect === null)) {
      return { position, q, response: paper ? null : responses[q.id], isCorrect: null, points: null, comment: null }
    }
    if (paper) {
      const ok = random() < plan.skill
      return { position, q, response: null, isCorrect: ok, points: ok ? q.points : 0, comment: null }
    }
    if (g.isCorrect === null) {
      const points = essayPoints(q, plan.skill)
      return { position, q, response: responses[q.id], isCorrect: points >= q.points / 2, points, comment: ESSAY_COMMENTS[Math.floor(random() * ESSAY_COMMENTS.length)] }
    }
    return { position, q, response: responses[q.id], isCorrect: g.isCorrect, points: g.pointsAwarded, comment: null }
  })

  const ungraded = rows.some((r) => r.points === null)
  const total = questions.reduce((s, q) => s + q.points, 0)
  const score = ungraded ? null : scoreOutOf10(rows.reduce((s, r) => s + (r.points ?? 0), 0), total)
  const hasParentWork = paper || questions.some((q) => q.type === "tu-luan")

  const [attempt] = await db
    .insert(schema.attempts)
    .values({
      assignmentId, attemptNo, mode,
      startedAt: started,
      submittedAt: submitted,
      durationSeconds: duration * 60,
      gradedAt: ungraded ? null : minutes(submitted, 90),
      gradedBy: ungraded ? null : hasParentWork ? "parent" : "auto",
      score,
      feedback: score === null ? null : feedbackFor(score),
      retryAllowed: !plan.noRetry && isLast,
    })
    .returning()

  await db.insert(schema.answers).values(
    rows.map((r) => ({
      attemptId: attempt.id, questionId: r.q.id, position: r.position, question: r.q,
      response: r.response ?? null, isCorrect: r.isCorrect, pointsAwarded: r.points, comment: r.comment,
    })),
  )
  if (paper) {
    await db.insert(schema.attachments).values({ attemptId: attempt.id, name: "bai-lam-trang-1.jpg", kind: "image", sizeKb: 910, externalUrl: DEMO_WORKSHEET_URL })
  }
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
