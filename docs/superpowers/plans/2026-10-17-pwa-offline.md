# PWA and offline homework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A child can take downloaded web assignments with no network; hand-ins queue on the iPad and sync, get graded and labelled "Nộp offline" when the network returns.

**Architecture:** Pure rules in `src/lib/offline/*` (time clamping, sync decisions, pack diffing, draft choice), an IndexedDB store + outbox on the client, two new student Server Actions (`getOfflinePack`, `syncOfflineAttempt`) in `src/server/actions/offline.ts`, a work adapter that lets `TakeAssignment` save/submit locally, and a Serwist service worker that serves a static `/offline` page for cold starts.

**Tech Stack:** Next 16.4 (App Router, Turbopack, `typedRoutes`), React 19, Drizzle + pg, zod 4, vitest, Playwright WebKit, `idb` (new), Serwist (new; see Task 8).

**Spec:** `docs/superpowers/specs/2026-10-17-pwa-offline-design.md`

## Global Constraints

- All UI text Vietnamese; keep the app's visual language, animations and sounds (`play(...)`).
- Online behaviour unchanged: `startAttempt`, `saveDraft`, `submitAttempt`, server deadline and `SUBMIT_GRACE_SECONDS = 30` keep their current semantics for online work.
- Answer keys/solutions never reach the device: only `toTakeQuestion` output goes into the pack.
- Every new reader/action: `studentGate()` (wraps `assertAccess("student")`), `assertAssignmentInScope`, and `await settleExpiredAttempts()` before reading attempts (`getAssignment`/`listAssignments` already do).
- Testable logic lives in `src/lib/` (test files can't import `"server-only"` modules; there are no server action unit tests in this repo).
- Parent mode and paper work are not offline; paper cards show "Cần có mạng".
- Never cache dynamic HTML, RSC or Server Action responses in the service worker.
- Pack, drafts and outbox keyed by student id.
- Copy fixed by the spec: "Đã tải ✓", "Cần có mạng", "Chờ gửi", "Đang không có mạng — bài làm được lưu trên máy", "Chờ gửi (n)", "Đã gửi n bài", "Đã lưu trên máy", "Đã nộp — sẽ gửi khi có mạng", "Nộp offline", "Đề đã sửa sau khi con tải bài", "Không gửi được", "Bài này đã được chấm, bản offline không được gửi", "Nhập lại mã PIN để gửi bài", "Làm bài offline", "Về trang chính", "Mở lúc …".

## Review Focus

1. Sync retried after its reply was lost (same `clientId` twice) → one attempt, same result, no second attemptNo. Tests: Task 1 `already-synced by clientId`, Task 10 `retry of a lost sync reply is idempotent`.
2. iPad clock far off (hours fast/slow, or before `availableFrom`) → times clamped into `[availableFrom | startedAt, now]`, never in the future. Task 1 clamp tests.
3. Network drops mid online save/submit (request sent, reply lost) → answers kept locally, submit falls back to outbox; the later sync is idempotent or finds the attempt closed. Task 5 `submit falls back to outbox on network error`; Task 1 `refuse closed`.
4. Reload / cold start offline on a page other than a take page (Today, Results) → `/offline` screen, not a Safari error. Task 8 verification.
5. Pack refresh while the child has local work and the parent edited the set → local questions kept, not swapped. Task 6 `keeps entries with local work`.

---

### Task 1: Pure offline time and sync rules

**Files:**
- Create: `src/lib/offline/sync-rules.ts`
- Test: `src/lib/offline/sync-rules.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OfflineTimed = { deadlineMs: number; source: "server" | "device" } | null
  export interface OfflineTimesInput {
    now: Date
    availableFrom: Date
    existingStartedAt: Date | null      // server row, if any
    startedAtClient: number | null      // ms, already offset-corrected
    submittedAtClient: number           // ms, already offset-corrected
    timeLimitMinutes: number | null
    timed: OfflineTimed
    existingDurationSeconds: number | null
    activeSeconds: number
  }
  export interface OfflineTimes { startedAt: Date; submittedAt: Date; durationSeconds: number; late: boolean }
  export function resolveOfflineTimes(i: OfflineTimesInput): OfflineTimes
  export function clampDate(ms: number, min: Date, max: Date): Date
  export type SyncTarget =
    | { kind: "already-synced"; attemptId: string }
    | { kind: "use-draft"; attemptId: string }
    | { kind: "replace-auto-settled"; attemptId: string }
    | { kind: "create"; attemptNo: number }
    | { kind: "refuse"; reason: "closed" | "graded-by-parent" }
  export interface SyncAttemptView { id: string; attemptNo: number; startedAt: Date; submittedAt: Date | null; gradedBy: "auto" | "ai" | "parent" | null; autoSettled: boolean; offlineId: string | null }
  export function decideSync(i: { clientId: string; attemptNo: number; attempts: SyncAttemptView[]; maxAttempts: number; canTakeNow: boolean; timeLimitMinutes: number | null }): SyncTarget
  ```

- [ ] **Step 1: Write the failing tests** (`describe("resolveOfflineTimes")`, `describe("decideSync")`), times as `new Date("2026-10-17T10:00:00+07:00")` etc.
  - `clamps hand-in into [startedAt, now]`: submittedAtClient = now + 3 h → `submittedAt == now`; submittedAtClient < existingStartedAt → `submittedAt == existingStartedAt`.
  - `new attempt starts no earlier than availableFrom`: existingStartedAt null, startedAtClient = availableFrom − 1 day → `startedAt == availableFrom`; startedAtClient null → `startedAt == submittedAt`.
  - `device-timed caps at the limit`: limit 20, started 10:00, submitted 10:25 → `submittedAt == 10:20`, `durationSeconds == 1200`, `late == true`; submitted 10:20:20 (within grace) → `submittedAt == 10:20`, `durationSeconds == 1200`, `late == false`; submitted 10:12 → `submittedAt == 10:12`, `durationSeconds == 720`.
  - `server-timed keeps the server deadline`: source "server", existingStartedAt 10:00, deadlineMs 10:20; submittedAtClient 10:19 → `submittedAt == 10:19`, `durationSeconds == 1140`; submittedAtClient 10:30 → `submittedAt == 10:20`, `late == true`.
  - `untimed merges active seconds`: existingDurationSeconds 100, activeSeconds 90 → 100; activeSeconds 400 → 400.
  - `decideSync`: `already-synced by clientId` (any attempt with `offlineId === clientId`, checked first); `use-draft` when the latest attempt is unsubmitted; `replace-auto-settled` when latest is submitted, `autoSettled`, `gradedBy` null or "auto", `attemptNo` equal (any hand-in time: a late one is accepted and `resolveOfflineTimes` pins it to the deadline, per spec "Refused hand-ins"); `refuse graded-by-parent` for that same case with `gradedBy` "parent" or "ai"; `create` with `attemptNo = latest + 1` when nothing open, `canTakeNow`, ≤ `maxAttempts`; `refuse closed` otherwise (e.g. latest submitted normally and no retry).
- [ ] **Step 2: Run to verify failure** — `pnpm test src/lib/offline/sync-rules.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** with `deadlineOf`, `mergeActiveSeconds`, `SUBMIT_GRACE_SECONDS` from `src/lib/timer.ts`. Device-timed deadline = `startedAt + limit`; server-timed = `timed.deadlineMs`. `late` = clamped submit > deadline + 30 s. Timed `submittedAt = min(clamped, deadline)`, `durationSeconds = min(submittedAt − startedAt, limit·60)`.
- [ ] **Step 4: Run** — `pnpm test src/lib/offline/sync-rules.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Offline: pure time and sync rules"`

### Task 2: Schema columns and finalize hooks

**Files:**
- Modify: `src/db/schema.ts` (attempts table, ~line 160)
- Create: `drizzle/0006_*.sql` via `pnpm db:generate`
- Modify: `src/server/attempt-finalize.ts` (`closeAttempt`, `settleAttempt`)

**Interfaces:**
- Produces columns: `offlineId: uuid("offline_id")` + `uniqueIndex("attempts_offline_id_idx")`, `submittedOffline: boolean("submitted_offline").notNull().default(false)`, `autoSettled: boolean("auto_settled").notNull().default(false)`, `offlineSetChanged: boolean("offline_set_changed").notNull().default(false)` *(backs the "Đề đã sửa" note; plan's call)*.
- Produces: `closeAttempt(input & { offline?: { offlineId: string; setChanged: boolean }; reopen?: boolean; autoSettled?: boolean })`:
  - `offline` sets `offlineId`, `submittedOffline = true`, `offlineSetChanged = setChanged`; when `setChanged`, no auto grade (`gradedAt/gradedBy/score/feedback` null, every row `isCorrect = null`, `pointsAwarded = null`).
  - `reopen: true` locks the row without `submittedAt IS NULL`, clears `gradedAt/gradedBy/score/feedback/autoSettled` before writing (only for `replace-auto-settled`).
  - `autoSettled: true` (passed by `settleAttempt`) sets `autoSettled = true`.
  - No flags = today's behaviour.

- [ ] **Step 1:** Add the columns; `pnpm db:generate`; review the SQL (three `boolean DEFAULT false NOT NULL`, one nullable `uuid` + unique index, nothing else).
- [ ] **Step 2:** Extend `closeAttempt` / `settleAttempt` as above.
- [ ] **Step 3: Verify** — `pnpm db:migrate`; `pnpm typecheck && pnpm test` → green; `pnpm exec playwright test e2e/timed.spec.ts --project=ipad` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Offline: attempt columns for offline hand-ins and auto-settled marker"`

### Task 3: `syncOfflineAttempt` and `saveDraft` start time

**Files:**
- Create: `src/lib/offline/outbox.ts`, test `src/lib/offline/outbox.test.ts`
- Create: `src/server/actions/offline.ts`
- Modify: `src/server/actions/attempts.ts` — move `studentGate`, `parseResponses`, `loadWebAssignment`, `responsesSchema` into a non-action module `src/server/attempt-input.ts` (a `"use server"` file may only export async actions) and import them from both files; add `startedAt` to `saveDraft` / `openAttempt`.

**Interfaces:**
- Consumes: Task 1 `resolveOfflineTimes`, `decideSync`, `OfflineTimed`; Task 2 `closeAttempt` flags.
- Produces (`outbox.ts`):
  ```ts
  export interface OutboxItem {
    clientId: string; studentId: string; assignmentId: string; attemptNo: number
    setVersion: string                      // exerciseSets.updatedAt ISO at download
    responses: Record<string, unknown>; activeSeconds: number
    startedAtClient: number | null; submittedAtClient: number
    timed: OfflineTimed
    status: "pending" | "refused"; refusal?: string
  }
  export type OutboxPayload = Omit<OutboxItem, "studentId" | "status" | "refusal">
  export const outboxPayloadSchema: z.ZodType<OutboxPayload>   // responses validated later by parseResponses
  export const toPayload: (item: OutboxItem) => OutboxPayload
  ```
- Produces (`offline.ts`):
  ```ts
  export type SyncResult =
    | { ok: true; attemptId: string; graded: boolean; score: number | null }
    | { ok: false; error: string; refused?: true }   // refused → item becomes "Không gửi được"
  export async function syncOfflineAttempt(payload: OutboxPayload): Promise<SyncResult>
  ```
- `saveDraft(assignmentId, responses, activeSeconds?, startedAt?: string)` — ISO; only used when inserting a new **untimed** row, clamped to `[availableFrom, now]`.

- [ ] **Step 1: Failing test** `outbox.test.ts`: schema accepts a valid payload; rejects non-uuid `clientId`, non-finite `submittedAtClient`, `timed.source` other than server|device, `attemptNo` outside 1–2.
- [ ] **Step 2:** `pnpm test src/lib/offline/outbox.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `syncOfflineAttempt`: gate → scope → `outboxPayloadSchema` + `parseResponses` → `loadWebAssignment` → `decideSync` (`canTakeNow = canTake(stateOf(record, now))`) → on refuse return `refused: true` with "Bài này không làm tiếp được nữa." (closed) or "Bài này đã được chấm, bản offline không được gửi" (graded-by-parent) → `resolveOfflineTimes` → `setChanged = record.set` row's `updatedAt.toISOString() !== payload.setVersion` (select `exerciseSets.updatedAt`; `ExerciseSet` doesn't carry it); when changed, keep only responses whose ids exist in `getQuestions(setId)` → for `create`, insert the row with `startedAt` and `onConflictDoNothing` (on conflict re-run `decideSync` once) → `closeAttempt({ …, submittedAt, durationSeconds, offline: { offlineId: clientId, setChanged }, reopen: kind === "replace-auto-settled" })` → `already-synced` returns that attempt's current grade state. No `refresh()`.
- [ ] **Step 4:** `pnpm test src/lib/offline && pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Offline: syncOfflineAttempt action and saveDraft start time"`

### Task 4: Client store, clock offset, draft choice

**Files:**
- Create: `src/lib/offline/drafts.ts` (pure), test `src/lib/offline/drafts.test.ts`
- Create: `src/lib/offline/pack.ts` (types only in this task; diff logic in Task 6)
- Create: `src/lib/offline/store.ts` (`pnpm add idb`)

**Interfaces:**
- Produces (`drafts.ts`):
  ```ts
  export interface LocalDraft { studentId: string; assignmentId: string; attemptNo: number; origin: "server" | "device"; responses: Record<string, unknown>; activeSeconds: number; startedAtClient: number | null; timed: OfflineTimed; setVersion: string; updatedAt: number }
  export function chooseDraft(local: LocalDraft | null, server: { attemptNo: number; responses: Record<string, unknown> } | null): Record<string, unknown>
  export function offsetFrom(serverNowIso: string, sentAt: number, receivedAt: number): number   // serverNow − midpoint
  export function correctedNow(offsetMs: number, deviceNow?: number): number
  ```
- Produces (`pack.ts` types):
  ```ts
  export interface PackEntry {
    studentId: string; assignmentId: string; version: string; setVersion: string
    title: string; subject: SubjectId; dueAt: string; availableFrom: string
    timeLimitMinutes: number | null; attemptNo: number
    questions: TakeQuestion[]          // image.path kept; imageUrl dropped before storing
    draft: { attemptNo: number; startedAt: string; responses: Record<string, unknown>; durationSeconds: number | null; deadline: string | null } | null
    complete: boolean                  // data + all images stored → "Đã tải ✓"
  }
  export interface PackResponse { studentId: string; studentName: string; serverNow: string; entries: Omit<PackEntry, "studentId" | "complete">[] }
  ```
- Produces (`store.ts`, browser only, DB `hh-offline` v1, stores `packs` [key studentId+assignmentId], `images` [key path], `drafts`, `outbox` [key clientId, index studentId], `meta`):
  `listPack(studentId): Promise<PackEntry[]>`, `getPackEntry(studentId, assignmentId)`, `putPackEntry(e)`, `deletePackEntry(studentId, assignmentId)`, `clearPack(studentId)`, `getImage(path): Promise<Blob | undefined>`, `putImage(path, blob)`, `getDraft(studentId, assignmentId)`, `putDraft(d)`, `deleteDraft(studentId, assignmentId)`, `listOutbox(studentId): Promise<OutboxItem[]>`, `putOutbox(item)`, `deleteOutbox(clientId)`, `getMeta<K extends keyof OfflineMeta>(k): Promise<OfflineMeta[K] | undefined>`, `setMeta(k, v)`; `OfflineMeta = { clockOffsetMs: number; lastStudentId: string; lastStudentName: string }`.

- [ ] **Step 1: Failing tests** `drafts.test.ts`: `chooseDraft` → local responses when local.attemptNo ≥ server.attemptNo; server's when local null or local.attemptNo < server.attemptNo; `{}` when both null. `offsetFrom("2026-10-17T03:00:10.000Z", t, t + 2000)` where `t + 1000` = 03:00:00Z → `10_000`. `correctedNow(5000, 1000) === 6000`.
- [ ] **Step 2:** `pnpm test src/lib/offline/drafts.test.ts` → FAIL.
- [ ] **Step 3:** Implement `drafts.ts`, `pack.ts` types, `store.ts` (thin `idb` wrappers, exercised by E2E).
- [ ] **Step 4:** `pnpm test src/lib/offline && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Offline: IndexedDB store, clock offset and draft choice"`

### Task 5: Work adapter on the take screen (in-app offline)

**Files:**
- Create: `src/lib/offline/adapter-logic.ts`, test `src/lib/offline/adapter-logic.test.ts`
- Create: `src/components/take/use-work-adapter.ts`
- Modify: `src/components/take/TakeRoute.tsx`, `src/components/take/TakeAssignment.tsx`
- Modify: `src/app/(app)/student/assignments/[id]/do/page.tsx` — also pass `studentId`, `setVersion` (set `updatedAt` ISO), `attemptNo` (draft's, else next)

**Interfaces:**
- Consumes: Task 3 `saveDraft(…, startedAt?)`, `syncOfflineAttempt` (not called here; outbox only); Task 4 store, `chooseDraft`, `correctedNow`, `offsetFrom`.
- Produces (`adapter-logic.ts`):
  ```ts
  export type NetOutcome<T> = { kind: "ok"; value: T } | { kind: "network" } | { kind: "server"; error: string; expired?: boolean }
  export function classify<T extends { ok: boolean; error?: string; expired?: boolean }>(res: T | null): NetOutcome<T>   // null = the call threw
  export function submitRoute(origin: "server" | "device", online: boolean): "server" | "outbox"
  ```
- Produces (`use-work-adapter.ts`):
  ```ts
  export interface WorkAdapter {
    start(): Promise<{ deadline: string; serverNow: string } | { error: string; expired?: boolean }>
    save(answers: Answers, seconds: number): Promise<"server" | "local" | false>
    submit(answers: Answers, seconds: number): Promise<{ graded: boolean; attemptId: string } | { queued: true } | { error: string; expired?: boolean }>
  }
  export function useWorkAdapter(p: { studentId: string; assignmentId: string; attemptNo: number; setVersion: string; timeLimitMinutes: number | null; serverDraft: boolean; initialOrigin?: "server" | "device" }): WorkAdapter
  ```
- `TakeAssignment` prop changes: `onSave` → `Promise<"server" | "local" | false>` (`"local"` shows `CloudCheck` + "Đã lưu trên máy"); `onSubmit` → `Promise<{ graded: boolean } | { queued: true } | null>`; on `{ queued: true }` the plane animation finishes and the screen shows "Đã nộp — sẽ gửi khi có mạng" with a button back (`onSubmitted`). `onTimeUp`: if `!navigator.onLine`, one `handIn(true)` (which queues) instead of the `online()` loop.

Rules:
- `save`: `putDraft` first (origin, `startedAtClient`, `timed`), then the server only when origin is `"server"`; untimed with no server draft calls `saveDraft(…, new Date(startedAtClient).toISOString())` and becomes origin `"server"` on success. Server outcome `network` → `"local"`; `server` error with `expired` → existing time-up handling.
- `start()`: online → `startAttempt`, store `offsetFrom(serverNow, …)` as `clockOffsetMs`; `network` outcome or `!navigator.onLine` → origin `"device"`, `startedAtClient = correctedNow(offset)`, deadline `startedAtClient + limit·60 000`, `serverNow = new Date(correctedNow(offset)).toISOString()`, `timed = { deadlineMs, source: "device" }`.
- `submit`: `submitRoute`; server path on `network` falls back to the outbox; outbox item `clientId = crypto.randomUUID()`, `submittedAtClient = correctedNow(offset)` (time-up: the deadline); server success → `deleteDraft`.
- `TakeRoute` merges initial answers with `chooseDraft(await getDraft(...), serverDraft)` on mount.

- [ ] **Step 1: Failing tests** `adapter-logic.test.ts`: `submitRoute("device", true) === "outbox"`; `submitRoute("server", false) === "outbox"`; `submitRoute("server", true) === "server"`; `submit falls back to outbox on network error`: `classify(null).kind === "network"`; `classify({ ok: false, error: "x" })` → `{ kind: "server", error: "x" }`; `classify({ ok: true })` → `kind: "ok"`.
- [ ] **Step 2:** `pnpm test src/lib/offline/adapter-logic.test.ts` → FAIL.
- [ ] **Step 3:** Implement logic, hook and prop changes.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint` → PASS; `pnpm exec playwright test e2e/timed.spec.ts e2e/core-flow.spec.ts e2e/handwriting.spec.ts --project=ipad` → PASS (online unchanged).
- [ ] **Step 5: Commit** — `git commit -m "Offline: take screen saves and hands in locally without network"`

### Task 6: Offline pack (download + figures)

**Files:**
- Modify: `src/lib/offline/pack.ts` (add `planPackUpdate`), test `src/lib/offline/pack.test.ts`
- Modify: `src/server/actions/offline.ts` (add `getOfflinePack`)
- Create: `src/lib/offline/pack-client.ts`
- Modify: `src/components/question/QuestionPicture.tsx`

**Interfaces:**
- Consumes: Task 4 store + types.
- Produces:
  ```ts
  export function planPackUpdate(stored: PackEntry[], incoming: PackResponse["entries"], busy: Set<string>): { put: PackResponse["entries"]; remove: string[] }
  export async function getOfflinePack(): Promise<{ ok: true; pack: PackResponse } | { ok: false; error: string; locked?: true }>
  export async function refreshPack(studentId: string): Promise<void>
  ```
  `busy` = assignment ids with a local draft or outbox item. `put` = incoming entries that are new, or whose `version` changed or whose stored entry is not `complete`, **excluding busy ids**. `remove` = stored ids not in incoming and not busy.
- `getOfflinePack`: web assignments from `listAssignments()` where `canTake(stateOf(r, now))`, plus those with `availableFrom` in `(now, now + 24 h]`; questions `getQuestionsWithImages(setId).map(toTakeQuestion)` (keep `imageUrl` for download); draft via `getDraftResponses`; `version` = `${setUpdatedAt}|${latest?.id}|${latest?.submittedAt}|${draftAnswerCount}`; `locked` when the gate refusal is "Tài khoản đang tạm khoá.".
- `refreshPack`: call `getOfflinePack` (measure round trip → `clockOffsetMs`); `locked` → `clearPack`; store `lastStudentId`/`lastStudentName`; for each `put`: fetch every `imageUrl` → `putImage(path, blob)`, strip `imageUrl`, `putPackEntry({ …, complete: allImagesStored })`; delete `remove`; if any question has `math: true`, `import("mathlive")` once so the worker caches the chunk.
- `QuestionPicture`: when `!navigator.onLine` or the `<img>` errors, look up `getImage(question.image.path)` and use `URL.createObjectURL` (revoke on unmount) before falling back to today's refresh/“Không tải được hình”.

- [ ] **Step 1: Failing tests** `pack.test.ts`: `keeps entries with local work` (busy stored id missing from incoming → not in `remove`; busy id with new version → not in `put`); unchanged version + complete → not put; unchanged version + incomplete → put; new id → put; stale non-busy → removed.
- [ ] **Step 2:** `pnpm test src/lib/offline/pack.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Offline: download open assignments with figures"`

### Task 7: Sync runner, banner and student chips

**Files:**
- Create: `src/lib/offline/sync-client.ts`, `src/components/offline/OfflineSync.tsx`, `src/components/offline/OfflineBanner.tsx`, `src/components/offline/use-offline-state.ts`
- Modify: `src/components/layout/AppFrame.tsx` (mount `OfflineSync` + banner in student mode), `src/components/dashboard/TodayAssignmentList.tsx`, `src/components/pages/StudentAssignments.tsx`

**Interfaces:**
- Consumes: Task 3 `syncOfflineAttempt`, `toPayload`; Task 4 store; Task 6 `refreshPack`.
- Produces: `flushOutbox(studentId): Promise<{ sent: number; refused: number; authError: boolean }>` — pending items one at a time; `ok` → `deleteOutbox` + `deleteDraft`; `refused` → `putOutbox({ …, status: "refused", refusal: error })`; thrown call → stop, keep; error "Cần mã PIN để tiếp tục." or "Tài khoản đang tạm khoá." → stop, `authError: true`.
- Produces: `useOfflineState(studentId): { online: boolean; downloaded: Set<string>; pending: Set<string>; refused: OutboxItem[]; reload(): void }`.
- `OfflineSync` triggers: mount, `online`, `visibilitychange` → visible (flush then pack); every 30 s while pending and online (flush); every 10 min while visible and online (pack); after layout props change (pack). `sent > 0` → toast "Đã gửi n bài" + `router.refresh()`.

UI: banner "Đang không có mạng — bài làm được lưu trên máy" (offline) with "Chờ gửi (n)"; `authError` → "Nhập lại mã PIN để gửi bài" linking to `/pin`; card chips "Đã tải ✓" (complete web entry), "Cần có mạng" (paper, offline only), "Chờ gửi" (pending outbox; hide score/CTA); refused items listed on Today with "Không gửi được", the reason and "Bỏ bài này" → parent PIN dialog using the existing PIN check action → `deleteOutbox`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — `pnpm typecheck && pnpm lint && pnpm test` → PASS; `pnpm dev`, student, iPad viewport: Today shows "Đã tải ✓"; DevTools offline → banner; answer + hand in → "Đã nộp — sẽ gửi khi có mạng", card "Chờ gửi"; online → "Đã gửi 1 bài", card shows a score.
- [ ] **Step 3: Commit** — `git commit -m "Offline: sync runner, offline banner and download chips"`

### Task 8: Service worker and `/offline` cold start

**Files:**
- Create: `src/app/sw.ts` (Serwist), `src/app/offline/page.tsx`, `src/components/offline/OfflineApp.tsx`
- Modify: `next.config.ts`, `src/proxy.ts` (matcher), `src/components/layout/routes.ts` (`offlinePath`), `src/components/layout/AppFrame.tsx` (`navigate`), `src/app/layout.tsx` (register the worker)

**Interfaces:**
- Consumes: Task 4 store; Task 5 `useWorkAdapter`, `TakeAssignment`; Task 6 `PackEntry`; Task 7 `flushOutbox`.
- Produces: `offlinePath(assignmentId?: string): Route` → `/offline` or `/offline?a=<id>`.
- Worker (follow `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`, Serwist Turbopack example ~line 674; if Serwist can't build under this Next/Turbopack, hand-write `public/sw.js` with the same rules and say so in the commit):
  - precache build assets, `/offline`, `/mathlive/fonts/*`, `/sounds/*`, `/icon`, `/apple-icon`, `/manifest.webmanifest`;
  - navigations network-first; on failure `/` and `/student/*` → cached `/offline`, others → plain "Không có mạng" response;
  - bypass non-GET and requests with `RSC` or `Next-Action` headers; runtime cache-first for `/_next/static/*` (picks up the MathLive chunk);
  - `skipWaiting` + `clientsClaim`, clean old caches; register `{ scope: "/", updateViaCache: "none" }`.
  - `/sw.js` headers: `Content-Type: application/javascript; charset=utf-8`, `Cache-Control: no-cache, no-store, must-revalidate`, `Content-Security-Policy: default-src 'self'; script-src 'self'`.
- Proxy matcher also excludes `sw.js`, `offline`, `mathlive/` (and any Serwist asset path).
- `/offline`: static client page; reads `lastStudentId`/`lastStudentName`; title "Làm bài offline"; lists pack entries with status Chưa làm / Đang làm / Chờ gửi / "Mở lúc …" (locked until corrected device time ≥ `availableFrom`); `?a=` opens that entry in `TakeAssignment` via `useWorkAdapter` (`initialOrigin: "server"` if the entry's draft has a server deadline, else `"device"`); when online: "Về trang chính" (`window.location.assign("/")`) and `flushOutbox`.
- `navigate(path)`: when `!navigator.onLine` and `path` is a take route of a downloaded assignment → `window.location.assign(offlinePath(id))`; other routes while offline → `offlinePath()`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — `pnpm build && pnpm start`, Chromium: `/student` online → DevTools offline → reload → "Làm bài offline" lists downloaded bài; open, answer, hand in → queued; online → "Về trang chính", outbox sent. `/parent` offline → "Không có mạng". Rebuild + restart → reload activates the new worker (no stale UI).
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Offline: service worker and offline start screen"`

### Task 9: Parent label, set-changed note, home-screen tip

**Files:**
- Modify: `src/lib/views/grading.ts` (`GradingQueueItem.submittedOffline: boolean`; `GradingDetail.submittedOffline: boolean`, `GradingDetail.offlineSetChanged: boolean`), its builders, `src/lib/views/grading.test.ts`
- Modify: the server loaders that feed them (grading queue + detail queries) to select the new columns
- Modify: queue item and detail components under `src/components/pages/Grading.tsx`
- Modify: `src/components/pages/Students.tsx` (dismissible tip, `localStorage` key `hh-a2hs-tip`)

- [ ] **Step 1: Failing test** `grading.test.ts`: queue/detail builders copy `submittedOffline` and `offlineSetChanged` from the attempt (true and false).
- [ ] **Step 2:** `pnpm test src/lib/views/grading.test.ts` → FAIL.
- [ ] **Step 3:** Thread the fields; chip "Nộp offline" on queue item and detail; note "Đề đã sửa sau khi con tải bài" on detail when `offlineSetChanged`; tip "Trên iPad của con: mở Safari → Chia sẻ → Thêm vào Màn hình chính để làm bài khi không có mạng."
- [ ] **Step 4:** `pnpm test && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Offline: parent sees offline hand-ins"`

### Task 10: E2E and docs

**Files:**
- Create: `e2e/offline.spec.ts`
- Modify: `CLAUDE.md` (Architecture: offline pack / outbox / sync / service worker; Domain rules: offline hand-in time clamping, auto-settled replacement, set-changed → parent grades)

- [ ] **Step 1:** Write tests (`--project=ipad`, `context.setOffline`):
  - `hands in offline and syncs later`: student Today → "Đã tải ✓" on an untimed web card → offline → open, answer all, "Nộp bài" → "Đã nộp — sẽ gửi khi có mạng" → online → "Đã gửi 1 bài" → card shows a score; parent grading queue shows "Nộp offline".
  - `timed attempt runs offline and hands in at zero`: 1-minute timed web assignment (created through the parent UI as `e2e/timed.spec.ts` does) → offline → "Bắt đầu" → answer one → time-up → queued → online → result has that answer.
  - `retry of a lost sync reply is idempotent`: go online and trigger two flushes back to back (reload during sync) → exactly one submitted attempt.
- [ ] **Step 2:** `pnpm test:e2e` → all PASS. In the PR, state that the `/offline` cold start was verified in Chromium and must be checked by hand on an iPad (Playwright WebKit service-worker support is limited).
- [ ] **Step 3:** Update `CLAUDE.md`; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Offline: E2E and docs"`
