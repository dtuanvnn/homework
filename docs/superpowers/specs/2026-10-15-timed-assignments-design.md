# Timed assignments (exam mode) and reliable work time — design

Date: 2026-10-15 · Status: approved design, not implemented

## Goal

Help the child become aware of how much time is left and stay focused. When assigning web work, the parent can set a time limit: the child works only within it, sees warnings (animation + sound) near the end and the attempt is handed in automatically when time runs out, like an exam. Without a limit, the work is timed as now, but the stored time must be trustworthy so the parent can use it when grading and in reports.

Today: `TakeAssignment` runs a client-only stopwatch that restarts at 0 on every mount; `submitAttempt` stores whatever the client sends (clamped to 0–6 h). `attempts.startedAt` is set on the server when the draft row is inserted (first autosave). Nothing on the server knows about time limits, and an unfinished draft stays "in progress" forever.

Success: the parent assigns a set with "20 phút"; the child presses "Bắt đầu", sees a countdown, gets a 5-minute and a 1-minute warning and a ticking last 10 seconds; at 0 the work is handed in and graded. If the child leaves mid-way, the clock keeps running and the attempt is handed in when the app is next opened after the deadline. Untimed work shows a time that only counts while the page was open, summed across sessions. The grading page shows "12/20 phút" or "Hết giờ – tự nộp".

### Decisions made with the user

- Timed mode: the clock keeps running when the child leaves the app (wall clock from `startedAt`). Returning after the deadline finds the attempt handed in with the answers saved so far.
- Untimed mode: time counts only while the take page is visible and accumulates across sessions.
- Warnings: two thresholds, 5 minutes and 1 minute, plus a tick each second in the last 10 seconds.
- A retry (attempt 2) gets the same limit and its own clock.
- The limit applies to web work only and is locked once the child has started an attempt.
- Server is the source of truth for the deadline (approach A). No cron: expired drafts are finalized lazily whenever the app loads.

### Out of scope

Score penalties for time, pausing a timed attempt, blocking app switching, per-assignment warning thresholds, time limits for paper work.

## 1. Data and assigning

- `assignments.timeLimitMinutes smallint null`, check `between 1 and 240`. Null = untimed. One migration via `pnpm db:generate`.
- Threaded through `AssignmentRecord` (`server/queries.ts`), `Assignment` (`lib/types.ts`, `timeLimitMinutes?: number`), `toAssignment` (`server/views.ts`), `newAssignmentSchema` (`server/actions/library.ts`, `z.number().int().min(1).max(240).nullable()`), `ScheduleDraft` + `createAssignments` (`lib/schedule.ts`).
- `insertAssignments` / `updateAssignment` force `timeLimitMinutes = null` when `mode === "paper"`. `updateAssignment` rejects a change to the limit once any attempt exists (same rule as `mode`). `quickAssign` stays untimed.
- `AssignSheet` and `EditAssignmentSheet`: when mode is web, a "Giới hạn thời gian" switch; on, preset chips 10 / 15 / 20 / 30 / 45 / 60 phút plus a number field; default = the set's `estimatedMinutes` (falls back to 20). Locked with an explanation in the edit sheet when `attemptCount > 0`.
- Child's assignment cards (Today / assignments list) and the parent schedule show a "⏱ 20 phút" chip for timed assignments.

## 2. Timer logic (pure, `src/lib/timer.ts`)

Tested with vitest, no server imports.

```ts
deadlineOf(startedAt: Date, limitMinutes: number): Date
remainingSeconds(deadline: Date, now: Date): number            // ≥ 0
warningLevel(remaining: number, limitSeconds: number): "none" | "warn" | "urgent" | "final"
  // warn   ≤ min(300, 20% of limit)
  // urgent ≤ 60
  // final  ≤ 10
timedDuration(startedAt: Date, limitMinutes: number, now: Date): number   // min(now − startedAt, limit) in seconds
mergeActiveSeconds(stored: number | null, reported: number): number      // max(stored, clamp(reported, 0, 6h))
SUBMIT_GRACE_SECONDS = 30
isExpired(startedAt, limitMinutes, now): boolean   // now > deadline + grace
```

## 3. Timed attempts (exam mode)

### Start screen
For a timed assignment with no open draft, the do page renders a start card instead of the questions: set title, "Bài này có 20 phút. Hết giờ bài sẽ tự nộp.", number of questions and a "Bắt đầu" button. Pressing it calls a new action `startAttempt(assignmentId)` (student access) which runs `openAttempt` and returns `{ startedAt, deadline, now }`; the take UI then mounts. Opening the page by accident therefore never starts the clock. Untimed assignments skip the start card (current behaviour; the attempt is still created by the first autosave).

### Countdown
`TakeRoute` / `TakeAssignment` receive `timer: { kind: "countdown", deadline: string, serverNow: string } | { kind: "stopwatch", initialSeconds: number }`. The countdown computes a clock offset from `serverNow` vs `Date.now()` at mount so a wrong iPad clock doesn't matter. The countdown is always visible (no hide button) and re-derives the remaining time from the deadline on every tick, so a sleeping tab catches up when it wakes.

