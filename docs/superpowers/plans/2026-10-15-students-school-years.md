# Multiple Students and School Years Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One parent manages several children (each on their own device, own PIN), every child's work, stars and badges are separate, grades are kept per school year with a manual "Lên lớp", a child can be locked temporarily, and the parent/student toggle is hidden from children.

**Architecture:** New `households` + `enrollments` tables; `household_id` on root tables, `student_id` on reward tables. A signed `hh_pin` token (HMAC) names role + household + child; the proxy only verifies it and stamps an `x-hh-mode` header. `getContext()` / `assertAccess()` in `src/server/access.ts` turn that into `{ householdId, mode, studentId, locked }`, and every query in `queries.ts` and every action scopes itself through it plus the ownership helpers in `src/server/ownership.ts`. UI: parent header avatar menu (switch viewing child), hold-to-open avatar in student mode, `/parent/students` pages.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, Server Actions, `typedRoutes`), Drizzle + node-postgres, Supabase Postgres, zod, Web Crypto, Vitest, Playwright (WebKit iPad + iPhone), shadcn/ui primitives in `src/components/ui`, motion (`src/lib/animations.ts`).

**Spec:** `docs/superpowers/specs/2026-10-15-students-school-years-design.md`

## Global Constraints

- All UI text is Vietnamese; error messages thrown from actions are Vietnamese.
- Every Server Action: `assertAccess(role)` first, zod validation, Drizzle write, `refresh()` from `next/cache`, wrapped in `runAction()` (except the existing `Result`-returning attempt actions, which keep their shape).
- No action trusts a `studentId` / `householdId` from the client, except `setViewingStudent` and the `studentIds` of `createAssignments`, both checked against the context household.
- Read-side DB access goes through `src/server/queries.ts` (and `rewards.ts`, `analytics.ts`, `students.ts`); test files can't import `server-only` modules, so pure logic lives in `src/lib/`.
- Every attempt reader keeps awaiting `settleExpiredAttempts()` first.
- Build links with helpers in `src/components/layout/routes.ts`; new sub-pages need a `SUB_PAGE_TITLES` entry.
- Dates: school-year dates are local `"yyyy-mm-dd"` strings (Vietnam time; `process.env.TZ` is set by `src/instrumentation.ts`); a school year is named by its start year (2026 = "2026–2027"), default start 5 September.
- PINs: 4–6 digits. Student PIN hash = SHA-256 of `homework-hub:student:{studentId}:{pin}`, base64url.
- Token: `base64url(JSON payload).base64url(HMAC-SHA256)`, secret env `SESSION_SECRET` (dev fallback `homework-hub-dev-secret`, required in production); lifetime student 180 days, parent 30 days.
- Before writing Next-specific code, read the relevant guide under `node_modules/next/dist/docs/` (AGENTS.md); the proxy guide is `01-app/03-api-reference/03-file-conventions/proxy.md` (request headers: `NextResponse.next({ request: { headers } })`; proxy runs on Node.js).
- Keep the visual language of existing screens (cards, sheets, `celebrate()` from `src/lib/animations.ts`).

## Review Focus

1. **Cross-child access by id** — a student token for Bảo Ngọc opening Minh An's result/take URL, or a parent action called with an id from another household, must get "not found", never data. Pinned by the isolation E2E in Task 5 and the ownership checks in every action.
2. **Stale or forged cookies after deploy** — an old-format `hh_pin`, a tampered payload, an expired token or a token naming an archived child must land on the PIN page, not a 500. Pinned by `session-token.test.ts` (Task 2) and the archived-child redirect in `contextFor` (Task 4, manual check in Step 9).
3. **Household with no active child** (fresh install, all archived) — parent pages render "Chưa có học sinh nào", the student PIN grid shows "Nhờ bố mẹ thêm học sinh trước nhé.", nothing throws. Pinned in Task 7 Step 7.
4. **Lock during a timed attempt** — locking refuses student writes but the attempt still auto-hands-in at its deadline; unlocking needs no PIN re-entry. Pinned by the lock E2E (Task 9) and the manual timed check in Task 9 Step 6.
5. **School-year boundaries** — a day exactly on the next year's `startsOn`, a child with only future enrollments, promotion at grade 12. Pinned in `school-year.test.ts` (Task 1).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/school-year.ts` (new) | Pure enrollment/year math |
| `src/lib/student-lock.ts` (new) | Pure lock state + lock-duration choices |
| `src/lib/session-token.ts` (new) | Sign/verify the `hh_pin` token (Web Crypto) |
| `src/lib/report-years.ts` (new) | A school year as a Reports custom range |
| `src/lib/pin.ts` | Cookie names, mode header, parent PIN from env, student PIN hash, `roleForPath` |
| `src/lib/dates.ts` | + `localDay()` |
| `src/db/schema.ts` | New tables/columns |
| `drizzle/0005_*.sql` (generated, hand-edited) | Migration with backfill |
| `src/db/reward-facts.ts` | Reward facts per child |
| `src/db/seed.ts` | Household, two children, enrollments, last-year history |
| `src/server/access.ts` | Session → `Context`; `assertAccess`, `getContext`, `hasAccess`, `currentRole` |
| `src/server/ownership.ts` (new) | `assert*InScope` helpers |
| `src/server/students.ts` (new) | Read side for children/enrollments |
| `src/server/actions/students.ts` (new) | Manage children, PIN, archive, lock, promote, enrollments, viewing child |
| `src/server/actions/pin.ts` | Parent PIN + student pick/PIN → token |
| `src/proxy.ts` | Verify token, stamp mode header |
| `src/app/pin/*` | PIN page with child avatar grid |
| `src/components/layout/HoldToOpen.tsx` (new) | 2 s press-and-hold wrapper |
| `src/components/layout/ParentMenu.tsx` (new) | Header avatar menu for parents |
| `src/components/layout/LockScreen.tsx` (new) | Child's lock screen |
| `src/components/students/*` (new) | Students sheets, detail, empty state |
| `src/components/pages/Students.tsx` (new) | Students list |
| `src/app/(app)/parent/students/page.tsx`, `[id]/page.tsx` (new) | Students pages |
| `src/components/pages/Reports.tsx` | Year chips |
| `src/components/schedule/AssignSheet.tsx`, `src/state/library-store.tsx` | Assign to several children |
| `e2e/students.spec.ts` (new) | Multi-child E2E |

---

### Task 1: School-year and lock helpers (pure)

**Files:**
- Create: `src/lib/school-year.ts`, `src/lib/student-lock.ts`
- Modify: `src/lib/dates.ts` (add `localDay`)
- Test: `src/lib/school-year.test.ts`, `src/lib/student-lock.test.ts`

**Interfaces:**
- Produces:
  - `interface Enrollment { schoolYear: number; grade: number; className: string | null; startsOn: string }`
  - `schoolYearStart(year: number): string`, `schoolYearOf(day: string): number`, `schoolYearLabel(year: number): string`
  - `currentEnrollment(list: Enrollment[], today: string): Enrollment | null`
  - `yearRange(list: Enrollment[], schoolYear: number): { from: string; to: string | null } | null`
  - `yearOf(list: Enrollment[], day: string): number | null`
  - `suggestPromotion(current: Enrollment): Enrollment`
  - `interface LockFields { lockedAt: Date | string | null; lockedUntil: Date | string | null }`, `isLocked(s: LockFields, now: Date): boolean`
  - `type LockChoice = "1h" | "today" | "manual" | { at: string }`, `lockUntil(choice: LockChoice, now: Date): Date | null`
  - `localDay(d: Date): string` in `src/lib/dates.ts`

- [ ] **Step 0: Prepare the worktree** (once, before any task)

```bash
pnpm install
cp /c/Sources/homework/.env.local .env.local
pnpm exec supabase status || pnpm exec supabase start
pnpm db:migrate && pnpm test
```
Expected: all existing unit tests pass.

- [ ] **Step 1: Write the failing tests**

`src/lib/school-year.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { currentEnrollment, schoolYearLabel, schoolYearOf, schoolYearStart, suggestPromotion, yearOf, yearRange, type Enrollment } from "./school-year"

const y2025: Enrollment = { schoolYear: 2025, grade: 2, className: "2A", startsOn: "2025-09-05" }
const y2026: Enrollment = { schoolYear: 2026, grade: 3, className: "3C1", startsOn: "2026-09-05" }

describe("school year", () => {
  it("names and starts years on 5 September", () => {
    expect(schoolYearStart(2026)).toBe("2026-09-05")
    expect(schoolYearLabel(2026)).toBe("2026–2027")
    expect(schoolYearOf("2026-09-04")).toBe(2025)
    expect(schoolYearOf("2026-09-05")).toBe(2026)
    expect(schoolYearOf("2027-01-10")).toBe(2026)
  })

  it("picks the latest enrollment that has started", () => {
    expect(currentEnrollment([y2026, y2025], "2026-10-15")).toEqual(y2026)
    expect(currentEnrollment([y2025, y2026], "2026-08-01")).toEqual(y2025)
    expect(currentEnrollment([], "2026-10-15")).toBeNull()
  })

  it("falls back to the earliest when every enrollment is in the future", () => {
    expect(currentEnrollment([y2026], "2026-01-01")).toEqual(y2026)
  })

  it("gives half-open ranges between consecutive starts", () => {
    expect(yearRange([y2026, y2025], 2025)).toEqual({ from: "2025-09-05", to: "2026-09-05" })
    expect(yearRange([y2026, y2025], 2026)).toEqual({ from: "2026-09-05", to: null })
    expect(yearRange([y2026], 2024)).toBeNull()
  })

  it("places a day in its year, the next start belonging to the next year", () => {
    expect(yearOf([y2025, y2026], "2026-09-04")).toBe(2025)
    expect(yearOf([y2025, y2026], "2026-09-05")).toBe(2026)
    expect(yearOf([y2025, y2026], "2025-01-01")).toBeNull()
  })

  it("suggests the next grade and year", () => {
    expect(suggestPromotion(y2026)).toEqual({ schoolYear: 2027, grade: 4, className: null, startsOn: "2027-09-05" })
    expect(suggestPromotion({ ...y2026, grade: 12 }).grade).toBe(12)
  })
})
```

`src/lib/student-lock.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { localDay } from "./dates"
import { isLocked, lockUntil } from "./student-lock"

const now = new Date(2026, 9, 15, 18, 0)

describe("student lock", () => {
  it("is unlocked without lockedAt", () => {
    expect(isLocked({ lockedAt: null, lockedUntil: null }, now)).toBe(false)
  })
  it("stays locked until unlocked by hand when there is no end", () => {
    expect(isLocked({ lockedAt: new Date(2026, 9, 1), lockedUntil: null }, now)).toBe(true)
  })
  it("lifts by itself at lockedUntil", () => {
    expect(isLocked({ lockedAt: now, lockedUntil: new Date(2026, 9, 15, 19, 0) }, now)).toBe(true)
    expect(isLocked({ lockedAt: now, lockedUntil: new Date(2026, 9, 15, 18, 0) }, now)).toBe(false)
    expect(isLocked({ lockedAt: now.toISOString(), lockedUntil: new Date(2026, 9, 15, 17, 0).toISOString() }, now)).toBe(false)
  })
  it("turns choices into end times", () => {
    expect(lockUntil("1h", now)).toEqual(new Date(2026, 9, 15, 19, 0))
    expect(lockUntil("today", now)).toEqual(new Date(2026, 9, 16, 0, 0))
    expect(lockUntil("manual", now)).toBeNull()
    expect(lockUntil({ at: new Date(2026, 9, 15, 20, 0).toISOString() }, now)).toEqual(new Date(2026, 9, 15, 20, 0))
  })
  it("rejects a custom end in the past", () => {
    expect(() => lockUntil({ at: new Date(2026, 9, 15, 17, 0).toISOString() }, now)).toThrow("Giờ mở khoá phải sau bây giờ.")
  })
  it("formats local days", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/school-year.test.ts src/lib/student-lock.test.ts`
Expected: FAIL — cannot resolve `./school-year` / `./student-lock` / `localDay`.

- [ ] **Step 3: Implement**

Append to `src/lib/dates.ts`:
```ts
/** Local calendar day as "yyyy-mm-dd". */
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
```

`src/lib/school-year.ts`:
```ts
/*
 * School years per child. A year is named by its start year (2026 = "2026–2027")
 * and runs from its enrollment's startsOn to the next enrollment's startsOn.
 * Days are local "yyyy-mm-dd" strings, which compare correctly as text.
 */

export interface Enrollment {
  schoolYear: number
  grade: number
  className: string | null
  startsOn: string
}

const byStart = (a: Enrollment, b: Enrollment) => a.startsOn.localeCompare(b.startsOn)

export const schoolYearStart = (year: number) => `${year}-09-05`

export const schoolYearLabel = (year: number) => `${year}–${year + 1}`

/** The school year a day falls into by the default calendar (used when no enrollment exists yet). */
export function schoolYearOf(day: string): number {
  const year = Number(day.slice(0, 4))
  return day >= schoolYearStart(year) ? year : year - 1
}

export function currentEnrollment(list: Enrollment[], today: string): Enrollment | null {
  const sorted = [...list].sort(byStart)
  return sorted.filter((e) => e.startsOn <= today).at(-1) ?? sorted[0] ?? null
}

/** Half-open [from, to) range of a year; `to` is null for the latest year. */
export function yearRange(list: Enrollment[], schoolYear: number): { from: string; to: string | null } | null {
  const sorted = [...list].sort(byStart)
  const i = sorted.findIndex((e) => e.schoolYear === schoolYear)
  if (i < 0) return null
  return { from: sorted[i].startsOn, to: sorted[i + 1]?.startsOn ?? null }
}

export function yearOf(list: Enrollment[], day: string): number | null {
  let found: number | null = null
  for (const e of [...list].sort(byStart)) if (e.startsOn <= day) found = e.schoolYear
  return found
}

export function suggestPromotion(current: Enrollment): Enrollment {
  const schoolYear = current.schoolYear + 1
  return { schoolYear, grade: Math.min(12, current.grade + 1), className: null, startsOn: schoolYearStart(schoolYear) }
}
```

