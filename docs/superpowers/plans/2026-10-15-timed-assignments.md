# Timed Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parents can give web assignments a time limit (exam mode with countdown, warnings and auto-submit); untimed work records real active time.

**Architecture:** `assignments.timeLimitMinutes` + pure timer math in `src/lib/timer.ts`. The server is the source of truth: the deadline is `attempts.startedAt + limit`, actions refuse late writes, and `settleExpiredAttempts()` (request-memoized) hands in expired drafts before any read of attempts. The take screen gets a `timer` prop (countdown or stopwatch) rendered by a new `CountdownClock` (NumberFlow digits + motion ring).

**Tech Stack:** Next 16 App Router, Drizzle/pg, zod, motion, sonner, `@number-flow/react` (new), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-timed-assignments-design.md`

## Global Constraints

- Limit range 1–240 minutes; null = untimed; web only (paper forces null); locked once any attempt exists.
- Warning thresholds: warn ≤ min(300 s, 20 % of limit), urgent ≤ 60 s, final ≤ 10 s.
- Submit grace: 30 s after the deadline.
- Auto-handed-in attempts: `submittedAt = deadline`, `durationSeconds = limit * 60`.
- Untimed duration: max(stored, clamp(reported, 0, 6 h)).
- All UI copy Vietnamese. Actions keep `assertAccess("student" | "parent")` first.
- Deviation from spec §3 "Lazy finalization": layout and page render in parallel, so instead of calling finalize from the layout, `settleExpiredAttempts()` (wrapped in React `cache`) is awaited inside the attempt readers: `listAssignments`, `getAttemptDetail`, `getNavCounts`, `listGradedAnswers` (queries.ts), `loadRewards` (server/rewards.ts), `loadGradingQueue` (grading/data.ts).

## Review Focus

1. Child's iPad clock is wrong by minutes → countdown must use the server offset, not `Date.now()` alone.
2. Tab asleep past the deadline, then woken → the clock must jump to 0 and auto-submit once, not tick down from where it froze.
3. Auto-submit request fails (offline) → overlay keeps retrying; server still settles the attempt; no double submit (update guarded by `submittedAt is null`).
4. Late autosave arriving after the attempt was settled → must not rewrite answers (existing `FOR UPDATE … submittedAt IS NULL` guard plus the expiry check).
5. Parent edits an untimed assignment to timed after the child started → rejected by `updateAssignment`.

---

### Task 1: Timer math (`src/lib/timer.ts`)

**Files:** Create `src/lib/timer.ts`, `src/lib/timer.test.ts`

**Produces:**
```ts
export const SUBMIT_GRACE_SECONDS = 30
export const MAX_ACTIVE_SECONDS = 6 * 3600
export type WarningLevel = "none" | "warn" | "urgent" | "final"
export function deadlineOf(startedAt: Date, limitMinutes: number): Date
export function remainingSeconds(deadline: Date, now: Date): number
export function warningLevel(remaining: number, limitSeconds: number): WarningLevel
export function timedDuration(startedAt: Date, limitMinutes: number, now: Date): number
export function mergeActiveSeconds(stored: number | null, reported: unknown): number
export function isExpired(startedAt: Date, limitMinutes: number, now: Date): boolean
export function clockLabel(seconds: number): string  // "mm:ss", or "h:mm:ss" ≥ 1 h
```

- [ ] Write tests: deadline adds minutes; remaining floors at 0 and rounds up partial seconds (`Math.ceil`); warning levels for 20-min limit (301→none, 300→warn, 60→urgent, 10→final, 0→final) and 10-min limit (warn at 120); timedDuration caps at limit and never negative; merge keeps max, clamps, ignores NaN/non-number (returns stored ?? 0); isExpired false at deadline+30 s, true at +31 s; clockLabel 0→"00:00", 754→"12:34", 3725→"1:02:05".
- [ ] Run `pnpm test src/lib/timer.test.ts` → FAIL. Implement. Run → PASS. Commit.

### Task 2: Data + assigning (schema, actions, sheets, chip)

**Files:** Modify `src/db/schema.ts`, `src/server/queries.ts` (AssignmentRecord + listAssignments), `src/lib/types.ts` (Assignment), `src/server/views.ts` (toAssignment), `src/server/actions/library.ts`, `src/lib/schedule.ts`, `src/components/schedule/AssignSheet.tsx`, `src/components/schedule/EditAssignmentSheet.tsx`, `src/lib/views/student.ts` (ItemBase.timeLimit), `StudentToday.tsx`, `StudentAssignments.tsx`, `src/components/pages/Schedule.tsx`; create `src/components/schedule/TimeLimitField.tsx`; migration in `drizzle/`.

**Produces:** `AssignmentRecord.timeLimitMinutes: number | null`; `Assignment.timeLimitMinutes?: number`; `NewAssignment.timeLimitMinutes?: number | null`; `ScheduleDraft.timeLimitMinutes: number | null`; `ItemBase.timeLimit?: number`.

- [ ] schema: `timeLimitMinutes: smallint("time_limit_minutes")` + `check("time_limit_range", sql\`${t.timeLimitMinutes} is null or ${t.timeLimitMinutes} between 1 and 240\`)`. `pnpm db:generate`, review SQL, `pnpm db:migrate`.
- [ ] library.ts: `timeLimitMinutes: z.number().int().min(1).max(240).nullable().optional()` in `newAssignmentSchema`; `limitFor(i) = i.mode === "web" ? (i.timeLimitMinutes ?? null) : null`; insert/update use it; `updateAssignment` throws "Con đã bắt đầu làm nên không đổi được giới hạn thời gian." when `started > 0 && limitFor(c) !== current.timeLimitMinutes`. Returned Assignment includes `timeLimitMinutes: r.timeLimitMinutes ?? undefined`.
- [ ] `TimeLimitField({ value, onChange, disabled, suggested })`: Switch "Giới hạn thời gian" + chips 10/15/20/30/45/60 + number Input (1–240) + hint "Hết giờ bài tự nộp, như đi thi." Turning on sets `suggested` (set's `estimatedMinutes` clamped to 1–240, else 20).
- [ ] AssignSheet/EditAssignmentSheet: render field when mode is web; pass value in items / editAssignment; edit sheet disables when `started > 0` and the amber note mentions the time limit.
- [ ] Student chip: `ItemBase.timeLimit = record.timeLimitMinutes ?? undefined`; cards show `⏱ {n} phút` amber badge instead of "khoảng N phút" when timed. Schedule calendar card shows the same small chip.
- [ ] Unit test asserting `timeLimit` passes through `buildToday`. `pnpm typecheck && pnpm test`. Commit.

### Task 3: Server enforcement + settling

**Files:** Create `src/server/attempt-finalize.ts`; modify `src/server/actions/attempts.ts`, `src/server/queries.ts`, `src/server/rewards.ts`, `src/app/(app)/parent/grading/data.ts`.

**Consumes:** Task 1 helpers. **Produces:**
```ts
// attempt-finalize.ts (server-only; imports db/schema/grading only — not queries.ts, to avoid a cycle)
export async function closeAttempt(input: { attemptId: string; questions: Question[]; responses: Record<string, Response>; submittedAt: Date; durationSeconds: number | null }): Promise<{ closed: boolean; graded: boolean; score: number | null }>
export async function settleAttempt(a: { id: string; setId: string; startedAt: Date; timeLimitMinutes: number }): Promise<void>
export const settleExpiredAttempts: () => Promise<void>   // React cache()
// actions/attempts.ts
export async function startAttempt(assignmentId: string): Promise<Result<{ deadline: string; serverNow: string }>>
saveDraft(assignmentId, responses, activeSeconds?: number): Promise<Result<{ attemptId: string }>> // error variant may carry expired: true
submitAttempt(...)                                                     // error variant may carry expired: true
```

- [ ] Move the transaction body of `submitAttempt` into `closeAttempt` (grades with `gradeAttempt`, sets submittedAt/duration/grade fields guarded by `submittedAt is null`, rewrites answers). `submitAttempt` calls it.
- [ ] `settleAttempt`: load questions by setId ordered by position, stored responses of the attempt, `closeAttempt` with `submittedAt = deadlineOf(...)`, `durationSeconds = limit*60`.
- [ ] `settleExpiredAttempts = cache(async () => …)`: one select of open attempts joined with assignments where `time_limit_minutes is not null and started_at + time_limit_minutes * interval '1 minute' + interval '30 seconds' < now()`; settle each sequentially.
- [ ] Await it at the top of `listAssignments`, `getAttemptDetail`, `getNavCounts`, `listGradedAnswers`, `loadRewards`, `loadGradingQueue`.
- [ ] attempts.ts: `openAttempt` — if latest open draft is timed and `isExpired`, `settleAttempt` and return null. New `startAttempt` (student): load, openAttempt, re-read startedAt, return deadline ISO + serverNow; untimed → error. `saveDraft`: if timed and expired → settle, return `{ ok:false, error:"Đã hết giờ làm bài.", expired:true }`; untimed → inside the transaction `durationSeconds = mergeActiveSeconds(row.durationSeconds, activeSeconds)`. `submitAttempt`: timed → if expired settle + expired error, else duration = `timedDuration`; untimed → `mergeActiveSeconds(stored, client)`.
- [ ] `pnpm typecheck && pnpm test`. Commit.

### Task 4: Clock UI + sounds

**Files:** `pnpm add @number-flow/react`; create `src/components/take/CountdownClock.tsx`; modify `src/hooks/useSound.ts`.

**Produces:**
```tsx
<CountdownClock deadline={Date} offsetMs={number} limitSeconds={number} onExpire={() => void} />
<StopwatchClock seconds={number} hidden={boolean} onToggle={() => void} />
```
- [ ] Sounds: add `"warn" | "urgent" | "tick"` to SoundName; synths: warn = two soft triangle chimes (880, 1175); urgent = three quick 988 Hz beeps; tick = 30 ms 1500 Hz triangle at low gain.
- [ ] CountdownClock: 250 ms interval computing `remainingSeconds(deadline, new Date(Date.now() + offsetMs))`; level via `warningLevel`; on level increase play the level's sound + toast (warn: "Còn N phút nữa!", urgent: "Còn 1 phút! Em kiểm tra lại bài nhé."), only for the current level when resuming; final plays `tick` per new second; calls `onExpire` once at 0. Renders an SVG progress ring (`motion.circle` `pathLength`), colour emerald/amber/red, `NumberFlow` digits, shake on warn, red pulse on urgent, scale on final. Accessible label "Còn mm:ss".
- [ ] StopwatchClock: current button with NumberFlow digits.
- [ ] `pnpm typecheck && pnpm lint`. Commit.

### Task 5: Take flow (start card, countdown, time up, active stopwatch)

**Files:** modify `src/app/(app)/student/assignments/[id]/do/page.tsx`, `src/components/take/TakeRoute.tsx`, `src/components/take/TakeAssignment.tsx`; create `src/components/take/StartTimed.tsx`.

**Produces:** `type TakeTimer = { kind: "countdown"; deadline: string; serverNow: string; limitMinutes: number } | { kind: "stopwatch"; initialSeconds: number }`.

- [ ] page.tsx: open draft & timed → countdown from `deadlineOf(latest.startedAt, limit)` + server now; timed without open draft → TakeRoute shows `StartTimed` first; untimed → stopwatch with `latest.durationSeconds ?? 0` when a draft exists.
- [ ] StartTimed: big ⏱, "Bài này có N phút", "Hết giờ bài sẽ tự nộp. Em chuẩn bị sẵn sàng rồi bấm Bắt đầu nhé!", questions count, buttons "Để sau" / "Bắt đầu" (calls `startAttempt`). On success sets the countdown timer.
- [ ] TakeAssignment: prop `timer: TakeTimer`; stopwatch counts only while visible; `onSave(answers, activeSeconds)`; countdown renders CountdownClock; `onExpire` → overlay "Hết giờ! ⏰" then the submit path without confirmation; on failure retry every 3 s up to 5 times, then leave anyway (server settles). Stopwatch seconds mark the draft dirty when hidden so time saves even without answer changes.
- [ ] TakeRoute: pass `activeSeconds` to `saveDraft`; on `expired` from save/submit → toast "Đã hết giờ, bài đã được nộp." and go to Today.
- [ ] `pnpm typecheck && pnpm lint`. Commit.

### Task 6: Showing time (grading, result) + seed

**Files:** `src/lib/views/grading.ts`, `grading/data.ts`, `GradeAttempt.tsx`, `src/lib/views/student.ts` (ResultView), `src/components/results/ResultDetail.tsx`, `src/db/seed.ts`.

- [ ] GradingDetail gains `timeLimitMinutes: number | null`; header: timed → `Làm trong {m}/{limit} phút`, plus amber Badge "Hết giờ – tự nộp" when `durationSeconds >= limit*60`.
- [ ] ResultView gains `durationMinutes?: number; timeLimitMinutes?: number`; ResultDetail shows "⏱ Thời gian làm bài: 12 phút" (+ "/20 phút").
- [ ] Seed: give one upcoming web assignment `timeLimitMinutes: 20`.
- [ ] `pnpm typecheck && pnpm test`. Commit.

### Task 7: E2E + docs

**Files:** create `e2e/timed.spec.ts`; `CLAUDE.md`.

- [ ] Test 1: parent assigns a set with a 2-minute limit, child opens it → start card → Bắt đầu → answers → `page.clock` fast-forward → "Còn 1 phút" toast → fast-forward past 0 → "Hết giờ" → leaves take screen.
- [ ] Test 2: start a timed assignment, answer, exit; set `started_at` back 1 h via pg in the test; reload → assignment no longer in progress; parent grading detail shows "Hết giờ – tự nộp".
- [ ] CLAUDE.md: domain rule bullet on timed attempts.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`. Commit.