### Clock UI (`components/take/CountdownClock.tsx`)
- Digits rendered with **`@number-flow/react`** (new dependency): each digit rolls when it changes (`12:00 → 11:59`); it respects `prefers-reduced-motion`. The untimed stopwatch uses the same digits.
- A thin SVG progress ring around the clock (drawn with `motion`, no extra library) shrinks with the remaining fraction and shifts green → orange → red with the warning level, so the child can read "how much is left" at a glance.
- Sounds stay synthesized in `useSound` (no audio files for now; `SOUND_FILES` can swap in mp3s later).

### Warnings
- `warn`: clock turns orange with a `shake`, sound `warn` once, toast "Còn 5 phút nữa!" (or the actual minutes for short limits).
- `urgent`: clock turns red and pulses (`latePulse`), sound `urgent` once, toast "Còn 1 phút! Em kiểm tra lại bài nhé."
- `final`: sound `tick` each second, the seconds digit scales up.
- Each level fires once per mount. On resume past a threshold the colour applies immediately; only the current level's sound/toast plays, earlier ones are skipped.
- New synthesized sounds `warn`, `urgent`, `tick` in `hooks/useSound.ts` (respect the existing sound setting).

### Time up
At 0: an overlay "Hết giờ! ⏰" blocks input, the pending autosave is flushed, then `submitAttempt` is called with the current answers and the existing paper-plane animation and routing run. If the network call fails, the overlay shows "Đang nộp bài…" and retries; the server finalizes the attempt anyway (below).

### Server enforcement (`server/actions/attempts.ts`)
- `openAttempt` never returns an expired timed draft: it finalizes it first (below) and returns null.
- `saveDraft`: if the attempt is timed and `isExpired`, it does not write the new answers; it finalizes the attempt and returns `{ ok: false, error: "Đã hết giờ làm bài.", expired: true }`. The client treats `expired` by going to the result page.
- `submitAttempt`: accepted until deadline + 30 s grace (covers the auto-submit request in flight). For timed attempts `durationSeconds = timedDuration(startedAt, limit, now)`, ignoring the client value. After the grace it behaves like `saveDraft` (finalize with stored answers, return `expired`).

### Lazy finalization
`finalizeExpiredAttempts(now)` in `src/server/attempt-finalize.ts` (server-only):
1. Select open attempts (`submittedAt is null`) joined with assignments where `timeLimitMinutes is not null` and `startedAt + limit + grace < now`.
2. For each: load questions and stored answers (`getDraftResponses`), grade with `gradeAttempt`, and write exactly what `submitAttempt` writes, with `submittedAt = deadline` (not now, so on-time/streak logic sees when time actually ran out) and `durationSeconds = limit`. Guarded by `submittedAt is null` in the update so concurrent finalizers don't double-submit.

The submit-and-grade write is extracted from `submitAttempt` into a shared helper so both paths store identical rows.

Called from `src/app/(app)/layout.tsx` before it loads assignments (one indexed query, usually zero rows) and from the do page. Because finalization happens before any state is derived, `deriveAssignmentState` never sees an expired draft and needs no change.

Rewards note: an auto-submitted attempt has `submittedAt = deadline`; if the deadline is after `dueAt` it counts as late exactly like a manual late submission.

## 4. Untimed attempts (stopwatch)

- `TakeAssignment` counts seconds only while `document.visibilityState === "visible"`, starting from `initialSeconds` (the draft's stored `durationSeconds`, passed by the do page).
- `saveDraft(assignmentId, responses, activeSeconds)` stores `mergeActiveSeconds(stored, activeSeconds)` in `attempts.durationSeconds` inside the existing transaction. Visibility-change and exit flushes already save, so leaving the app persists the time.
- `submitAttempt` uses `mergeActiveSeconds` the same way for untimed attempts.
- The existing hide/show timer button stays for untimed work.

## 5. Showing time for grading and evaluation

- Grading page (`GradeAttempt`): "Làm trong 12 phút" as now; timed: "12/20 phút", and a badge "Hết giờ – tự nộp" when `durationSeconds >= limit * 60` (derived, no extra column). `lib/views/grading.ts` gains `timeLimitMinutes`.
- Child's result detail (`ResultDetail`): a line "⏱ Thời gian làm bài: 12 phút" (and "/20 phút" when timed).
- Reports: `averageMinutes` unchanged; it becomes accurate thanks to section 4.
- Seed: one timed assignment among the demo data so the chip and grading label are visible.

## 6. Testing

- Unit: `lib/timer.test.ts` (deadline, remaining, warning levels incl. short limits, timed duration cap, merge monotonic/clamp, expiry with grace); schedule tests carry `timeLimitMinutes`; paper forces null.
- E2E `e2e/timed.spec.ts` (iPad + iPhone):
  1. Parent assigns a set with a 2-minute limit; child sees the chip, opens it, sees the start card, presses "Bắt đầu", answers one question.
  2. With Playwright `page.clock` fast-forward to 61 s left → red urgent clock and toast; past 0 → "Hết giờ!" overlay, lands on the result page. (Only the browser clock is faked, so the server sees a short real duration here.)
  3. Expired-draft path: start another timed assignment, answer, leave; move the attempt's `startedAt` into the past through a DB helper in `e2e/helpers.ts` (server time can't be faked), reload → the attempt shows as submitted with the saved answer, and parent grading shows "Hết giờ – tự nộp".
- Existing `core-flow.spec.ts` keeps passing (untimed path).