`src/lib/student-lock.ts`:
```ts
import { addDays, startOfDay } from "./dates"

/*
 * A locked child can't use the app on their device until lockedUntil (or until
 * the parent unlocks when it is null). Checked on read; nothing is scheduled.
 */

export interface LockFields {
  lockedAt: Date | string | null
  lockedUntil: Date | string | null
}

export function isLocked(s: LockFields, now: Date): boolean {
  if (!s.lockedAt) return false
  if (!s.lockedUntil) return true
  return new Date(s.lockedUntil).getTime() > now.getTime()
}

export type LockChoice = "1h" | "today" | "manual" | { at: string }

export function lockUntil(choice: LockChoice, now: Date): Date | null {
  if (choice === "manual") return null
  if (choice === "1h") return new Date(now.getTime() + 60 * 60_000)
  if (choice === "today") return addDays(startOfDay(now), 1)
  const at = new Date(choice.at)
  if (!Number.isFinite(at.getTime()) || at <= now) throw new Error("Giờ mở khoá phải sau bây giờ.")
  return at
}
```
(`addDays` / `startOfDay` already exist in `src/lib/dates.ts`; confirm their signatures there.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/school-year.test.ts src/lib/student-lock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/school-year.ts src/lib/school-year.test.ts src/lib/student-lock.ts src/lib/student-lock.test.ts src/lib/dates.ts
git commit -m "School-year and student-lock helpers"
```

---

### Task 2: Signed session token and student PIN hash

**Files:**
- Create: `src/lib/session-token.ts`, `src/lib/session-token.test.ts`
- Modify: `src/lib/pin.ts` (add only; removals happen in Task 4), `src/lib/pin.test.ts`

**Interfaces:**
- Produces:
  - `type SessionRole = "parent" | "student"`
  - `interface SessionPayload { v: 1; role: SessionRole; householdId: string; studentId?: string; iat: number }` (`iat` in seconds)
  - `SESSION_MAX_AGE: Record<SessionRole, number>` (seconds)
  - `signToken(p: SessionPayload, secret: string): Promise<string>`
  - `verifyToken(value: string | undefined, secret: string, nowMs?: number): Promise<SessionPayload | null>`
  - `sessionSecret(env?: Record<string, string | undefined>): string`
  - in `pin.ts`: `MODE_HEADER = "x-hh-mode"`, `VIEWING_COOKIE = "hh_student"`, `parentPin(env?): string | undefined`, `studentPinHash(studentId: string, pin: string): Promise<string>`, `isValidPin(pin: string): boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/session-token.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { SESSION_MAX_AGE, sessionSecret, signToken, verifyToken, type SessionPayload } from "./session-token"

const secret = "test-secret"
const nowMs = Date.UTC(2026, 9, 15)
const student: SessionPayload = { v: 1, role: "student", householdId: "h1", studentId: "s1", iat: nowMs / 1000 }

describe("session token", () => {
  it("round-trips a payload", async () => {
    const token = await signToken(student, secret)
    expect(await verifyToken(token, secret, nowMs)).toEqual(student)
  })

  it("rejects a wrong secret, a tampered body and garbage", async () => {
    const token = await signToken(student, secret)
    expect(await verifyToken(token, "other", nowMs)).toBeNull()
    const [, sig] = token.split(".")
    const forged = `${Buffer.from(JSON.stringify({ ...student, studentId: "s2" })).toString("base64url")}.${sig}`
    expect(await verifyToken(forged, secret, nowMs)).toBeNull()
    expect(await verifyToken("abc", secret, nowMs)).toBeNull()
    expect(await verifyToken(undefined, secret, nowMs)).toBeNull()
    // The old cookie format (a bare hash) must fail cleanly.
    expect(await verifyToken("Zm9vYmFy", secret, nowMs)).toBeNull()
  })

  it("expires per role", async () => {
    const token = await signToken(student, secret)
    expect(await verifyToken(token, secret, nowMs + (SESSION_MAX_AGE.student + 1) * 1000)).toBeNull()
    const parent = await signToken({ v: 1, role: "parent", householdId: "h1", iat: nowMs / 1000 }, secret)
    expect(await verifyToken(parent, secret, nowMs + (SESSION_MAX_AGE.parent + 1) * 1000)).toBeNull()
  })

  it("requires a child in student tokens", async () => {
    const token = await signToken({ v: 1, role: "student", householdId: "h1", iat: nowMs / 1000 }, secret)
    expect(await verifyToken(token, secret, nowMs)).toBeNull()
  })

  it("needs SESSION_SECRET in production only", () => {
    expect(sessionSecret({ SESSION_SECRET: "x" })).toBe("x")
    expect(sessionSecret({ NODE_ENV: "development" })).toBe("homework-hub-dev-secret")
    expect(() => sessionSecret({ NODE_ENV: "production" })).toThrow("SESSION_SECRET")
  })
})
```

Append to `src/lib/pin.test.ts` (merge the import into the existing import line):
```ts
import { isValidPin, parentPin, studentPinHash } from "./pin"

describe("student pins", () => {
  it("hashes per child", async () => {
    const a = await studentPinHash("s1", "1234")
    expect(a).toBe(await studentPinHash("s1", "1234"))
    expect(a).not.toBe(await studentPinHash("s2", "1234"))
  })
  it("accepts 4–6 digits", () => {
    expect(isValidPin("1234")).toBe(true)
    expect(isValidPin("123456")).toBe(true)
    expect(isValidPin("123")).toBe(false)
    expect(isValidPin("12a4")).toBe(false)
  })
  it("reads the parent PIN with the APP_PIN fallback", () => {
    expect(parentPin({ PARENT_PIN: "1", APP_PIN: "2" })).toBe("1")
    expect(parentPin({ APP_PIN: "2" })).toBe("2")
    expect(parentPin({})).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/session-token.test.ts src/lib/pin.test.ts`
Expected: FAIL — module / exports not found.

- [ ] **Step 3: Implement**

`src/lib/session-token.ts`:
```ts
/*
 * The hh_pin cookie: base64url(JSON payload).base64url(HMAC-SHA256). Web Crypto
 * only, so the proxy can verify it without the database. Names the mode, the
 * household and (student mode) the child.
 */

export type SessionRole = "parent" | "student"

export interface SessionPayload {
  v: 1
  role: SessionRole
  householdId: string
  studentId?: string
  /** Issued at, seconds since epoch. */
  iat: number
}

export const SESSION_MAX_AGE: Record<SessionRole, number> = { parent: 30 * 86_400, student: 180 * 86_400 }

const enc = new TextEncoder()

const toB64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

function fromB64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signToken(payload: SessionPayload, secret: string): Promise<string> {
  const body = toB64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${await hmac(secret, body)}`
}

function isPayload(p: unknown): p is SessionPayload {
  if (!p || typeof p !== "object") return false
  const o = p as Record<string, unknown>
  if (o.v !== 1 || (o.role !== "parent" && o.role !== "student")) return false
  if (typeof o.householdId !== "string" || typeof o.iat !== "number") return false
  if (o.role === "student" && typeof o.studentId !== "string") return false
  return true
}

export async function verifyToken(value: string | undefined, secret: string, nowMs = Date.now()): Promise<SessionPayload | null> {
  if (!value) return null
  const parts = value.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  if (!safeEqual(await hmac(secret, parts[0]), parts[1])) return null
  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])))
  } catch {
    return null
  }
  if (!isPayload(payload)) return null
  const age = nowMs / 1000 - payload.iat
  if (age > SESSION_MAX_AGE[payload.role] || age < -300) return null
  return payload
}

export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET
  if (env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set")
  return "homework-hub-dev-secret"
}
```

Add to `src/lib/pin.ts` (keep everything that is there for now):
```ts
/** Request header the proxy sets to the mode of the path ("parent" | "student"). */
export const MODE_HEADER = "x-hh-mode"

/** Parent devices: the child whose data parent pages show. */
export const VIEWING_COOKIE = "hh_student"

export function parentPin(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.PARENT_PIN || env.APP_PIN || undefined
}

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin)

export async function studentPinHash(studentId: string, pin: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`homework-hub:student:${studentId}:${pin}`)))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/session-token.test.ts src/lib/pin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-token.ts src/lib/session-token.test.ts src/lib/pin.ts src/lib/pin.test.ts
git commit -m "Signed session token and per-child PIN hash"
```

---

### Task 3: Schema, migration, seed and per-child reward facts

The app keeps working as a single-child app at the end of this task (the oldest child is "the" student); scoping comes in Tasks 4–5.

**Files:**
- Modify: `src/db/schema.ts`, `src/db/reward-facts.ts`, `src/db/seed.ts`, `src/lib/types.ts`, `src/server/queries.ts` (`getStudent`), `src/server/rewards.ts`, `src/server/actions/library.ts` (set inserts), `src/server/actions/rewards.ts` (inserts)
- Create: `drizzle/0005_<generated>.sql` (generated, then hand-edited)

**Interfaces:**
- Consumes: `currentEnrollment`, `schoolYearOf`, `schoolYearStart`, `localDay` (Task 1).
- Produces:
  - tables `households`, `enrollments`; columns `students.householdId|pinHash|lockedAt|lockedUntil|lockReason|archivedAt`, `exerciseSets.householdId`, `rewards.householdId`, `rewardRedemptions.studentId`, `starAdjustments.studentId`, `badgeSeen.studentId`
  - `loadRewardFacts(db, { studentId: string; serial?: boolean })`
  - `Student` (lib/types) gains `householdId: string` and `schoolYear: number`
  - temporary `firstStudentRow()` in `src/server/rewards.ts` (deleted in Task 4)

- [ ] **Step 1: Edit the schema**

In `src/db/schema.ts` add `date` and `primaryKey` to the `drizzle-orm/pg-core` import, then declare before `students`:

```ts
/** A family (one parent account later). Everything the parent owns hangs off it. */
export const households = pgTable("households", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: createdAt(),
}).enableRLS()
```

Replace `students`:
```ts
export const students = pgTable(
  "students",
  {
    id: uuid().primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text().notNull(),
    avatarEmoji: text("avatar_emoji").notNull().default("🦊"),
    /** SHA-256 of the child's PIN (lib/pin.ts studentPinHash); null = no PIN. */
    pinHash: text("pin_hash"),
    /** Locked on the child's device while set, until lockedUntil (null = until unlocked). */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lockReason: text("lock_reason"),
    /** Left (no longer tutored): hidden from pickers; data kept. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("students_household_idx").on(t.householdId)],
).enableRLS()

/** One row per child per school year (lib/school-year.ts). */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid().primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Start year: 2026 = "2026–2027". */
    schoolYear: smallint("school_year").notNull(),
    grade: smallint().notNull(),
    className: text("class_name"),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("enrollments_student_year_idx").on(t.studentId, t.schoolYear),
    check("enrollment_grade_range", sql`${t.grade} between 1 and 12`),
  ],
).enableRLS()
```

`exerciseSets` and `rewards`: add right after `id`:
```ts
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
```
and in `exerciseSets` replace `index("exercise_sets_subject_grade_idx").on(t.subject, t.grade)` with `index("exercise_sets_household_subject_grade_idx").on(t.householdId, t.subject, t.grade)`.

`rewardRedemptions`, `starAdjustments`: add right after `id`:
```ts
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
```
and change the redemption index to:
```ts
  (t) => [uniqueIndex("reward_redemptions_one_pending_idx").on(t.studentId, t.rewardId).where(sql`${t.status} = 'pending'`)],
```

`badgeSeen`:
```ts
/** Badges and streak milestones (`streak-7@2026-10-20`) each child has celebrated. */
export const badgeSeen = pgTable(
  "badge_seen",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    badgeId: text("badge_id").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.badgeId] })],
).enableRLS()
```

- [ ] **Step 2: Generate the migration and replace its body with a backfilling one**

Run: `pnpm db:generate` → creates `drizzle/0005_<name>.sql` plus `drizzle/meta/0005_snapshot.json`. Keep the file name, journal entry and snapshot; replace the SQL body with:

```sql
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "households" ("name") VALUES ('Gia đình');--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year" smallint NOT NULL,
	"grade" smallint NOT NULL,
	"class_name" text,
	"starts_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_grade_range" CHECK ("enrollments"."grade" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_year_idx" ON "enrollments" USING btree ("student_id","school_year");--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "lock_reason" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
UPDATE "students" SET "household_id" = (SELECT "id" FROM "households" LIMIT 1);--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_household_idx" ON "students" USING btree ("household_id");--> statement-breakpoint
INSERT INTO "enrollments" ("student_id", "school_year", "grade", "class_name", "starts_on")
SELECT s."id", y.year, s."grade", s."class_name", make_date(y.year, 9, 5)
FROM "students" s,
LATERAL (
	SELECT CASE
		WHEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= make_date(extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int, 9, 5)
		THEN extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int
		ELSE extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int - 1
	END AS year
) y;--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "grade";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "class_name";--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD COLUMN "household_id" uuid;--> statement-breakpoint
UPDATE "exercise_sets" SET "household_id" = (SELECT "id" FROM "households" LIMIT 1);--> statement-breakpoint
ALTER TABLE "exercise_sets" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "exercise_sets_subject_grade_idx";--> statement-breakpoint
CREATE INDEX "exercise_sets_household_subject_grade_idx" ON "exercise_sets" USING btree ("household_id","subject","grade");--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "household_id" uuid;--> statement-breakpoint
UPDATE "rewards" SET "household_id" = (SELECT "id" FROM "households" LIMIT 1);--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD COLUMN "student_id" uuid;--> statement-breakpoint
UPDATE "reward_redemptions" SET "student_id" = (SELECT "id" FROM "students" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "reward_redemptions" WHERE "student_id" IS NULL;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "reward_redemptions_one_pending_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "reward_redemptions_one_pending_idx" ON "reward_redemptions" USING btree ("student_id","reward_id") WHERE "reward_redemptions"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "star_adjustments" ADD COLUMN "student_id" uuid;--> statement-breakpoint
UPDATE "star_adjustments" SET "student_id" = (SELECT "id" FROM "students" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "star_adjustments" WHERE "student_id" IS NULL;--> statement-breakpoint
ALTER TABLE "star_adjustments" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "star_adjustments" ADD CONSTRAINT "star_adjustments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_seen" ADD COLUMN "student_id" uuid;--> statement-breakpoint
UPDATE "badge_seen" SET "student_id" = (SELECT "id" FROM "students" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "badge_seen" WHERE "student_id" IS NULL;--> statement-breakpoint
ALTER TABLE "badge_seen" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "badge_seen" ADD CONSTRAINT "badge_seen_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_seen" DROP CONSTRAINT "badge_seen_pkey";--> statement-breakpoint
ALTER TABLE "badge_seen" ADD CONSTRAINT "badge_seen_student_id_badge_id_pk" PRIMARY KEY("student_id","badge_id");
```
Compare every constraint/index name with the generated SQL and use the generated names wherever they differ. Check the old primary key name with `psql "$DATABASE_URL" -c '\d badge_seen'` if `badge_seen_pkey` is wrong.

- [ ] **Step 3: Apply the migration to the existing local data and verify**

The local DB still holds the previous demo data, which exercises the backfill.
```bash
pnpm db:migrate
psql "$DATABASE_URL" -c "select count(*) from households" -c "select student_id, school_year, grade from enrollments" -c "select count(*) from badge_seen where student_id is null"
pnpm db:generate
```
Expected: 1 household, one enrollment per student, 0 null rows, and `db:generate` reports no schema changes. If it writes a new migration, align names in 0005 and delete the extra file and its journal entry.

- [ ] **Step 4: Per-child reward facts**

Replace `loadRewardFacts` in `src/db/reward-facts.ts` (add `and` to the drizzle import):
```ts
/** `serial`: inside a transaction (one connection), run the queries one after another. */
export async function loadRewardFacts(
  db: AnyDb,
  { studentId, serial = false }: { studentId: string; serial?: boolean },
): Promise<{ facts: RewardFacts; seen: Set<string> }> {
  const [assignmentRows, attemptRows, inkRows, adjustments, redemptions, seenRows] = await runAll([
    () => db
      .select({ id: assignments.id, availableFrom: assignments.availableFrom, dueAt: assignments.dueAt, title: exerciseSets.title, subject: exerciseSets.subject })
      .from(assignments)
      .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId))
      .where(eq(assignments.studentId, studentId)),
    () => db
      .select({ id: attempts.id, assignmentId: attempts.assignmentId, attemptNo: attempts.attemptNo, submittedAt: attempts.submittedAt, gradedAt: attempts.gradedAt, score: attempts.score })
      .from(attempts)
      .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .where(eq(assignments.studentId, studentId))
      .orderBy(asc(attempts.attemptNo)),
    () => db
      .selectDistinct({ attemptId: answers.attemptId })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .where(and(eq(assignments.studentId, studentId), sql`${answers.response} -> 'ink' is not null`)),
    () => db.select().from(starAdjustments).where(eq(starAdjustments.studentId, studentId)),
    () => db.select().from(rewardRedemptions).where(eq(rewardRedemptions.studentId, studentId)),
    () => db.select({ id: badgeSeen.badgeId }).from(badgeSeen).where(eq(badgeSeen.studentId, studentId)),
  ], serial)
```
The rest of the function stays as is.

- [ ] **Step 5: Keep the app compiling as a single-child app**

`src/lib/types.ts` → `Student`:
```ts
export interface Student {
  id: string
  householdId: string
  name: string
  grade: number
  /** Class label such as "3C1", when set. */
  className?: string
  /** Start year of the current school year (2026 = "2026–2027"). */
  schoolYear: number
  avatarEmoji: string
  totalStars: number
}
```

`src/server/rewards.ts`:
```ts
/** Temporary until Task 4: the oldest child. */
export async function firstStudentRow() {
  const row = await db.query.students.findFirst({ orderBy: asc(schema.students.createdAt) })
  if (!row) throw new Error("No student found. Run `pnpm db:seed`.")
  return row
}

/** Stars, streak, badges and celebrations, computed once per request. */
export const loadRewards = cache(async () => {
  await settleExpiredAttempts()
  const now = new Date()
  const { id: studentId } = await firstStudentRow()
  const { facts, seen } = await loadRewardFacts(db, { studentId })
  return { now, facts, state: computeRewards(facts, seen, now) }
})
```

`src/server/queries.ts` → `getStudent` (import `currentEnrollment`, `schoolYearOf` from `@/lib/school-year`, `localDay` from `@/lib/dates`, `firstStudentRow` from `./rewards`):
```ts
export async function getStudent(): Promise<Student> {
  const row = await firstStudentRow()
  const years = await db.select().from(schema.enrollments).where(eq(schema.enrollments.studentId, row.id))
  const today = localDay(new Date())
  const current = currentEnrollment(years, today)
  const totalStars = (await loadRewards()).state.ledger.balance
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    grade: current?.grade ?? 1,
    className: current?.className ?? undefined,
    schoolYear: current?.schoolYear ?? schoolYearOf(today),
    avatarEmoji: row.avatarEmoji,
    totalStars,
  }
}
```

`src/server/actions/library.ts`:
- `createExerciseSet`: `.values({ householdId: student.householdId, title: "Bộ bài tập mới", … })`.
- `saveExerciseSet`: before the transaction `const { householdId } = await getStudent()`; insert `.values({ id, householdId, ...meta })`; the `onConflictDoUpdate` `set` stays `{ ...meta, updatedAt: new Date() }`.
- `duplicateExerciseSet` already spreads `householdId` from the original row.

`src/server/actions/rewards.ts` (import `firstStudentRow` from `../rewards`):
- `saveReward` insert: `.values({ ...data, householdId: (await firstStudentRow()).householdId, position: next })`.
- `requestRedemption`: `const { id: studentId } = await firstStudentRow()` before the transaction; `loadRewardFacts(tx, { studentId, serial: true })`; insert adds `studentId`.
- `adjustStars`: `.values({ ...adjustSchema.parse({ amount, reason }), studentId: (await firstStudentRow()).id })`.
- `markBadgesSeen`: `const { id: studentId } = await firstStudentRow()`; `.values(list.map((badgeId) => ({ studentId, badgeId }))).onConflictDoNothing()`.

Fix any unit-test fixture that builds a `Student` (`rg "totalStars" src --glob "*.test.ts"`): add `householdId: "h1", schoolYear: 2026`.

- [ ] **Step 6: Seed a household, two children and last year**

In `src/db/seed.ts`:
- import `{ schoolYearOf, schoolYearStart }` from `@/lib/school-year` and `localDay` from `@/lib/dates`.
- truncate list: add `enrollments, households`.
- replace the student insert:
```ts
  const [household] = await db.insert(schema.households).values({ name: "Gia đình Minh An" }).returning()
  const thisYear = schoolYearOf(localDay(today))
  const [student, sibling] = await db
    .insert(schema.students)
    .values([
      { householdId: household.id, name: "Minh An", avatarEmoji: "🦊", createdAt: at(-400, 8) },
      { householdId: household.id, name: "Bảo Ngọc", avatarEmoji: "🐼", createdAt: at(-399, 8) },
    ])
    .returning()
  await db.insert(schema.enrollments).values([
    { studentId: student.id, schoolYear: thisYear - 1, grade: 2, className: "2A1", startsOn: schoolYearStart(thisYear - 1) },
    { studentId: student.id, schoolYear: thisYear, grade: 3, className: "3C1", startsOn: schoolYearStart(thisYear) },
    { studentId: sibling.id, schoolYear: thisYear, grade: 5, className: "5A2", startsOn: schoolYearStart(thisYear) },
  ])
```
- set inserts get `householdId: household.id`.
- add plans:
```ts
/** Days from today back to a "yyyy-mm-dd" day. */
const daysAgo = (day: string) => Math.round((today.getTime() - new Date(`${day}T00:00:00`).getTime()) / 86_400_000)

/** Minh An's last school year: a few graded sets about two months before this year started. */
function lastYear(thisYearStart: string): AssignmentPlan[] {
  const base = -(daysAgo(thisYearStart) + 70)
  return ["bt-01", "bt-07", "bt-13"].map((set, i) => {
    const d = base + i * 3
    return { set, availableDay: d, dueDay: d, dueHour: 20, maxAttempts: 1, attempts: [{ skill: 0.75, dayOffset: d, hour: 19 }] } satisfies AssignmentPlan
  })
}

/** Bảo Ngọc: one graded set and one upcoming. "Unit 5: My family" (bt-15) and "Chính tả: Mùa thu của em" (bt-11) stay Minh An's only (E2E relies on it). */
const SIBLING: AssignmentPlan[] = [
  { set: "bt-03", availableDay: -2, dueDay: -2, dueHour: 20, attempts: [{ skill: 0.8, dayOffset: -2, hour: 19 }] },
  { set: "bt-14", availableDay: 0, dueDay: 1, dueHour: 20 },
]
```
- move the assignment loop into `async function insertPlans(studentId: string, sets: Map<string, Loaded>, plans: AssignmentPlan[])` (body unchanged except `studentId`), called with `(student.id, sets, [...lastYear(schoolYearStart(thisYear)), ...history(), ...CURRENT])` and `(sibling.id, sets, SIBLING)`.
- `seedRewards(householdId: string, children: string[])`: rewards insert adds `householdId`; redemptions and the star adjustment add `studentId: children[0]`; then
```ts
  for (const studentId of children) {
    const { facts, seen } = await loadRewardFacts(db, { studentId })
    const state = computeRewards(facts, seen, now)
    const ids = state.celebrations.map((c) => c.id)
    if (ids.length) await db.insert(schema.badgeSeen).values(ids.map((badgeId) => ({ studentId, badgeId })))
    console.log(`Rewards (${studentId === children[0] ? "Minh An" : "Bảo Ngọc"}): ${state.ledger.balance} stars, streak ${state.streak.current}`)
  }
```
- header comment: "Resets the database to a realistic demo: one household with two children — Minh An (grade 3, with last year's grade-2 history) and Bảo Ngọc (grade 5) — the seed library, …".

- [ ] **Step 7: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm db:seed
pnpm test:e2e
```
Expected: all green; the app behaves exactly as before for Minh An.

- [ ] **Step 8: Commit**

```bash
git add src/db drizzle src/lib/types.ts src/server
git commit -m "Households, enrollments and per-child reward tables"
```

---

### Task 4: Access layer — token, context, proxy, PIN page

**Files:**
- Modify: `src/lib/pin.ts`, `src/lib/pin.test.ts`, `src/proxy.ts`, `src/server/access.ts`, `src/server/actions/pin.ts`, `src/app/pin/page.tsx`, `src/app/pin/PinForm.tsx`, `src/app/page.tsx`, `src/server/rewards.ts`, `src/server/queries.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/student/page.tsx`, `src/components/layout/AppFrame.tsx`, `src/server/actions/{library,rewards,ai-summary}.ts`, `src/lib/types.ts`, `e2e/helpers.ts`, `.env.example`
- Create: `src/server/students.ts`, `src/app/pin/StudentPicker.tsx`

**Interfaces:**
- Consumes: `signToken`, `verifyToken`, `sessionSecret`, `SESSION_MAX_AGE`, `MODE_HEADER`, `VIEWING_COOKIE`, `parentPin`, `studentPinHash` (Task 2); `currentEnrollment`, `schoolYearOf`, `isLocked`, `localDay` (Task 1).
- Produces:
  - `interface Context { householdId: string; mode: PinRole; studentId: string | null; locked: boolean }` (`studentId` null only in parent mode when the household has no active child)
  - `getContext(): Promise<Context>`, `assertAccess(role: PinRole): Promise<Context>`, `hasAccess(role): Promise<boolean>`, `currentRole(): Promise<PinRole | null>`
  - `src/server/students.ts`: `type StudentRow`; `defaultHouseholdId(): Promise<string>`; `listHouseholdStudents(householdId): Promise<StudentRow[]>` (active, oldest first, request-cached); `listEnrollments(studentId): Promise<Enrollment[]>`; `toStudent(row: StudentRow, totalStars: number): Promise<Student>`; `listPinStudents(): Promise<PinStudent[]>`
  - `interface PinStudent { id: string; name: string; avatarEmoji: string; hasPin: boolean }` in `src/lib/types.ts`
  - `getViewingStudent(): Promise<Student | null>` in `queries.ts` (replaces `getStudent`)
  - actions `verifyParentPin(prev: PinState, formData)` and `pickStudent(prev: PinState, formData)` (fields `studentId`, `pin`, `next`)

- [ ] **Step 1: Trim `lib/pin.ts`**

Remove `Pins`, `pinsFromEnv`, `pinToken`, `grants`; keep `PIN_COOKIE`, `PinRole`, `roleForPath` and the Task 2 additions. New file comment:
```ts
/*
 * PIN gate (not authentication). The hh_pin cookie holds a signed token
 * (lib/session-token.ts) naming the mode, household and — in student mode —
 * the child. The parent PIN comes from env (PARENT_PIN, falling back to
 * APP_PIN); each child has their own PIN in students.pin_hash.
 */
```
Delete the tests of the removed functions from `pin.test.ts` (keep `roleForPath` and the Task 2 tests).

- [ ] **Step 2: Students read side**

Add to `src/lib/types.ts`:
```ts
/** A child on the student PIN page. */
export interface PinStudent {
  id: string
  name: string
  avatarEmoji: string
  hasPin: boolean
}
```

`src/server/students.ts`:
```ts
import "server-only"
import { and, asc, eq, isNull } from "drizzle-orm"
import { cache } from "react"
import { db, schema } from "@/db"
import { localDay } from "@/lib/dates"
import { currentEnrollment, schoolYearOf, type Enrollment } from "@/lib/school-year"
import type { PinStudent, Student } from "@/lib/types"

/*
 * Read side for children and their school years. Callers pass the household
 * from the request context (server/access.ts).
 */

const { households, students, enrollments } = schema

export type StudentRow = typeof students.$inferSelect

/** Until accounts exist there is one household: the oldest. */
export const defaultHouseholdId = cache(async (): Promise<string> => {
  const row = await db.query.households.findFirst({ orderBy: asc(households.createdAt) })
  if (!row) throw new Error("No household found. Run `pnpm db:seed`.")
  return row.id
})

/** Active (not archived) children, oldest first. */
export const listHouseholdStudents = cache(async (householdId: string): Promise<StudentRow[]> =>
  db.select().from(students).where(and(eq(students.householdId, householdId), isNull(students.archivedAt))).orderBy(asc(students.createdAt)),
)

export const listEnrollments = cache(async (studentId: string): Promise<Enrollment[]> =>
  db
    .select({ schoolYear: enrollments.schoolYear, grade: enrollments.grade, className: enrollments.className, startsOn: enrollments.startsOn })
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId))
    .orderBy(asc(enrollments.startsOn)),
)

export async function toStudent(row: StudentRow, totalStars: number): Promise<Student> {
  const today = localDay(new Date())
  const current = currentEnrollment(await listEnrollments(row.id), today)
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    grade: current?.grade ?? 1,
    className: current?.className ?? undefined,
    schoolYear: current?.schoolYear ?? schoolYearOf(today),
    avatarEmoji: row.avatarEmoji,
    totalStars,
  }
}

/** Children shown on the student PIN page. */
export async function listPinStudents(): Promise<PinStudent[]> {
  const rows = await listHouseholdStudents(await defaultHouseholdId())
  return rows.map((r) => ({ id: r.id, name: r.name, avatarEmoji: r.avatarEmoji, hasPin: Boolean(r.pinHash) }))
}
```

- [ ] **Step 3: Context and access**

Replace `src/server/access.ts`:
```ts
import "server-only"
import { and, eq } from "drizzle-orm"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { db, schema } from "@/db"
import { MODE_HEADER, PIN_COOKIE, VIEWING_COOKIE, parentPin, type PinRole } from "@/lib/pin"
import { sessionSecret, verifyToken } from "@/lib/session-token"
import { isLocked } from "@/lib/student-lock"
import { defaultHouseholdId, listHouseholdStudents } from "./students"

/*
 * Who is asking. Pages are guarded by proxy.ts; Server Actions are reachable
 * by direct POST, so each one calls assertAccess() with the mode it belongs
 * to and scopes its reads and writes by the returned context. Queries use
 * getContext(), whose mode comes from the x-hh-mode header the proxy sets.
 */

export interface Context {
  householdId: string
  mode: PinRole
  /** Student mode: the device's child. Parent mode: the viewing child; null when the household has none. */
  studentId: string | null
  /** Student mode only: the child is locked (see lib/student-lock.ts). */
  locked: boolean
}

const readSession = cache(async () => verifyToken((await cookies()).get(PIN_COOKIE)?.value, sessionSecret()))

export async function hasAccess(role: PinRole): Promise<boolean> {
  const session = await readSession()
  if (role === "student") return session?.role === "student"
  return session?.role === "parent" || !parentPin()
}

/** The mode the cookie opens; parent when there is no cookie and no parent PIN is set. */
export async function currentRole(): Promise<PinRole | null> {
  const session = await readSession()
  if (session) return session.role
  return parentPin() ? null : "parent"
}

const contextFor = cache(async (role: PinRole): Promise<Context> => {
  const session = await readSession()
  if (role === "student") {
    if (session?.role !== "student" || !session.studentId) redirect("/pin?role=student")
    const row = await db.query.students.findFirst({
      where: and(eq(schema.students.id, session.studentId), eq(schema.students.householdId, session.householdId)),
    })
    // Archived or deleted child, or a token from another household: pick again.
    if (!row || row.archivedAt) redirect("/pin?role=student")
    return { householdId: row.householdId, mode: "student", studentId: row.id, locked: isLocked(row, new Date()) }
  }
  const householdId = session?.role === "parent" ? session.householdId : await defaultHouseholdId()
  const children = await listHouseholdStudents(householdId)
  const wanted = (await cookies()).get(VIEWING_COOKIE)?.value
  const viewing = children.find((c) => c.id === wanted) ?? children[0] ?? null
  return { householdId, mode: "parent", studentId: viewing?.id ?? null, locked: false }
})

export async function getContext(): Promise<Context> {
  const mode = (await headers()).get(MODE_HEADER) === "student" ? "student" : "parent"
  return contextFor(mode)
}

export async function assertAccess(role: PinRole): Promise<Context> {
  if (!(await hasAccess(role))) throw new Error(role === "parent" ? "Cần mã PIN phụ huynh để tiếp tục." : "Cần mã PIN để tiếp tục.")
  const ctx = await contextFor(role)
  if (ctx.locked) throw new Error("Tài khoản đang tạm khoá.")
  return ctx
}
```

- [ ] **Step 4: Replace `getStudent` and the temporary helper**

`src/server/queries.ts`: delete `getStudent`, import `getContext` from `./access` and `toStudent` from `./students`, add:
```ts
/** The child this request is about (device child or the parent's viewing child); null when the household has none. */
export async function getViewingStudent(): Promise<Student | null> {
  const { studentId } = await getContext()
  if (!studentId) return null
  const row = await db.query.students.findFirst({ where: eq(students.id, studentId) })
  if (!row) return null
  return toStudent(row, (await loadRewards()).state.ledger.balance)
}
```
`src/server/rewards.ts`: delete `firstStudentRow`; import `getContext` from `./access`:
```ts
export const loadRewards = cache(async () => {
  await settleExpiredAttempts()
  const now = new Date()
  const { studentId } = await getContext()
  const { facts, seen } = studentId
    ? await loadRewardFacts(db, { studentId })
    : { facts: { assignments: [], adjustments: [], redemptions: [] }, seen: new Set<string>() }
  return { now, facts, state: computeRewards(facts, seen, now) }
})
```
Replace every remaining call site of `getStudent()` / `firstStudentRow()` (`rg "getStudent\(|firstStudentRow" src`):
- `src/app/(app)/student/page.tsx`: `getViewingStudent()`; then `if (!student) redirect("/pin?role=student")`.
- `src/server/actions/ai-summary.ts`: `const student = await getViewingStudent(); if (!student) throw new Error("Chưa có học sinh nào.")` (inside the existing `Promise.all`, check after it resolves).
- `src/server/actions/library.ts`: `createExerciseSet` and `saveExerciseSet` use `const ctx = await assertAccess("parent")` and `ctx.householdId`; the default grade for a new set is `(await getViewingStudent())?.grade ?? 1`. `insertAssignments` uses `const ctx = await getContext()` → `studentId: ctx.studentId` (throw `"Chưa có học sinh nào."` when null).
- `src/server/actions/rewards.ts`: `const ctx = await assertAccess(...)`; `saveReward` uses `ctx.householdId`; `requestRedemption`, `markBadgesSeen` use `ctx.studentId!` (student mode always has one); `adjustStars`: `if (!ctx.studentId) throw new Error("Chưa có học sinh nào.")`.

- [ ] **Step 5: Proxy**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (sections "Runtime" and setting request headers) first. Replace `src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server"
import { MODE_HEADER, PIN_COOKIE, parentPin, roleForPath } from "@/lib/pin"
import { sessionSecret, verifyToken } from "@/lib/session-token"

/**
 * Sends visitors to /pin until their signed cookie opens the mode of the path:
 * /student/* needs a student token (it names the child), /parent/* a parent
 * token unless no parent PIN is set. Stamps the mode on the request for the
 * shared layout (see server/access.ts). No database access here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(MODE_HEADER)
  if (pathname === "/pin") return NextResponse.next({ request: { headers: requestHeaders } })

  const session = await verifyToken(request.cookies.get(PIN_COOKIE)?.value, sessionSecret())
  const parentOpen = !parentPin()
  const role = roleForPath(pathname)
  const allowed =
    role === "student" ? session?.role === "student" : role === "parent" ? session?.role === "parent" || parentOpen : Boolean(session) || parentOpen
  if (allowed) {
    if (role) requestHeaders.set(MODE_HEADER, role)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const url = request.nextUrl.clone()
  url.pathname = "/pin"
  url.search = ""
  url.searchParams.set("next", pathname)
  url.searchParams.set("role", role ?? "student")
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sounds/).*)"],
}
```

`src/app/page.tsx`:
```ts
import { redirect } from "next/navigation"
import { currentRole } from "@/server/access"

/** Opens the mode the cookie unlocked; devices without one start at the child picker. */
export default async function Home() {
  const role = await currentRole()
  redirect(role === "student" ? "/student" : role === "parent" ? "/parent" : "/pin?role=student")
}
```

- [ ] **Step 6: PIN actions and page**

`src/server/actions/pin.ts`:
```ts
"use server"

import { and, eq, isNull } from "drizzle-orm"
import { cookies } from "next/headers"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { db, schema } from "@/db"
import { PIN_COOKIE, parentPin, studentPinHash, type PinRole } from "@/lib/pin"
import { SESSION_MAX_AGE, sessionSecret, signToken } from "@/lib/session-token"
import { defaultHouseholdId } from "../students"

export interface PinState {
  error?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Only paths of the mode just opened, never an external URL. */
function target(next: FormDataEntryValue | null, role: PinRole): Route {
  const value = String(next ?? "")
  return ((value === `/${role}` || value.startsWith(`/${role}/`)) ? value : `/${role}`) as Route
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function setSession(role: PinRole, householdId: string, studentId?: string) {
  const token = await signToken({ v: 1, role, householdId, studentId, iat: Math.floor(Date.now() / 1000) }, sessionSecret())
  ;(await cookies()).set(PIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE[role],
  })
}

export async function verifyParentPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const pin = parentPin()
  const entered = String(formData.get("pin") ?? "").trim()
  if (pin && !safeEqual(entered, pin)) {
    await sleep(800) // slow down guessing
    return { error: "Mã PIN chưa đúng. Thử lại nhé!" }
  }
  await setSession("parent", await defaultHouseholdId())
  redirect(target(formData.get("next"), "parent"))
}

export async function pickStudent(_prev: PinState, formData: FormData): Promise<PinState> {
  const studentId = String(formData.get("studentId") ?? "")
  const householdId = await defaultHouseholdId()
  const row = /^[0-9a-f-]{36}$/i.test(studentId)
    ? await db.query.students.findFirst({
        where: and(eq(schema.students.id, studentId), eq(schema.students.householdId, householdId), isNull(schema.students.archivedAt)),
      })
    : undefined
  if (!row) return { error: "Không tìm thấy học sinh." }
  if (row.pinHash) {
    const entered = String(formData.get("pin") ?? "").trim()
    if (!safeEqual(await studentPinHash(row.id, entered), row.pinHash)) {
      await sleep(800)
      return { error: "Mã PIN chưa đúng. Thử lại nhé!" }
    }
  }
  await setSession("student", householdId, row.id)
  redirect(target(formData.get("next"), "student"))
}
```

`src/app/pin/page.tsx`:
```tsx
import PinForm from "./PinForm"
import StudentPicker from "./StudentPicker"
import { listPinStudents } from "@/server/students"

export const metadata = { title: "Nhập mã PIN · Homework Hub" }

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const { next, role } = await searchParams
  return (
    <main className="grid min-h-dvh place-items-center bg-indigo-50/60 p-4">
      {role === "parent" ? <PinForm next={next ?? "/parent"} /> : <StudentPicker next={next ?? "/student"} students={await listPinStudents()} />}
    </main>
  )
}
```

`src/app/pin/PinForm.tsx`: parent only. Remove the `role` prop, the `COPY` map, the hidden `role` input and the bottom "Sang chế độ…/Quay lại…" link (children must not find a way across). Title "Chế độ Phụ huynh", hint "Nhập mã PIN phụ huynh để tiếp tục.", icon `Users`, action `verifyParentPin`, button "Tiếp tục". Keep the existing input/button markup and classes.

`src/app/pin/StudentPicker.tsx`:
```tsx
"use client"

import { useActionState, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PinStudent } from "@/lib/types"
import { pickStudent, type PinState } from "@/server/actions/pin"

const avatarClass = "grid size-16 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-3xl"

export default function StudentPicker({ next, students }: { next: string; students: PinStudent[] }) {
  const [state, action, pending] = useActionState<PinState, FormData>(pickStudent, {})
  const [chosen, setChosen] = useState<PinStudent | null>(null)

  if (!students.length) {
    return (
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg shadow-indigo-600/10">
        <div className="text-5xl" aria-hidden>🏫</div>
        <p className="mt-4 text-lg font-semibold text-slate-800">Nhờ bố mẹ thêm học sinh trước nhé.</p>
      </div>
    )
  }

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-white p-8 shadow-lg shadow-indigo-600/10">
      <input type="hidden" name="next" value={next} />
      {!chosen ? (
        <>
          <h1 className="text-center text-2xl font-bold text-slate-900">Em là ai?</h1>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {students.map((s) => (
              <button
                key={s.id}
                type={s.hasPin ? "button" : "submit"}
                name={s.hasPin ? undefined : "studentId"}
                value={s.hasPin ? undefined : s.id}
                onClick={() => s.hasPin && setChosen(s)}
                disabled={pending}
                className="flex flex-col items-center gap-2 rounded-2xl bg-indigo-50 p-4 outline-none hover:bg-indigo-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className={avatarClass} aria-hidden>{s.avatarEmoji}</span>
                <span className="font-semibold text-slate-800">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="studentId" value={chosen.id} />
          <div className="flex flex-col items-center gap-2 text-center">
            <span className={avatarClass} aria-hidden>{chosen.avatarEmoji}</span>
            <h1 className="text-2xl font-bold text-slate-900">Chào {chosen.name}!</h1>
            <p className="text-slate-500">Nhập mã PIN của em để vào học nhé.</p>
          </div>
          <Input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            required
            aria-label="Mã PIN"
            aria-invalid={Boolean(state.error)}
            className="h-14 text-center text-2xl tracking-[0.5em]"
          />
          <Button type="submit" disabled={pending} className="h-12 rounded-xl text-base font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            Vào học
          </Button>
          <button type="button" onClick={() => setChosen(null)} className="flex items-center justify-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
            <ArrowLeft className="size-4" /> Đổi học sinh
          </button>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-center text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 7: Layout uses the context**

`src/app/(app)/layout.tsx`:
```tsx
import { connection } from "next/server"
import AppFrame from "@/components/layout/AppFrame"
import { getNavCounts, getViewingStudent, listAssignments, listExerciseSets } from "@/server/queries"
import { toAssignment } from "@/server/views"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const now = new Date()
  const [student, navCounts, sets, assignments] = await Promise.all([getViewingStudent(), getNavCounts(now), listExerciseSets(), listAssignments()])
  return (
    <AppFrame student={student} navCounts={navCounts} sets={sets} assignments={assignments.map((a) => toAssignment(a, now))}>
      {children}
    </AppFrame>
  )
}
```
`AppFrame`: prop `student: Student | null`. Until Task 7 adds the empty state, when `student` is null pass this placeholder to the existing contexts so parent pages don't crash:
```ts
const NO_STUDENT: Student = { id: "", householdId: "", name: "Chưa có học sinh", grade: 1, schoolYear: 0, avatarEmoji: "👤", totalStars: 0 }
```
(Only reachable in parent mode when every child is archived. Task 7 removes it.)

- [ ] **Step 8: E2E helper picks the child; env docs**

`e2e/helpers.ts` → `open`:
```ts
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
```
Run `rg "goto\(" e2e` and route any student navigation that bypasses `open()` through it.

`.env.example`:
```
# Signs the PIN cookie (any long random string; required in production).
SESSION_SECRET=
# PARENT_PIN opens Parent mode (falls back to APP_PIN). Each child's PIN is set on the Students page.
APP_PIN=
PARENT_PIN=
```

- [ ] **Step 9: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
```
Manual with `pnpm dev`: open `/student` in a private window → child grid → "Minh An" → Today. In devtools set cookie `hh_pin=garbage` and reload `/student` → back at the grid, no 500. Archive check comes with Task 7.

- [ ] **Step 10: Commit**

```bash
git add -A src e2e .env.example
git commit -m "Signed PIN token, request context and child picker"
```

---

### Task 5: Scope every read and write by context

**Files:**
- Create: `src/server/ownership.ts`, `e2e/students.spec.ts`
- Modify: `src/server/queries.ts`, `src/server/rewards.ts`, `src/server/analytics.ts`, `src/server/actions/{library,grading,ai-grading,ai-hints,ai-scan,ai-solve,ai-summary,rewards}.ts`, `src/components/pages/StudentResults.tsx` (test id)

**Interfaces:**
- Consumes: `Context`, `getContext`, `assertAccess` (Task 4).
- Produces (all throw `new Error(NOT_FOUND)`, `NOT_FOUND = "Không tìm thấy."`, when out of scope):
  - `assertSetInHousehold(ctx: Context, setId: string): Promise<void>`
  - `assertAssignmentInScope(ctx: Context, assignmentId: string): Promise<void>`
  - `assertAttemptInScope(ctx: Context, attemptId: string): Promise<void>`
  - `assertRewardInHousehold(ctx: Context, rewardId: string): Promise<void>`
  - `assertRedemptionInScope(ctx: Context, redemptionId: string): Promise<void>`

- [ ] **Step 1: Write the failing isolation E2E**

In `src/components/pages/StudentResults.tsx` add `data-testid="result-item"` to the button that navigates to `studentPaths.result(r.id)`.

`e2e/students.spec.ts`:
```ts
import { expect, test } from "@playwright/test"
import { open, trackPageErrors } from "./helpers"

/*
 * Multi-child behaviour on the seed household: Minh An (grade 3, most demo
 * data) and Bảo Ngọc (grade 5). "Chính tả: Mùa thu của em", "Unit 5: My family"
 * and "Đọc hiểu: Cậu bé thông minh" are assigned to Minh An only.
 */

test("a child only sees their own work", async ({ page }) => {
  const errors = trackPageErrors(page)
  await open(page, "/student/results")
  await page.getByTestId("result-item").first().click()
  await page.waitForURL(/\/student\/results\/.+/)
  const anResult = page.url()

  await page.goto("/pin?role=student")
  await page.getByRole("button", { name: "Bảo Ngọc" }).click()
  await page.waitForURL((u) => u.pathname === "/student")
  await open(page, "/student/assignments", "Bảo Ngọc")
  await expect(page.getByText("Chính tả: Mùa thu của em")).toHaveCount(0)
  await expect(page.getByText("This is / That is")).toBeVisible()

  const response = await page.goto(anResult)
  expect(response?.status()).toBe(404)
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec playwright test e2e/students.spec.ts --project=ipad`
Expected: FAIL — Bảo Ngọc sees Minh An's assignment and the result URL returns 200.

- [ ] **Step 3: Ownership helpers**

Move `UUID` / `isUuid` from `queries.ts` to `src/lib/ids.ts` (`export const isUuid = (value: string) => UUID.test(value)`) and re-export from `queries.ts` (`export { isUuid } from "@/lib/ids"`) so existing imports keep working.

`src/server/ownership.ts`:
```ts
import "server-only"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { isUuid } from "@/lib/ids"
import type { Context } from "./access"

/*
 * Out-of-scope ids look exactly like missing ones. Parent mode: anything in the
 * household. Student mode: only the device child's assignments, attempts and
 * redemptions.
 */

const { exerciseSets, assignments, attempts, students, rewards, rewardRedemptions } = schema

export const NOT_FOUND = "Không tìm thấy."

function checkId(id: string) {
  if (!isUuid(id)) throw new Error(NOT_FOUND)
}

const ownChild = (ctx: Context) => (ctx.mode === "student" ? eq(assignments.studentId, ctx.studentId!) : undefined)

export async function assertSetInHousehold(ctx: Context, setId: string) {
  checkId(setId)
  const [row] = await db
    .select({ id: exerciseSets.id })
    .from(exerciseSets)
    .where(and(eq(exerciseSets.id, setId), eq(exerciseSets.householdId, ctx.householdId)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertAssignmentInScope(ctx: Context, assignmentId: string) {
  checkId(assignmentId)
  const [row] = await db
    .select({ id: assignments.id })
    .from(assignments)
    .innerJoin(students, eq(students.id, assignments.studentId))
    .where(and(eq(assignments.id, assignmentId), eq(students.householdId, ctx.householdId), ownChild(ctx)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertAttemptInScope(ctx: Context, attemptId: string) {
  checkId(attemptId)
  const [row] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
    .innerJoin(students, eq(students.id, assignments.studentId))
    .where(and(eq(attempts.id, attemptId), eq(students.householdId, ctx.householdId), ownChild(ctx)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertRewardInHousehold(ctx: Context, rewardId: string) {
  checkId(rewardId)
  const [row] = await db.select({ id: rewards.id }).from(rewards).where(and(eq(rewards.id, rewardId), eq(rewards.householdId, ctx.householdId)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertRedemptionInScope(ctx: Context, redemptionId: string) {
  checkId(redemptionId)
  const [row] = await db
    .select({ id: rewardRedemptions.id })
    .from(rewardRedemptions)
    .innerJoin(students, eq(students.id, rewardRedemptions.studentId))
    .where(
      and(
        eq(rewardRedemptions.id, redemptionId),
        eq(students.householdId, ctx.householdId),
        ctx.mode === "student" ? eq(rewardRedemptions.studentId, ctx.studentId!) : undefined,
      ),
    )
  if (!row) throw new Error(NOT_FOUND)
}
```

- [ ] **Step 4: Scope the queries**

`src/server/queries.ts` (import `and` from drizzle):
- File comment: replace "Only one student exists." with "Scoped by the request context (server/access.ts): sets by household, assignments and attempts by child."
- `listExerciseSets`: add `.where(eq(exerciseSets.householdId, (await getContext()).householdId))` before `.orderBy`.
- `getExerciseSetDetail`: `findFirst({ where: and(eq(exerciseSets.id, id), eq(exerciseSets.householdId, (await getContext()).householdId)) })`.
- `listAssignments`:
```ts
export async function listAssignments(filter?: { ids?: string[] }): Promise<AssignmentRecord[]> {
  await settleExpiredAttempts()
  const { studentId } = await getContext()
  if (!studentId) return []
  const rows = await db
    .select({ assignment: assignments, set: exerciseSets })
    .from(assignments)
    .innerJoin(exerciseSets, eq(exerciseSets.id, assignments.setId))
    .where(and(eq(assignments.studentId, studentId), filter?.ids ? inArray(assignments.id, filter.ids) : undefined))
    .orderBy(asc(assignments.dueAt))
```
  (rest unchanged; `getAssignment` and `getAttemptDetail` go through it, so another child's ids return null and pages call `notFound()`).
- `listGradedAnswers`: `const { studentId } = await getContext(); if (!studentId) return []` and `.where(and(isNotNull(attempts.gradedAt), eq(assignments.studentId, studentId)))`.
- `getNavCounts`:
```ts
export async function getNavCounts(now = new Date()) {
  await settleExpiredAttempts()
  const { studentId } = await getContext()
  if (!studentId) return { awaitingGrading: 0, openAssignments: 0, pendingRedemptions: 0 }
  const {
    rows: [row],
  } = await db.execute<{ awaiting: number; open: number; redemptions: number }>(sql`
    with latest as (
      select distinct on (t.assignment_id) t.assignment_id, t.submitted_at, t.graded_at
      from ${attempts} t order by t.assignment_id, t.attempt_no desc
    )
    select
      count(*) filter (where l.submitted_at is not null and l.graded_at is null)::int as awaiting,
      count(*) filter (where l.submitted_at is null and a.available_from <= ${now.toISOString()})::int as open,
      (select count(*) from ${rewardRedemptions} r where r.status = 'pending' and r.student_id = ${studentId})::int as redemptions
    from ${assignments} a left join latest l on l.assignment_id = a.id
    where a.student_id = ${studentId}
  `)
  return { awaitingGrading: row?.awaiting ?? 0, openAssignments: row?.open ?? 0, pendingRedemptions: row?.redemptions ?? 0 }
}
```
- `src/server/rewards.ts` `listRewards`: `.where(eq(schema.rewards.householdId, (await getContext()).householdId))` before `.orderBy`.
- `src/server/analytics.ts` `loadSetSkills`:
```ts
async function loadSetSkills(): Promise<SetSkills[]> {
  const { questions, exerciseSets } = schema
  const { householdId } = await getContext()
  const [sets, skillRows] = await Promise.all([
    listExerciseSets(),
    db.execute<{ set_id: string; skills: string[] }>(sql`
      select q.set_id, array_agg(distinct s.skill) as skills
      from ${questions} q
      join ${exerciseSets} es on es.id = q.set_id and es.household_id = ${householdId},
      jsonb_array_elements_text(coalesce(q.content->'skills', '[]'::jsonb)) as s(skill)
      group by q.set_id
    `),
  ])
```
  (rest unchanged).

- [ ] **Step 5: Scope the actions**

Change every `await assertAccess(role)` in these files to `const ctx = await assertAccess(role)` and add:

| Action | Check |
|---|---|
| `library.loadQuestions(setId)` | `await assertSetInHousehold(ctx, setId)` |
| `library.requestSetUploads(setId)` | `if (await db.$count(exerciseSets, eq(exerciseSets.id, setId))) await assertSetInHousehold(ctx, setId)` — an unsaved new id is allowed |
| `library.saveExerciseSet` | before the transaction: `const [existing] = await db.select({ householdId: exerciseSets.householdId }).from(exerciseSets).where(eq(exerciseSets.id, set.id)); if (existing && existing.householdId !== ctx.householdId) throw new Error(NOT_FOUND)`; insert `householdId: ctx.householdId` |
| `library.duplicateExerciseSet(id)`, `deleteExerciseSet(id)`, `previewSetUploads(setId)` | `await assertSetInHousehold(ctx, id)` |
| `library.insertAssignments` | each `item.setId` → `await assertSetInHousehold(ctx, item.setId)` (pass `ctx` in from `createAssignments` / `quickAssign`) |
| `library.updateAssignment(id)`, `deleteAssignment(id)` | `await assertAssignmentInScope(ctx, id)` |
| `grading.gradeAttempt(attemptId)` | `await assertAttemptInScope(ctx, attemptId)` |
| `ai-grading.suggestEssayGrade(answerId)` | after loading the answer's `attemptId`: `await assertAttemptInScope(ctx, answer.attemptId)` |
| `ai-grading.suggestAllEssayGrades(attemptId)`, `gradePaperWithAI(attemptId)` | `await assertAttemptInScope(ctx, attemptId)` |
| `ai-hints.explainMistakes(attemptId)` | `await assertAttemptInScope(ctx, attemptId)` |
| `ai-scan.scanDocuments` | same rule as `requestSetUploads` on `setId` |
| `ai-solve.solveQuestion` | same rule as `requestSetUploads` on `setId` |
| `ai-summary.summarizeProgress` | feedback query: add `eq(assignments.studentId, ctx.studentId)` (throw "Chưa có học sinh nào." when `ctx.studentId` is null) |
| `rewards.saveReward` | update: `.where(and(eq(rewards.id, id), eq(rewards.householdId, ctx.householdId)))`; `max(position)` query: `.where(eq(rewards.householdId, ctx.householdId))` |
| `rewards.deleteReward(id)` | `await assertRewardInHousehold(ctx, id)` |
| `rewards.reorderRewards(ids)` | `for (const id of list) await assertRewardInHousehold(ctx, id)` |
| `rewards.requestRedemption(rewardId)` | `await assertRewardInHousehold(ctx, rewardId)`; lock `select pg_advisory_xact_lock(${REDEEM_LOCK}, hashtext(${ctx.studentId}))` (two-arg form takes two `int4`; make `REDEEM_LOCK` an int4-sized constant) |
| `rewards.cancelRedemption(id)`, `decideRedemption(id)` | `await assertRedemptionInScope(ctx, id)` |

`attempts.ts` needs nothing new: `loadWebAssignment` / `loadPaperAssignment` go through `getAssignment`, which now only finds the device child's assignments.

- [ ] **Step 6: Run the isolation E2E and the suites**

```bash
pnpm exec playwright test e2e/students.spec.ts --project=ipad
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```
Expected: PASS everywhere.

- [ ] **Step 7: Commit**

```bash
git add -A src e2e
git commit -m "Scope queries and actions by household and child"
```

---

### Task 6: Shell — viewing-child menu, hold-to-open, no mode toggle

**Files:**
- Create: `src/components/layout/HoldToOpen.tsx`, `src/components/layout/ParentMenu.tsx`, `src/server/actions/students.ts`
- Modify: `src/components/layout/{AppFrame,AppShell,Sidebar,TopAppBar,StudentChip,routes,nav-config}.tsx|ts`, `src/app/(app)/layout.tsx`, `src/lib/types.ts`, `src/app/globals.css`, `e2e/smoke.spec.ts`, `e2e/students.spec.ts`
- Delete: `src/components/layout/ModeToggle.tsx`

**Interfaces:**
- Consumes: `listHouseholdStudents`, `toStudent` (Task 4); `getContext`, `assertAccess` (Task 4); `isLocked` (Task 1).
- Produces:
  - `interface ChildOption { id: string; name: string; avatarEmoji: string; grade: number; locked: boolean }` (lib/types)
  - `AppFrame` prop `household: ChildOption[]`; hook `useHousehold(): ChildOption[]`
  - action `setViewingStudent(id: string): Promise<ActionResult<null>>`
  - `parentPaths.students: Route`, `parentPaths.student(id: string): Route`
  - `HoldToOpen` props `{ onOpen: () => void; children: React.ReactNode; className?: string }`
  - `ParentMenu` props `{ student: Student | null; household: ChildOption[]; onOpenStudentMode: () => void; compact?: boolean }`

- [ ] **Step 1: Failing E2E**

In `e2e/smoke.spec.ts`, replace the block that uses `getByRole("radiogroup", { name: "Chọn chế độ" })` (around lines 30–45) with:
```ts
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
```
E2E runs without `PARENT_PIN`, so the hold lands on `/parent` directly (the proxy only asks for a PIN when one is set). If WebKit's iPhone emulation doesn't turn `page.mouse` into pointer events, use `await avatar.dispatchEvent("pointerdown", { clientX: box.x + 5, clientY: box.y + 5 })` instead of `mouse.move/down`.

Append to `e2e/students.spec.ts`:
```ts
test("parent switches the viewing child from the header", async ({ page }) => {
  await open(page, "/parent/grading")
  await expect(page.getByText("Đọc hiểu: Cậu bé thông minh").first()).toBeVisible()
  await page.getByRole("button", { name: /Đang xem: Minh An/ }).filter({ visible: true }).click()
  await page.getByRole("menuitemradio", { name: /Bảo Ngọc/ }).click()
  await expect(page.getByRole("button", { name: /Đang xem: Bảo Ngọc/ }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Đọc hiểu: Cậu bé thông minh")).toHaveCount(0)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec playwright test e2e/smoke.spec.ts e2e/students.spec.ts --project=ipad`
Expected: FAIL — mode toggle present, no menu.

- [ ] **Step 3: `setViewingStudent`**

`src/server/actions/students.ts`:
```ts
"use server"

import { cookies } from "next/headers"
import { refresh } from "next/cache"
import { z } from "zod"
import { runAction, type ActionResult } from "@/lib/action-result"
import { VIEWING_COOKIE } from "@/lib/pin"
import { assertAccess } from "../access"
import { listHouseholdStudents } from "../students"

/** Parent devices: which child parent pages show. */
export async function setViewingStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const studentId = z.uuid().parse(id)
    const children = await listHouseholdStudents(ctx.householdId)
    if (!children.some((c) => c.id === studentId)) throw new Error("Không tìm thấy học sinh.")
    ;(await cookies()).set(VIEWING_COOKIE, studentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 86_400,
    })
    refresh()
    return null
  })
}
```

- [ ] **Step 4: Layout passes the household's children**

Add `ChildOption` to `src/lib/types.ts`:
```ts
/** A child in the parent's header menu and assign picker. */
export interface ChildOption {
  id: string
  name: string
  avatarEmoji: string
  grade: number
  locked: boolean
}
```
`src/app/(app)/layout.tsx` — after the `Promise.all` (student devices never receive siblings):
```ts
  const ctx = await getContext()
  const household: ChildOption[] =
    ctx.mode === "parent"
      ? await Promise.all(
          (await listHouseholdStudents(ctx.householdId)).map(async (r) => ({
            id: r.id,
            name: r.name,
            avatarEmoji: r.avatarEmoji,
            grade: (await toStudent(r, 0)).grade,
            locked: isLocked(r, now),
          })),
        )
      : []
```
and pass `household={household}` to `AppFrame`.

In `AppFrame`: prop `household: ChildOption[]`, a `HouseholdContext` and
```ts
export function useHousehold(): ChildOption[] {
  return useContext(HouseholdContext)
}
```
Rename `handleModeChange` to `openMode(next: AppMode)` (same body: leave guard + `window.location.assign(MODE_HOME[next])`; on a device with a student token and a parent PIN set, the proxy turns `/parent` into the parent PIN page) and pass it to `AppShell` as `onOpenMode`. Update the Toaster comment to "…never cover the header buttons."

- [ ] **Step 5: HoldToOpen**

`src/components/layout/HoldToOpen.tsx`:
```tsx
"use client"

import { useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const HOLD_MS = 2000
const MOVE_TOLERANCE = 10

/**
 * Wraps the student avatar: pressing and holding it for 2 s calls onOpen. A
 * short tap does nothing and nothing hints at the gesture, so children don't
 * find their way into parent mode by tapping around.
 */
export default function HoldToOpen({ onOpen, children, className }: { onOpen: () => void; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
    setHolding(false)
  }

  return (
    <div
      data-testid="hold-to-open"
      className={cn("relative touch-none select-none", className)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY }
        setHolding(true)
        timer.current = window.setTimeout(() => {
          cancel()
          onOpen()
        }, HOLD_MS)
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) cancel()
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      {children}
      {holding && (
        <svg className="pointer-events-none absolute -inset-1 size-[calc(100%+8px)] -rotate-90 text-indigo-500" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="100.5"
            strokeDashoffset={reduced ? 0 : 100.5}
            style={reduced ? undefined : { animation: `hold-fill ${HOLD_MS}ms linear forwards` }}
          />
        </svg>
      )}
    </div>
  )
}
```
(Check how other components import `useReducedMotion` — `rg "useReducedMotion" src` — and use the same module path.)

Add to `src/app/globals.css`:
```css
@keyframes hold-fill {
  to {
    stroke-dashoffset: 0;
  }
}
```

- [ ] **Step 6: ParentMenu and routes**

`src/components/layout/ParentMenu.tsx`:
```tsx
"use client"

import { Backpack, Lock, Users } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { unwrap } from "@/lib/action-result"
import type { ChildOption, Student } from "@/lib/types"
import { setViewingStudent } from "@/server/actions/students"
import { useAppNavigation } from "./AppFrame"
import { parentPaths } from "./routes"

/** Parent header: who is being viewed, switch child, manage children, open student mode. */
export default function ParentMenu({ student, household, onOpenStudentMode, compact }: {
  student: Student | null
  household: ChildOption[]
  onOpenStudentMode: () => void
  compact?: boolean
}) {
  const { navigate } = useAppNavigation()
  const choose = async (id: string) => {
    if (id === student?.id) return
    try {
      unwrap(await setViewingStudent(id))
    } catch (e) {
      toast.error("Chưa đổi được học sinh", { description: e instanceof Error ? e.message : undefined })
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={student ? `Đang xem: ${student.name}` : "Chưa có học sinh"}
        className="flex items-center gap-2 rounded-full p-1 pr-3 outline-none hover:bg-slate-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-lg" aria-hidden>
          {student?.avatarEmoji ?? "👤"}
        </span>
        {!compact && <span className="max-w-32 truncate text-sm font-semibold text-slate-800">{student?.name ?? "Chưa có học sinh"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {household.length > 1 && (
          <>
            <DropdownMenuLabel>Đang xem</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={student?.id} onValueChange={choose}>
              {household.map((c) => (
                <DropdownMenuRadioItem key={c.id} value={c.id}>
                  <span aria-hidden>{c.avatarEmoji}</span> {c.name}
                  <span className="ml-auto text-xs text-slate-500">Lớp {c.grade}</span>
                  {c.locked && <Lock className="size-3.5 text-amber-600" aria-label="Đang khoá" />}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => navigate(parentPaths.students)}>
          <Users /> Quản lý học sinh
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenStudentMode}>
          <Backpack /> Mở chế độ học sinh
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```
Check `src/components/ui/dropdown-menu.tsx` exports `DropdownMenuRadioGroup` / `DropdownMenuRadioItem` / `DropdownMenuLabel`; add them from the standard shadcn template if missing.

`routes.ts`:
```ts
export const parentPaths = {
  rewards: "/parent/rewards" as Route,
  students: "/parent/students" as Route,
  student: (id: string) => `/parent/students/${encodeURIComponent(id)}` as Route,
}
```
`SUB_PAGE_TITLES`: add `[/^\/parent\/students$/, "Học sinh"]` and `[/^\/parent\/students\/[^/]+$/, "Chi tiết học sinh"]`.

- [ ] **Step 7: Wire the shell**

- `TopAppBar`: props `onOpenMode: (mode: AppMode) => void`, `student: Student | null`, `household: ChildOption[]` replace `onModeChange`. Replace `<ModeToggle …/>` with:
```tsx
{mode === 'student' ? (
  <HoldToOpen onOpen={() => onOpenMode('parent')}>
    <span className="grid size-[40px] place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-[20px]" aria-hidden>
      {student?.avatarEmoji}
    </span>
  </HoldToOpen>
) : (
  <ParentMenu compact student={student} household={household} onOpenStudentMode={() => onOpenMode('student')} />
)}
```
  Update the `onBack` prop comment ("…instead of the header buttons").
- `Sidebar`: delete the "Chế độ" label and `ModeToggle`. Student mode: in `StudentChip`, wrap the avatar element with `HoldToOpen` when `mode === 'student'` (`StudentChip` gets an `onHold?: () => void` prop; Sidebar passes `() => onOpenMode('parent')`). Parent mode: render `<ParentMenu student={student} household={household} compact={collapsed} onOpenStudentMode={() => onOpenMode('student')} />` where the `StudentChip` was.
- `AppShell`: thread `onOpenMode`, `student`, `household` instead of `onModeChange`.
- Delete `ModeToggle.tsx`; `rg ModeToggle src` must return nothing. Remove `MODE_LABELS` from `nav-config.ts` if nothing else uses it.

- [ ] **Step 8: Run tests**

```bash
pnpm exec playwright test e2e/smoke.spec.ts e2e/students.spec.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```
Expected: PASS on both projects.

- [ ] **Step 9: Commit**

```bash
git add -A src e2e
git commit -m "Parent header menu with viewing child; hold-to-open replaces the mode toggle"
```

---

### Task 7: Students list, add/edit, PIN, empty state

**Files:**
- Create: `src/app/(app)/parent/students/page.tsx`, `src/components/pages/Students.tsx`, `src/components/students/StudentSheet.tsx`, `src/components/students/NoStudents.tsx`, `src/components/students/emoji.ts`
- Modify: `src/server/actions/students.ts`, `src/server/students.ts`, `src/components/layout/AppFrame.tsx`, `src/app/(app)/layout.tsx`, `src/lib/types.ts`, `e2e/students.spec.ts`, every `useStudent()` caller

**Interfaces:**
- Consumes: `isValidPin`, `studentPinHash` (Task 2); `schoolYearOf`, `schoolYearStart`, `schoolYearLabel`, `isLocked`, `localDay` (Task 1); `listHouseholdStudents`, `toStudent` (Task 4); `parentPaths` (Task 6); `loadRewardFacts` (Task 3).
- Produces:
  - `interface StudentCard { id: string; name: string; avatarEmoji: string; grade: number; className: string | null; schoolYear: number; stars: number; hasPin: boolean; locked: boolean; lockedUntil: string | null; archived: boolean }` (lib/types)
  - `listStudentCards(householdId: string): Promise<StudentCard[]>`, `starBalance(studentId: string): Promise<number>`, `toCard(row: StudentRow, stars: number, now: Date): Promise<StudentCard>` (server/students.ts)
  - actions `createStudent(input: { name: string; avatarEmoji: string; pin?: string; grade: number; className?: string; schoolYear: number }): Promise<ActionResult<{ id: string }>>`, `updateStudent(input: { id: string; name: string; avatarEmoji: string }): Promise<ActionResult<null>>`, `setStudentPin(id: string, pin: string | null): Promise<ActionResult<null>>`, `archiveStudent(id: string): Promise<ActionResult<null>>`, `restoreStudent(id: string): Promise<ActionResult<null>>`; helper `ownStudent(householdId: string, id: string): Promise<StudentRow>` (module-private)
  - `useStudent(): Student | null`, `useRequiredStudent(): Student` (AppFrame)
  - `StudentSheet` props `{ open: boolean; onOpenChange: (open: boolean) => void; editing: StudentCard | null; now: string }`

- [ ] **Step 1: Failing E2E**

Append to `e2e/students.spec.ts`:
```ts
test("parent adds a child with a PIN, who then signs in; archive and restore", async ({ page }) => {
  await open(page, "/parent/students")
  await page.getByRole("button", { name: "Thêm học sinh" }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByRole("button", { name: "🐰" }).click()
  await sheet.getByLabel("Tên").fill("Gia Huy")
  await sheet.getByRole("radio", { name: "Lớp 1" }).click()
  await sheet.getByLabel("Mã PIN").fill("2468")
  await sheet.getByRole("button", { name: "Thêm học sinh" }).click()
  const card = page.getByTestId("student-card").filter({ hasText: "Gia Huy" })
  await expect(card).toContainText("Lớp 1")
  await expect(card).toContainText("Có PIN")

  await page.goto("/pin?role=student")
  await page.getByRole("button", { name: "Gia Huy" }).click()
  await page.getByLabel("Mã PIN").fill("2468")
  await page.getByRole("button", { name: "Vào học" }).click()
  await page.waitForURL((u) => u.pathname === "/student")

  await open(page, "/parent/students")
  await page.getByRole("button", { name: "Sửa Gia Huy" }).click()
  page.once("dialog", (d) => d.accept())
  await page.getByRole("button", { name: "Lưu trữ học sinh" }).click()
  await page.getByRole("button", { name: /Đã lưu trữ/ }).click()
  await page.getByTestId("student-card").filter({ hasText: "Gia Huy" }).getByRole("button", { name: "Khôi phục" }).click()
  await expect(page.getByRole("button", { name: "Sửa Gia Huy" })).toBeVisible()
})
```
(The archive button sits in the edit sheet for now; Task 8 moves it to the detail page and updates this test.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec playwright test e2e/students.spec.ts -g "adds a child" --project=ipad`
Expected: FAIL — `/parent/students` is a 404.

- [ ] **Step 3: Server read side**

Add `StudentCard` to `src/lib/types.ts` as in Interfaces. Add to `src/server/students.ts` (imports: `loadRewardFacts` from `@/db/reward-facts`, `computeRewards` from `@/lib/views/rewards`, `isLocked` from `@/lib/student-lock`, `settleExpiredAttempts` from `./attempt-finalize`, `StudentCard` from `@/lib/types`):
```ts
/** Star balance of any child (the Students page shows every child, not just the viewing one). */
export async function starBalance(studentId: string): Promise<number> {
  const { facts, seen } = await loadRewardFacts(db, { studentId })
  return computeRewards(facts, seen, new Date()).ledger.balance
}

export async function toCard(row: StudentRow, stars: number, now: Date): Promise<StudentCard> {
  const s = await toStudent(row, stars)
  const locked = isLocked(row, now)
  return {
    id: row.id,
    name: row.name,
    avatarEmoji: row.avatarEmoji,
    grade: s.grade,
    className: s.className ?? null,
    schoolYear: s.schoolYear,
    stars,
    hasPin: Boolean(row.pinHash),
    locked,
    lockedUntil: locked ? (row.lockedUntil?.toISOString() ?? null) : null,
    archived: Boolean(row.archivedAt),
  }
}

/** Every child of the household, archived ones included. */
export async function listStudentCards(householdId: string): Promise<StudentCard[]> {
  await settleExpiredAttempts()
  const rows = await db.select().from(students).where(eq(students.householdId, householdId)).orderBy(asc(students.createdAt))
  const now = new Date()
  return Promise.all(rows.map(async (r) => toCard(r, await starBalance(r.id), now)))
}
```

- [ ] **Step 4: Actions**

Append to `src/server/actions/students.ts` (add imports: `and, eq` from `drizzle-orm`; `db, schema` from `@/db`; `isValidPin, studentPinHash` from `@/lib/pin`; `schoolYearStart` from `@/lib/school-year`):
```ts
const pinSchema = z.string().refine(isValidPin, "Mã PIN gồm 4–6 chữ số.")
const nameSchema = z.string().trim().min(1, "Hãy nhập tên.").max(40)
const emojiSchema = z.string().min(1).max(8)

const createSchema = z.object({
  name: nameSchema,
  avatarEmoji: emojiSchema,
  pin: pinSchema.optional(),
  grade: z.number().int().min(1).max(12),
  className: z.string().trim().max(20).optional(),
  schoolYear: z.number().int().min(2000).max(2100),
})

async function ownStudent(householdId: string, id: string) {
  const studentId = z.uuid().parse(id)
  const row = await db.query.students.findFirst({ where: and(eq(schema.students.id, studentId), eq(schema.students.householdId, householdId)) })
  if (!row) throw new Error("Không tìm thấy học sinh.")
  return row
}

export async function createStudent(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const data = createSchema.parse(input)
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(schema.students).values({ householdId: ctx.householdId, name: data.name, avatarEmoji: data.avatarEmoji }).returning()
      if (data.pin) await tx.update(schema.students).set({ pinHash: await studentPinHash(row.id, data.pin) }).where(eq(schema.students.id, row.id))
      await tx.insert(schema.enrollments).values({
        studentId: row.id,
        schoolYear: data.schoolYear,
        grade: data.grade,
        className: data.className || null,
        startsOn: schoolYearStart(data.schoolYear),
      })
      return row.id
    })
    refresh()
    return { id }
  })
}

export async function updateStudent(input: { id: string; name: string; avatarEmoji: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, input.id)
    await db
      .update(schema.students)
      .set({ name: nameSchema.parse(input.name), avatarEmoji: emojiSchema.parse(input.avatarEmoji) })
      .where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

/** `null` removes the PIN: the child then picks their avatar without one. */
export async function setStudentPin(id: string, pin: string | null): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    const pinHash = pin === null ? null : await studentPinHash(row.id, pinSchema.parse(pin))
    await db.update(schema.students).set({ pinHash }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

export async function archiveStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    await db.update(schema.students).set({ archivedAt: new Date() }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

export async function restoreStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    await db.update(schema.students).set({ archivedAt: null }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}
```

- [ ] **Step 5: Page and components**

`src/components/students/emoji.ts`:
```ts
/** Avatar choices for children. */
export const AVATAR_EMOJIS = ["🦊", "🐼", "🐰", "🐯", "🦁", "🐸", "🐨", "🐧", "🦄", "🐙"] as const
```

`src/app/(app)/parent/students/page.tsx`:
```tsx
import { connection } from "next/server"
import Students from "@/components/pages/Students"
import { assertAccess } from "@/server/access"
import { listStudentCards } from "@/server/students"

export default async function StudentsPage() {
  await connection()
  const ctx = await assertAccess("parent")
  return <Students cards={await listStudentCards(ctx.householdId)} now={new Date().toISOString()} />
}
```

`src/components/students/StudentSheet.tsx` — read `src/components/schedule/EditAssignmentSheet.tsx` first and reuse its exact `SheetContent` / header / footer classes and its `ToggleGroup` styling; the structure and behaviour are:
```tsx
"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { unwrap } from "@/lib/action-result"
import { localDay } from "@/lib/dates"
import { schoolYearLabel, schoolYearOf } from "@/lib/school-year"
import { cn } from "@/lib/utils"
import type { StudentCard } from "@/lib/types"
import { archiveStudent, createStudent, setStudentPin, updateStudent } from "@/server/actions/students"
import { AVATAR_EMOJIS } from "./emoji"

const GRADES = [1, 2, 3, 4, 5, 6, 7]

const fail = (title: string) => (e: unknown) => toast.error(title, { description: e instanceof Error ? e.message : undefined })

export default function StudentSheet({ open, onOpenChange, editing, now }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = add a child. */
  editing: StudentCard | null
  now: string
}) {
  const thisYear = schoolYearOf(localDay(new Date(now)))
  const [emoji, setEmoji] = useState<string>(editing?.avatarEmoji ?? AVATAR_EMOJIS[0])
  const [name, setName] = useState(editing?.name ?? "")
  const [grade, setGrade] = useState(3)
  const [className, setClassName] = useState("")
  const [schoolYear, setSchoolYear] = useState(thisYear)
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      if (editing) {
        unwrap(await updateStudent({ id: editing.id, name, avatarEmoji: emoji }))
        if (pin) unwrap(await setStudentPin(editing.id, pin))
        toast.success("Đã lưu")
      } else {
        unwrap(await createStudent({ name, avatarEmoji: emoji, grade, className: className || undefined, schoolYear, pin: pin || undefined }))
        toast.success(`Đã thêm ${name}`)
      }
      onOpenChange(false)
    } catch (e) {
      fail("Chưa lưu được")(e)
    } finally {
      setBusy(false)
    }
  }

  const removePin = async () => {
    if (!editing) return
    try {
      unwrap(await setStudentPin(editing.id, null))
      toast.success("Đã xoá mã PIN")
      onOpenChange(false)
    } catch (e) {
      fail("Chưa xoá được")(e)
    }
  }

  const archive = async () => {
    if (!editing || !window.confirm(`Lưu trữ ${editing.name}? Bé sẽ không còn trong danh sách chọn; dữ liệu vẫn được giữ.`)) return
    try {
      unwrap(await archiveStudent(editing.id))
      onOpenChange(false)
    } catch (e) {
      fail("Chưa lưu trữ được")(e)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{editing ? `Sửa ${editing.name}` : "Thêm học sinh"}</SheetTitle>
          <SheetDescription>{editing ? "Đổi tên, ảnh đại diện hoặc mã PIN." : "Mỗi bé dùng thiết bị riêng và có thể có mã PIN riêng."}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div>
            <Label>Ảnh đại diện</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={e}
                  aria-pressed={emoji === e}
                  onClick={() => setEmoji(e)}
                  className={cn("grid size-11 place-items-center rounded-full text-2xl", emoji === e ? "bg-indigo-100 ring-2 ring-indigo-500" : "bg-slate-50")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="student-name">Tên</Label>
            <Input id="student-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          {!editing && (
            <>
              <div>
                <Label>Lớp</Label>
                <ToggleGroup type="single" value={String(grade)} onValueChange={(v) => v && setGrade(Number(v))} className="mt-2 flex-wrap justify-start">
                  {GRADES.map((g) => (
                    <ToggleGroupItem key={g} value={String(g)} aria-label={`Lớp ${g}`}>
                      {g}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="student-class">Tên lớp</Label>
                  <Input id="student-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Không bắt buộc" maxLength={20} />
                </div>
                <div>
                  <Label htmlFor="student-year">Năm học</Label>
                  <select
                    id="student-year"
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2"
                  >
                    {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                      <option key={y} value={y}>
                        {schoolYearLabel(y)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="student-pin">{editing?.hasPin ? "Đổi mã PIN" : "Mã PIN"}</Label>
            <div className="relative">
              <Input
                id="student-pin"
                aria-label="Mã PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                placeholder="4–6 số, để trống = không PIN"
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? "Ẩn mã PIN" : "Hiện mã PIN"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500"
              >
                {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {editing?.hasPin && (
              <button type="button" onClick={removePin} className="mt-1 text-sm text-red-600 hover:underline">
                Xoá PIN
              </button>
            )}
          </div>
        </div>
        <SheetFooter className="flex-row justify-between">
          {editing ? (
            <Button variant="ghost" className="text-red-600" onClick={archive}>
              Lưu trữ học sinh
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              {editing ? "Lưu" : "Thêm học sinh"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```
If other sheets use `src/components/ui/select.tsx` instead of a native `<select>`, use it.

`src/components/pages/Students.tsx`:
```tsx
"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, KeyRound, Lock, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { unwrap } from "@/lib/action-result"
import { schoolYearLabel } from "@/lib/school-year"
import type { StudentCard } from "@/lib/types"
import { restoreStudent } from "@/server/actions/students"
import { useAppNavigation, useStudent } from "@/components/layout/AppFrame"
import { parentPaths } from "@/components/layout/routes"
import StudentSheet from "@/components/students/StudentSheet"

const lockLabel = (until: string | null) =>
  until ? `Khoá đến ${new Date(until).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đang khoá"

export default function Students({ cards, now }: { cards: StudentCard[]; now: string }) {
  const viewing = useStudent()
  const { navigate } = useAppNavigation()
  const [sheet, setSheet] = useState<{ editing: StudentCard | null } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const active = cards.filter((c) => !c.archived)
  const archived = cards.filter((c) => c.archived)

  const restore = async (id: string) => {
    try {
      unwrap(await restoreStudent(id))
    } catch (e) {
      toast.error("Chưa khôi phục được", { description: e instanceof Error ? e.message : undefined })
    }
  }

  const card = (c: StudentCard) => (
    <div key={c.id} data-testid="student-card" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <button type="button" disabled={c.archived} onClick={() => navigate(parentPaths.student(c.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-2xl" aria-hidden>
          {c.avatarEmoji}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {c.name}
            {viewing?.id === c.id && <span className="text-xs font-medium text-indigo-600">Đang xem ✓</span>}
            {c.locked && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                <Lock className="size-3" />
                {lockLabel(c.lockedUntil)}
              </span>
            )}
          </span>
          <span className="block text-sm text-slate-500">
            Lớp {c.grade}
            {c.className ? ` · ${c.className}` : ""} · {schoolYearLabel(c.schoolYear)}
          </span>
          <span className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span data-testid="student-stars">⭐ {c.stars}</span>
            <span className="flex items-center gap-1">
              {c.hasPin ? (
                <>
                  <KeyRound className="size-3" />
                  Có PIN
                </>
              ) : (
                "Không PIN"
              )}
            </span>
          </span>
        </span>
      </button>
      {c.archived ? (
        <Button variant="outline" size="sm" onClick={() => restore(c.id)}>
          Khôi phục
        </Button>
      ) : (
        <>
          <Button variant="ghost" size="icon" aria-label={`Sửa ${c.name}`} onClick={() => setSheet({ editing: c })}>
            <Pencil />
          </Button>
          <ChevronRight className="size-5 text-slate-400" aria-hidden />
        </>
      )}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="hidden text-2xl font-bold text-slate-900 md:block">Học sinh</h1>
        <Button onClick={() => setSheet({ editing: null })} className="ml-auto">
          <Plus /> Thêm học sinh
        </Button>
      </div>
      {active.map(card)}
      {archived.length > 0 && (
        <>
          <button type="button" onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-1 text-sm font-medium text-slate-500">
            <ChevronDown className={showArchived ? "size-4" : "size-4 -rotate-90"} /> Đã lưu trữ ({archived.length})
          </button>
          {showArchived && archived.map(card)}
        </>
      )}
      {sheet && <StudentSheet open onOpenChange={(o) => !o && setSheet(null)} editing={sheet.editing} now={now} />}
    </div>
  )
}
```
Look at an existing parent page (e.g. `src/components/pages/ParentRewards.tsx`) for page padding, heading and motion wrappers and match them.

- [ ] **Step 6: Empty state replaces the placeholder student**

`src/components/students/NoStudents.tsx`:
```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import StudentSheet from "./StudentSheet"

/** Parent pages when the household has no active child yet. */
export default function NoStudents({ now }: { now: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="text-6xl" aria-hidden>🎒</div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Chưa có học sinh nào</h2>
        <p className="mt-2 text-slate-500">Thêm bé đầu tiên để bắt đầu giao bài.</p>
        <Button className="mt-6" onClick={() => setOpen(true)}>
          Thêm học sinh đầu tiên
        </Button>
      </div>
      {open && <StudentSheet open onOpenChange={setOpen} editing={null} now={now} />}
    </div>
  )
}
```
`AppFrame`: remove `NO_STUDENT`; `StudentContext` holds `Student | null`; `useStudent(): Student | null`; add
```ts
/** For pages that only render with a child (everything except the Students page and the empty state). */
export function useRequiredStudent(): Student {
  const student = useStudent()
  if (!student) throw new Error("useRequiredStudent needs a child")
  return student
}
```
New prop `now: string` (layout passes `now.toISOString()`). When `student === null` and `pathname !== parentPaths.students`, render `<NoStudents now={now} />` inside `AppShell` instead of `children`. Switch every existing `useStudent()` caller to `useRequiredStudent()` (`rg "useStudent\(\)" src` — all except `Students.tsx`).

- [ ] **Step 7: Verify**

```bash
pnpm exec playwright test e2e/students.spec.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```
Manual: archive both seed children → `/parent` shows "Chưa có học sinh nào"; a private window on `/pin?role=student` shows "Nhờ bố mẹ thêm học sinh trước nhé."; a device whose cookie names an archived child lands on the picker; restore both from `/parent/students` (`pnpm db:seed` also resets).

- [ ] **Step 8: Commit**

```bash
git add -A src e2e
git commit -m "Students page: add, edit, PIN, archive and empty state"
```

---

### Task 8: Child detail, school years and "Lên lớp"

**Files:**
- Create: `src/app/(app)/parent/students/[id]/page.tsx`, `src/components/students/StudentDetail.tsx`, `src/components/students/PromoteSheet.tsx`, `src/components/students/EnrollmentSheet.tsx`
- Modify: `src/server/actions/students.ts`, `src/server/students.ts`, `src/components/students/StudentSheet.tsx`, `src/lib/types.ts`, `e2e/students.spec.ts`

**Interfaces:**
- Consumes: `suggestPromotion`, `schoolYearLabel`, `currentEnrollment`, `Enrollment` (Task 1); `listEnrollments`, `toCard` (Tasks 4, 7); `ownStudent`, `archiveStudent`, `setViewingStudent` (Tasks 6–7); `celebrate` (`src/lib/animations.ts`).
- Produces:
  - `interface StudentDetailData { card: StudentCard; years: (Enrollment & { current: boolean })[]; streak: number; badges: number; lockReason: string | null }` (lib/types; `years` newest first)
  - `getStudentDetail(householdId: string, id: string): Promise<StudentDetailData | null>`
  - actions `promoteStudent(input: { id: string } & Enrollment): Promise<ActionResult<null>>`, `updateEnrollment(input: { id: string } & Enrollment): Promise<ActionResult<null>>` (`schoolYear` selects the row)

- [ ] **Step 1: Failing E2E**

In the Task 7 test, replace the three archive lines (edit button, dialog accept, "Lưu trữ học sinh") with:
```ts
  await page.getByTestId("student-card").filter({ hasText: "Gia Huy" }).getByRole("button").first().click()
  await page.waitForURL(/\/parent\/students\/.+/)
  await page.getByRole("button", { name: "Lưu trữ học sinh" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Lưu trữ" }).click()
  await page.waitForURL(/\/parent\/students$/)
```
Append:
```ts
test("promoting keeps stars and adds a school year", async ({ page }) => {
  await open(page, "/parent/students")
  const card = page.getByTestId("student-card").filter({ hasText: "Minh An" })
  const starsBefore = await card.getByTestId("student-stars").textContent()
  await card.getByRole("button").first().click()
  await page.waitForURL(/\/parent\/students\/.+/)
  await expect(page.getByTestId("year-row")).toHaveCount(2)
  await page.getByRole("button", { name: "Lên lớp" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toContainText("Lớp 3")
  await sheet.getByLabel("Tên lớp").fill("4C1")
  await sheet.getByRole("button", { name: /Lên lớp 🎉/ }).click()
  await expect(page.getByTestId("year-row")).toHaveCount(3)
  await expect(page.getByTestId("year-row").first()).toContainText("Lớp 4 · 4C1")
  await open(page, "/parent/students")
  await expect(page.getByTestId("student-card").filter({ hasText: "Minh An" }).getByTestId("student-stars")).toHaveText(starsBefore!)
})
```
(The new year starts next 5 September, so the card keeps today's grade; the test checks the year list.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec playwright test e2e/students.spec.ts -g "promoting" --project=ipad`
Expected: FAIL — detail page 404.

- [ ] **Step 3: Server**

Add `StudentDetailData` to `src/lib/types.ts` (import `Enrollment` type from `./school-year`). `src/server/students.ts`:
```ts
export async function getStudentDetail(householdId: string, id: string): Promise<StudentDetailData | null> {
  if (!isUuid(id)) return null
  const row = await db.query.students.findFirst({ where: and(eq(students.id, id), eq(students.householdId, householdId)) })
  if (!row) return null
  await settleExpiredAttempts()
  const now = new Date()
  const [years, { facts, seen }] = await Promise.all([listEnrollments(row.id), loadRewardFacts(db, { studentId: row.id })])
  const rewards = computeRewards(facts, seen, now)
  const current = currentEnrollment(years, localDay(now))
  return {
    card: await toCard(row, rewards.ledger.balance, now),
    years: [...years].reverse().map((y) => ({ ...y, current: y.schoolYear === current?.schoolYear })),
    streak: rewards.streak.current,
    badges: rewards.badges.filter((b) => b.earnedAt).length,
    lockReason: isLocked(row, now) ? row.lockReason : null,
  }
}
```
(`isUuid` from `@/lib/ids`. `rewards.streak.current` and `badges[].earnedAt` are the fields the seed already logs; confirm in `src/lib/views/rewards.ts`.)

Append to `src/server/actions/students.ts` (import `schoolYearLabel`):
```ts
const enrollmentSchema = z.object({
  schoolYear: z.number().int().min(2000).max(2100),
  grade: z.number().int().min(1).max(12),
  className: z.string().trim().max(20).nullable(),
  startsOn: z.iso.date(),
})

const pgCode = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code

/** "Lên lớp": a new school year for the child. Stars, badges and streak are untouched. */
export async function promoteStudent(input: { id: string } & z.input<typeof enrollmentSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, input.id)
    const data = enrollmentSchema.parse(input)
    try {
      await db.insert(schema.enrollments).values({ studentId: row.id, ...data, className: data.className || null })
    } catch (e) {
      if (pgCode(e) === "23505") throw new Error(`Bé đã có năm học ${schoolYearLabel(data.schoolYear)}.`)
      throw e
    }
    refresh()
    return null
  })
}

export async function updateEnrollment(input: { id: string } & z.input<typeof enrollmentSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, input.id)
    const data = enrollmentSchema.parse(input)
    const [updated] = await db
      .update(schema.enrollments)
      .set({ grade: data.grade, className: data.className || null, startsOn: data.startsOn })
      .where(and(eq(schema.enrollments.studentId, row.id), eq(schema.enrollments.schoolYear, data.schoolYear)))
      .returning({ id: schema.enrollments.id })
    if (!updated) throw new Error("Không tìm thấy năm học.")
    refresh()
    return null
  })
}
```

- [ ] **Step 4: UI**

`src/app/(app)/parent/students/[id]/page.tsx`:
```tsx
import { connection } from "next/server"
import { notFound } from "next/navigation"
import StudentDetail from "@/components/students/StudentDetail"
import { assertAccess } from "@/server/access"
import { getStudentDetail } from "@/server/students"

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const ctx = await assertAccess("parent")
  const detail = await getStudentDetail(ctx.householdId, decodeURIComponent((await params).id))
  if (!detail) notFound()
  return <StudentDetail detail={detail} now={new Date().toISOString()} />
}
```

`src/components/students/PromoteSheet.tsx`:
```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { unwrap } from "@/lib/action-result"
import { celebrate } from "@/lib/animations"
import { schoolYearLabel, type Enrollment } from "@/lib/school-year"
import { promoteStudent } from "@/server/actions/students"

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function PromoteSheet({ studentId, name, from, suggestion, onOpenChange }: {
  studentId: string
  name: string
  from: Enrollment
  suggestion: Enrollment
  onOpenChange: (open: boolean) => void
}) {
  const [grade, setGrade] = useState(suggestion.grade)
  const [className, setClassName] = useState("")
  const [startsOn, setStartsOn] = useState(suggestion.startsOn)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      unwrap(await promoteStudent({ id: studentId, schoolYear: suggestion.schoolYear, grade, className: className || null, startsOn }))
      celebrate("big")
      toast.success(`${name} đã lên lớp ${grade}!`)
      onOpenChange(false)
    } catch (e) {
      toast.error("Chưa lên lớp được", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Lên lớp cho {name}</SheetTitle>
          <SheetDescription>
            Lớp {from.grade} ({schoolYearLabel(from.schoolYear)}) → Lớp {grade} ({schoolYearLabel(suggestion.schoolYear)})
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div>
            <Label>Lớp mới</Label>
            <ToggleGroup type="single" value={String(grade)} onValueChange={(v) => v && setGrade(Number(v))} className="mt-2 flex-wrap justify-start">
              {GRADES.filter((g) => g >= from.grade).map((g) => (
                <ToggleGroupItem key={g} value={String(g)} aria-label={`Lớp ${g}`}>
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="promote-class">Tên lớp</Label>
              <Input id="promote-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder={`${grade}A…`} maxLength={20} />
            </div>
            <div>
              <Label htmlFor="promote-start">Bắt đầu từ</Label>
              <Input id="promote-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
          </div>
          <p className="rounded-2xl bg-indigo-50 p-3 text-sm text-indigo-900">
            Sao, huy hiệu và chuỗi ngày được giữ nguyên. Bài của năm cũ vẫn xem được trong Báo cáo.
          </p>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={busy || !startsOn}>
            {busy && <Loader2 className="animate-spin" />}
            Lên lớp 🎉
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

`src/components/students/EnrollmentSheet.tsx`: same structure as `PromoteSheet` with title `Năm học {schoolYearLabel(year.schoolYear)}`, initial values from `year` (`grade`, `className ?? ""`, `startsOn`), grade toggle over all 12 grades, "Tên lớp" and "Bắt đầu từ" inputs (ids `enrollment-class`, `enrollment-start`), no note, button "Lưu" calling `updateEnrollment({ id: studentId, schoolYear: year.schoolYear, grade, className: className || null, startsOn })` and toasting "Đã lưu". Props `{ studentId: string; year: Enrollment; onOpenChange: (open: boolean) => void }`.

`src/components/students/StudentDetail.tsx`:
```tsx
"use client"

import { useState } from "react"
import { GraduationCap, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { unwrap } from "@/lib/action-result"
import { schoolYearLabel, suggestPromotion, type Enrollment } from "@/lib/school-year"
import type { StudentDetailData } from "@/lib/types"
import { archiveStudent, setViewingStudent } from "@/server/actions/students"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS, parentPaths } from "@/components/layout/routes"
import EnrollmentSheet from "./EnrollmentSheet"
import PromoteSheet from "./PromoteSheet"
import StudentSheet from "./StudentSheet"

const fmtDay = (day: string) => day.split("-").reverse().join("/")

export default function StudentDetail({ detail, now }: { detail: StudentDetailData; now: string }) {
  const { card, years } = detail
  const { navigate } = useAppNavigation()
  const [editing, setEditing] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [yearEdit, setYearEdit] = useState<Enrollment | null>(null)
  const [archiving, setArchiving] = useState(false)
  const latest = years[0]

  const fail = (title: string) => (e: unknown) => toast.error(title, { description: e instanceof Error ? e.message : undefined })

  const viewNow = async () => {
    try {
      unwrap(await setViewingStudent(card.id))
      navigate(TAB_PATHS.dashboard)
    } catch (e) {
      fail("Chưa đổi được học sinh")(e)
    }
  }

  const archive = async () => {
    try {
      unwrap(await archiveStudent(card.id))
      navigate(parentPaths.students)
    } catch (e) {
      fail("Chưa lưu trữ được")(e)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 md:p-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-3xl" aria-hidden>
            {card.avatarEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{card.name}</h1>
            <p className="text-sm text-slate-500">
              ⭐ {card.stars} sao · 🔥 {detail.streak} ngày · 🏅 {detail.badges}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Sửa" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={viewNow}>
            Xem như đang chọn
          </Button>
          {latest && (
            <Button onClick={() => setPromoting(true)}>
              <GraduationCap /> Lên lớp
            </Button>
          )}
          {/* Task 9: lock / unlock button goes here. */}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Các năm học</h2>
        <div className="flex flex-col divide-y rounded-2xl border border-slate-200 bg-white">
          {years.map((y) => (
            <div key={y.schoolYear} data-testid="year-row" className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">
                  {schoolYearLabel(y.schoolYear)} · Lớp {y.grade}
                  {y.className ? ` · ${y.className}` : ""}
                </div>
                <div className="text-xs text-slate-500">từ {fmtDay(y.startsOn)}</div>
              </div>
              {y.current && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Hiện tại</span>}
              <Button variant="ghost" size="icon" aria-label={`Sửa năm ${schoolYearLabel(y.schoolYear)}`} onClick={() => setYearEdit(y)}>
                <Pencil />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Button variant="ghost" className="self-start text-red-600" onClick={() => setArchiving(true)}>
        Lưu trữ học sinh
      </Button>

      {editing && <StudentSheet open onOpenChange={setEditing} editing={card} now={now} />}
      {promoting && latest && (
        <PromoteSheet studentId={card.id} name={card.name} from={latest} suggestion={suggestPromotion(latest)} onOpenChange={setPromoting} />
      )}
      {yearEdit && <EnrollmentSheet studentId={card.id} year={yearEdit} onOpenChange={(o) => !o && setYearEdit(null)} />}
      <Dialog open={archiving} onOpenChange={setArchiving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lưu trữ {card.name}?</DialogTitle>
            <DialogDescription>Bé sẽ không còn trong danh sách chọn; dữ liệu vẫn được giữ.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(false)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={archive}>
              Lưu trữ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```
`latest` is the newest enrollment, so "Lên lớp" always continues from the last year even if it hasn't started yet; promoting twice for the same year hits the unique index and shows "Bé đã có năm học …".

Remove the archive button and `archive` handler from `StudentSheet` (the footer's left slot becomes `<span />` in both modes).

- [ ] **Step 5: Verify**

```bash
pnpm exec playwright test e2e/students.spec.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add -A src e2e
git commit -m "Child detail with school years and promotion"
```

---

### Task 9: Lock a child

**Files:**
- Create: `src/components/students/LockSheet.tsx`, `src/components/layout/LockScreen.tsx`
- Modify: `src/server/actions/students.ts`, `src/server/actions/attempts.ts`, `src/components/students/StudentDetail.tsx`, `src/app/(app)/layout.tsx`, `e2e/students.spec.ts`

**Interfaces:**
- Consumes: `lockUntil`, `LockChoice` (Task 1); `Context.locked`, `getContext` (Task 4); `StudentDetailData.lockReason`, `ownStudent` (Tasks 7–8); `HoldToOpen` (Task 6).
- Produces: actions `lockStudent(input: { id: string; choice: LockChoice; reason?: string }): Promise<ActionResult<null>>`, `unlockStudent(id: string): Promise<ActionResult<null>>`; `LockScreen` props `{ avatarEmoji: string; name: string; reason: string | null; until: string | null }`.

- [ ] **Step 1: Failing E2E**

Append to `e2e/students.spec.ts`:
```ts
test("a locked child sees the lock screen until unlocked", async ({ browser }, testInfo) => {
  // Two devices: separate cookie jars.
  const parentCtx = await browser.newContext(testInfo.project.use)
  const childCtx = await browser.newContext(testInfo.project.use)
  const p = await parentCtx.newPage()
  const c = await childCtx.newPage()
  try {
    await open(c, "/student")
    await open(p, "/parent/students")
    await p.getByTestId("student-card").filter({ hasText: "Minh An" }).getByRole("button").first().click()
    await p.getByRole("button", { name: "Khoá tài khoản" }).click()
    const sheet = p.getByRole("dialog")
    await sheet.getByRole("radio", { name: "Đến khi mở" }).click()
    await sheet.getByLabel("Lời nhắn").fill("Nghỉ ngơi chút nhé")
    await sheet.getByRole("button", { name: "Khoá", exact: true }).click()
    await expect(p.getByRole("button", { name: "Mở khoá" })).toBeVisible()

    await c.reload()
    await expect(c.getByText("Tài khoản đang tạm khoá")).toBeVisible()
    await expect(c.getByText("Nghỉ ngơi chút nhé")).toBeVisible()

    await p.getByRole("button", { name: "Mở khoá" }).click()
    await expect(p.getByRole("button", { name: "Khoá tài khoản" })).toBeVisible()
    await c.reload()
    await expect(c.locator("html")).toHaveAttribute("data-mode", "student")
    await expect(c.getByText("Tài khoản đang tạm khoá")).toHaveCount(0)
  } finally {
    await parentCtx.close()
    await childCtx.close()
  }
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec playwright test e2e/students.spec.ts -g "locked" --project=ipad`
Expected: FAIL — no "Khoá tài khoản" button.

- [ ] **Step 3: Actions**

Append to `src/server/actions/students.ts` (import `lockUntil` from `@/lib/student-lock`):
```ts
const lockSchema = z.object({
  id: z.uuid(),
  choice: z.union([z.enum(["1h", "today", "manual"]), z.object({ at: z.iso.datetime({ offset: true }) })]),
  reason: z.string().trim().max(120).optional(),
})

/** Blocks the child's device until the chosen time (or until unlocked). Assigning and grading go on. */
export async function lockStudent(input: z.input<typeof lockSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const data = lockSchema.parse(input)
    const row = await ownStudent(ctx.householdId, data.id)
    const now = new Date()
    await db
      .update(schema.students)
      .set({ lockedAt: now, lockedUntil: lockUntil(data.choice, now), lockReason: data.reason || null })
      .where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}

export async function unlockStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    const row = await ownStudent(ctx.householdId, id)
    await db.update(schema.students).set({ lockedAt: null, lockedUntil: null, lockReason: null }).where(eq(schema.students.id, row.id))
    refresh()
    return null
  })
}
```
`assertAccess("student")` already refuses locked children (Task 4). In `src/server/actions/attempts.ts`, the `Result`-returning actions (`startAttempt`, `saveDraft`, `submitAttempt`, `submitPaper`) call `await assertAccess("student")` outside any try; add a helper and use it in all four so the lock message reaches the take page as a normal error:
```ts
/** Access check for the Result-returning actions: a refusal (PIN, lock) becomes an error result. */
async function studentGate(): Promise<{ ok: false; error: string } | null> {
  try {
    await assertAccess("student")
    return null
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Cần mã PIN để tiếp tục." }
  }
}
```
(`const denied = await studentGate(); if (denied) return denied` as the first line.)

- [ ] **Step 4: Lock screen in the layout**

`src/app/(app)/layout.tsx`, before loading anything else:
```tsx
  const ctx = await getContext()
  if (ctx.mode === "student" && ctx.locked) {
    const row = (await db.query.students.findFirst({ where: eq(schema.students.id, ctx.studentId!) }))!
    return <LockScreen avatarEmoji={row.avatarEmoji} name={row.name} reason={row.lockReason} until={row.lockedUntil?.toISOString() ?? null} />
  }
```
(Move the `getContext()` call from Task 6 up so it runs once.)

`src/components/layout/LockScreen.tsx`:
```tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import HoldToOpen from "./HoldToOpen"

/** The child's device while they are locked; re-checks every minute and on focus. */
export default function LockScreen({ avatarEmoji, name, reason, until }: { avatarEmoji: string; name: string; reason: string | null; until: string | null }) {
  const router = useRouter()
  useEffect(() => {
    document.documentElement.dataset.mode = "locked"
    const check = () => router.refresh()
    const timer = window.setInterval(check, 60_000)
    window.addEventListener("focus", check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
    }
  }, [router])
  return (
    <main className="grid min-h-dvh place-items-center bg-indigo-50/60 p-6">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg shadow-indigo-600/10">
        <HoldToOpen onOpen={() => window.location.assign("/parent")} className="mx-auto w-fit">
          <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-4xl" aria-hidden>
            {avatarEmoji}
          </span>
        </HoldToOpen>
        <div className="mt-4 text-3xl" aria-hidden>🔒</div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Tài khoản đang tạm khoá</h1>
        {reason && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-amber-900">“{reason}”</p>}
        <p className="mt-3 text-slate-500">
          {until
            ? `Mở lại lúc ${new Date(until).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
            : `Hỏi bố mẹ để mở khoá nhé, ${name}.`}
        </p>
        <a href="/pin?role=student" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Đổi học sinh
        </a>
      </div>
    </main>
  )
}
```
`router.refresh()` re-runs the layout; once unlocked it renders `AppFrame` again (which sets `data-mode="student"`), so no PIN is needed.

- [ ] **Step 5: Lock UI on the detail page**

`src/components/students/LockSheet.tsx`:
```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { unwrap } from "@/lib/action-result"
import type { LockChoice } from "@/lib/student-lock"
import { lockStudent } from "@/server/actions/students"

type Option = "1h" | "today" | "manual" | "at"

export default function LockSheet({ studentId, name, onOpenChange }: { studentId: string; name: string; onOpenChange: (open: boolean) => void }) {
  const [option, setOption] = useState<Option>("manual")
  const [at, setAt] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const choice: LockChoice = option === "at" ? { at: new Date(at).toISOString() } : option
      unwrap(await lockStudent({ id: studentId, choice, reason: reason || undefined }))
      toast.success(`Đã khoá tài khoản ${name}`)
      onOpenChange(false)
    } catch (e) {
      toast.error("Chưa khoá được", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Khoá tài khoản {name}</SheetTitle>
          <SheetDescription>Bé vẫn được giao bài; bài có giờ đang làm vẫn tính giờ và tự nộp khi hết giờ.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div>
            <Label>Khoá trong</Label>
            <ToggleGroup type="single" value={option} onValueChange={(v) => v && setOption(v as Option)} className="mt-2 flex-wrap justify-start">
              <ToggleGroupItem value="1h">1 giờ</ToggleGroupItem>
              <ToggleGroupItem value="today">Đến hết hôm nay</ToggleGroupItem>
              <ToggleGroupItem value="manual">Đến khi mở</ToggleGroupItem>
              <ToggleGroupItem value="at">Chọn giờ…</ToggleGroupItem>
            </ToggleGroup>
            {option === "at" && <Input className="mt-2" type="datetime-local" aria-label="Mở khoá lúc" value={at} onChange={(e) => setAt(e.target.value)} />}
          </div>
          <div>
            <Label htmlFor="lock-reason">Lời nhắn</Label>
            <Input id="lock-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Không bắt buộc" maxLength={120} />
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={busy || (option === "at" && !at)}>
            {busy && <Loader2 className="animate-spin" />}
            Khoá
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

`StudentDetail.tsx`: replace the Task 9 placeholder comment with
```tsx
          {card.locked ? (
            <Button variant="outline" onClick={unlock}>
              🔓 Mở khoá
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setLocking(true)}>
              🔒 Khoá tài khoản
            </Button>
          )}
```
with `const [locking, setLocking] = useState(false)`, `const unlock = async () => { try { unwrap(await unlockStudent(card.id)) } catch (e) { fail("Chưa mở khoá được")(e) } }`, `{locking && <LockSheet studentId={card.id} name={card.name} onOpenChange={setLocking} />}`, and when `card.locked` a line under the stats: `🔒 {card.lockedUntil ? \`Khoá đến ${hh:mm}\` : "Khoá đến khi mở"}{detail.lockReason ? \` · “${detail.lockReason}”\` : ""}` (format the time with `toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })`). The E2E finds the buttons by name "Khoá tài khoản" / "Mở khoá", which match these labels with the emoji prefix because Playwright's name match is substring by default.

- [ ] **Step 6: Verify**

```bash
pnpm exec playwright test e2e/students.spec.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```
Manual: as Minh An start a timed assignment, lock Minh An "1 giờ" from another browser, wait past the time limit, unlock → the attempt appears handed in ("Hết giờ – tự nộp" on the grading page).

- [ ] **Step 7: Commit**

```bash
git add -A src e2e
git commit -m "Lock a child temporarily with a message"
```

---

### Task 10: Assign to several children; library defaults to the viewing child's grade

**Files:**
- Modify: `src/server/actions/library.ts`, `src/state/library-store.tsx`, `src/components/schedule/AssignSheet.tsx`, `src/components/pages/ExerciseLibrary.tsx`, `e2e/students.spec.ts`

**Interfaces:**
- Consumes: `useHousehold()`, `useRequiredStudent()` (Tasks 6–7); `assertSetInHousehold` (Task 5); `listHouseholdStudents` (Task 4); `Context`.
- Produces: `createAssignments(items: NewAssignment[], studentIds?: string[]): Promise<ActionResult<{ created: Assignment[]; total: number }>>` — `created` = only the viewing child's new rows (what the client store shows), `total` = all inserted rows; `library.addAssignments(items: NewAssignment[], studentIds?: string[]): Promise<{ created: Assignment[]; total: number }>`.

- [ ] **Step 1: Failing E2E**

Append to `e2e/students.spec.ts`:
```ts
test("one set assigned to both children reaches both", async ({ page }) => {
  await open(page, "/parent/schedule")
  await page.getByRole("button", { name: /^Giao bài( mới)?$/ }).filter({ visible: true }).first().click()
  const sheet = page.getByRole("dialog", { name: "Giao bài mới" })
  await sheet.getByLabel("Tìm bộ bài tập").fill("Unit 5")
  await sheet.getByRole("radio", { name: /Unit 5: My family/ }).click()
  await sheet.getByRole("checkbox", { name: "Bảo Ngọc" }).check()
  await sheet.getByRole("button", { name: "Giao bài", exact: true }).click()
  await expect(page.getByText(/cho Minh An, Bảo Ngọc/)).toBeVisible()

  await page.goto("/pin?role=student")
  await page.getByRole("button", { name: "Bảo Ngọc" }).click()
  await open(page, "/student/assignments", "Bảo Ngọc")
  await expect(page.getByText("Unit 5: My family").first()).toBeVisible()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec playwright test e2e/students.spec.ts -g "both children" --project=ipad`
Expected: FAIL — no child checkboxes.

- [ ] **Step 3: Server**

In `library.ts` (imports: `listHouseholdStudents` from `../students`, `type Context` from `../access`):
```ts
async function insertAssignments(ctx: Context, items: NewAssignment[], studentIds: string[]): Promise<{ created: Assignment[]; total: number }> {
  const parsed = z.array(newAssignmentSchema).min(1).max(14).parse(items)
  const ids = z.array(z.uuid()).min(1).max(20).parse(studentIds)
  const children = new Set((await listHouseholdStudents(ctx.householdId)).map((c) => c.id))
  if (ids.some((id) => !children.has(id))) throw new Error("Không tìm thấy học sinh.")
  for (const item of parsed) {
    await assertSetInHousehold(ctx, item.setId)
    if (new Date(item.dueAt) <= new Date(item.availableFrom)) throw new Error("Hạn nộp phải sau thời điểm giao bài")
    const n = await db.$count(questions, eq(questions.setId, item.setId))
    if (n === 0) throw new Error("Hãy chọn bộ bài có ít nhất một câu hỏi.")
  }
  const rows = await db
    .insert(assignments)
    .values(
      ids.flatMap((studentId) =>
        parsed.map((i) => ({
          studentId,
          setId: i.setId,
          availableFrom: new Date(i.availableFrom),
          dueAt: new Date(i.dueAt),
          mode: i.mode,
          maxAttempts: i.maxAttempts,
          timeLimitMinutes: limitFor(i),
          parentNote: i.note?.trim() || null,
        })),
      ),
    )
    .returning()
  refresh()
  const created: Assignment[] = rows
    .filter((r) => r.studentId === ctx.studentId)
    .map((r) => ({
      id: r.id,
      exerciseSetId: r.setId,
      assignedDate: r.availableFrom.toISOString(),
      dueDate: r.dueAt.toISOString(),
      status: "chua-lam",
      parentNote: r.parentNote ?? undefined,
      mode: r.mode,
      maxAttempts: r.maxAttempts as 1 | 2,
      timeLimitMinutes: r.timeLimitMinutes ?? undefined,
      attemptCount: 0,
    }))
  return { created, total: rows.length }
}

export async function createAssignments(items: NewAssignment[], studentIds?: string[]): Promise<ActionResult<{ created: Assignment[]; total: number }>> {
  return runAction(async () => {
    const ctx = await assertAccess("parent")
    if (!ctx.studentId) throw new Error("Chưa có học sinh nào.")
    return insertAssignments(ctx, items, studentIds?.length ? studentIds : [ctx.studentId])
  })
}

/** "Giao bài" shortcut on a library card: available now, due tomorrow 20:00, for the viewing child. */
export async function quickAssign(setId: string): Promise<ActionResult<Assignment>> {
  return runAction(async () => {
    const due = new Date()
    due.setDate(due.getDate() + 1)
    due.setHours(20, 0, 0, 0)
    const ctx = await assertAccess("parent")
    if (!ctx.studentId) throw new Error("Chưa có học sinh nào.")
    const { created } = await insertAssignments(
      ctx,
      [{ setId, availableFrom: new Date().toISOString(), dueAt: due.toISOString(), mode: "web", maxAttempts: 2 }],
      [ctx.studentId],
    )
    return created[0]
  })
}
```

- [ ] **Step 4: Client**

`library-store.tsx`:
```ts
  const addAssignments = useCallback(async (items: NewAssignment[], studentIds?: string[]) => {
    const { created, total } = unwrap(await createAssignments(items, studentIds))
    setAssignments((prev) => [...prev, ...created])
    const perItem = total / items.length
    setSets((prev) =>
      prev.map((s) => ({ ...s, timesAssigned: s.timesAssigned + items.filter((i) => i.setId === s.id).length * perItem })),
    )
    return { created, total }
  }, [])
```
Update the context type and every caller (`rg "addAssignments" src`).

`AssignSheet.tsx`:
```tsx
  const household = useHousehold()
  const [targets, setTargets] = useState<string[]>([student.id])
  const toggleTarget = (id: string) =>
    setTargets((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((t) => t !== id) : cur) : [...cur, id]))
```
Render, when `household.length > 1`, a "Giao cho" section above the schedule controls:
```tsx
<div>
  <Label>Giao cho</Label>
  <div className="mt-2 flex flex-wrap gap-2">
    {household.map((c) => (
      <label key={c.id} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm", targets.includes(c.id) ? "border-indigo-500 bg-indigo-50" : "border-slate-200")}>
        <input type="checkbox" className="sr-only" aria-label={c.name} checked={targets.includes(c.id)} onChange={() => toggleTarget(c.id)} />
        <span aria-hidden>{c.avatarEmoji}</span> {c.name}
      </label>
    ))}
  </div>
</div>
```
In `save`: `const { created, total } = await library.addAssignments(items, targets)`; `const names = household.filter((c) => targets.includes(c.id)).map((c) => c.name)`; toast `\`Đã giao ${total} bài cho ${(names.length ? names : [student.name]).join(", ")}\``; `onCreated(new Date(created[0]?.assignedDate ?? items[0].availableFrom))`. (Existing E2E match `/^Đã giao 1 bài/`, which still holds for one child.)

`ExerciseLibrary.tsx`: find the grade filter's initial state (`rg "grade" src/components/pages/ExerciseLibrary.tsx`) and default it to `useRequiredStudent().grade`, falling back to the current default ("all") when no set has that grade.

- [ ] **Step 5: Verify**

```bash
pnpm exec playwright test e2e/students.spec.ts e2e/schedule-edit.spec.ts e2e/timed.spec.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add -A src e2e
git commit -m "Assign a set to several children; library defaults to the child's grade"
```

---

### Task 11: Reports — school-year chips

**Files:**
- Create: `src/lib/report-years.ts`, `src/lib/report-years.test.ts`
- Modify: `src/app/(app)/parent/reports/page.tsx`, `src/components/pages/Reports.tsx`, `e2e/students.spec.ts`

**Interfaces:**
- Consumes: `Enrollment`, `yearRange`, `schoolYearLabel` (Task 1); `listEnrollments` (Task 4); `getViewingStudent` (Task 4).
- Produces: `yearCustomRange(list: Enrollment[], schoolYear: number, today: string): { from: string; to: string } | null` — inclusive; `to` = the day before the next year's start, or `today` for the latest year, never after today.

- [ ] **Step 1: Failing unit test**

`src/lib/report-years.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { yearCustomRange } from "./report-years"

const years = [
  { schoolYear: 2025, grade: 2, className: null, startsOn: "2025-09-05" },
  { schoolYear: 2026, grade: 3, className: null, startsOn: "2026-09-05" },
]

describe("report year ranges", () => {
  it("covers a past year up to the day before the next start", () => {
    expect(yearCustomRange(years, 2025, "2026-10-15")).toEqual({ from: "2025-09-05", to: "2026-09-04" })
  })
  it("ends the current year today", () => {
    expect(yearCustomRange(years, 2026, "2026-10-15")).toEqual({ from: "2026-09-05", to: "2026-10-15" })
  })
  it("returns null for an unknown year", () => {
    expect(yearCustomRange(years, 2020, "2026-10-15")).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/report-years.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/report-years.ts`:
```ts
import { localDay } from "./dates"
import { yearRange, type Enrollment } from "./school-year"

function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  return localDay(new Date(y, m - 1, d - 1))
}

/** A school year as the Reports page's inclusive custom range (never past today). */
export function yearCustomRange(list: Enrollment[], schoolYear: number, today: string): { from: string; to: string } | null {
  const range = yearRange(list, schoolYear)
  if (!range) return null
  const end = range.to ? dayBefore(range.to) : today
  return { from: range.from, to: end < today ? end : today }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/report-years.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire Reports**

`reports/page.tsx`:
```tsx
export default async function ReportsPage() {
  await connection()
  const now = new Date()
  const student = await getViewingStudent()
  const [input, years] = await Promise.all([loadReportInput(), student ? listEnrollments(student.id) : Promise.resolve([])])
  return <Reports input={input} years={years} now={now.toISOString()} />
}
```
`Reports.tsx`: prop `years: Enrollment[]`. Below the range `ToggleGroup`, when `years.length > 1`:
```tsx
const today = dateInput(now)
const yearChips = [...years].reverse().map((y) => ({ year: y.schoolYear, range: yearCustomRange(years, y.schoolYear, today)! }))
const pickYear = (r: { from: string; to: string }) => {
  setRange("custom")
  setFrom(r.from)
  setTo(r.to)
}
// …
<div className="flex flex-wrap items-center gap-2">
  <span className="text-sm font-medium text-slate-500">Năm học</span>
  {yearChips.map(({ year, range: r }) => {
    const selected = range === "custom" && from === r.from && to === r.to
    return (
      <button key={year} type="button" aria-pressed={selected} onClick={() => pickYear(r)}
        className={cn("rounded-full border px-3 py-1 text-sm", selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")}>
        {schoolYearLabel(year)}
      </button>
    )
  })}
</div>
```
Nothing else changes: `rangePeriod("custom", …)` and `summarizeProgress({ rangeId: "custom", custom })` already handle the dates.

E2E (append to `e2e/students.spec.ts`):
```ts
test("reports can show last school year", async ({ page }) => {
  await open(page, "/parent/reports")
  const chips = page.getByRole("button", { name: /^\d{4}–\d{4}$/ })
  await expect(chips).toHaveCount(2)
  const lastYear = chips.last()
  await lastYear.click()
  await expect(lastYear).toHaveAttribute("aria-pressed", "true")
})
```
Also assert the custom-range "from" input now ends in `-09-05`: find its label in `Reports.tsx` (the date inputs next to the custom range) and add `await expect(page.getByLabel("<that label>")).toHaveValue(/-09-05$/)`.

- [ ] **Step 6: Verify**

```bash
pnpm exec playwright test e2e/students.spec.ts -g "reports"
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 7: Commit**

```bash
git add -A src e2e
git commit -m "Reports: school-year chips"
```

---

### Task 12: Docs and final verification

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-15-students-school-years-design.md` (status line)

- [ ] **Step 1: Update CLAUDE.md**

- "What this is": "…a parent (or tutor) uses to assign, grade and track homework for primary-school children — one household, each child on their own device…"; PINs: "`PARENT_PIN` opens Parent mode; each child's PIN is set on the Students page (`/parent/students`)".
- Env vars: add `SESSION_SECRET`.
- Routing: the layout loads the viewing child (`getViewingStudent`) and, in parent mode, the household's children for `ParentMenu`; mode switching is the hold-to-open avatar (student) and the parent header menu; `parentPaths.students` / `parentPaths.student(id)`.
- Replace the PIN-gate bullet: signed `hh_pin` token (`lib/session-token.ts`) naming role/household/child; the proxy verifies it and sets `x-hh-mode`; `getContext()` / `assertAccess()` (`server/access.ts`) return the context every query and action scopes by; ownership helpers in `server/ownership.ts`; any new reader or action must scope through them.
- New bullets: school years (`enrollments`, `lib/school-year.ts`, an assignment's year derived from its due date, manual "Lên lớp", stars/badges/streak carry over, Reports year chips fill the custom range); lock (`lib/student-lock.ts`, refused in `assertAccess("student")`, lock screen rendered by the layout, timed attempts keep running).
- Rewards bullet: computed per child (`student_id` on redemptions/adjustments/badge_seen); `requestRedemption` locks per child.
- Remove `loadGradingQueue` from the list of attempt readers (it doesn't exist).
- Gotchas: "Changing the token format logs every device out; set `SESSION_SECRET` in Vercel before deploying."

- [ ] **Step 2: Full verification**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:e2e
```
Expected: all green. Record the unit and E2E counts for the PR description.

- [ ] **Step 3: Mark the spec implemented and commit**

Change the spec's status line to `Status: implemented (plan docs/superpowers/plans/2026-10-15-students-school-years.md)`.
```bash
git add CLAUDE.md docs
git commit -m "Docs: multiple students, school years, lock"
```

- [ ] **Step 4: Deploy notes for the PR description**

Set `SESSION_SECRET` in Vercel (Production + Preview) before deploying; run `pnpm db:migrate` against production (transaction pooler URL) when the build is ready; every device re-enters its PIN once; open `/parent/students` right away and set each child's PIN (until then children open without one).
