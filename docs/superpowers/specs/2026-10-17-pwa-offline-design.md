# PWA and offline homework (làm bài offline) — design

Date: 2026-10-17 · Status: draft design, not implemented

## Goal

A child can do assigned web homework with no network: in the car, or on an iPad without a SIM. The iPad is on home wifi before leaving; then the connection is gone for the whole trip. Work done offline is kept on the device and handed in automatically when the network comes back. The server then grades it exactly as today.

Today every screen is a dynamic server component, autosave calls `saveDraft` 800 ms after each change and only shows "Chưa lưu được" when it fails, and a reload without network gives a blank Safari error page. There is a manifest (`src/app/manifest.ts`) and icons, but no service worker.

Success: at home the child's Today screen shows "Đã tải ✓" on every open assignment. In the car, with the app still open in Safari (or opened cold from the home-screen icon), the child opens a downloaded assignment, answers everything (typed, math keyboard, handwriting), presses "Nộp bài" and sees "Đã nộp — sẽ gửi khi có mạng". Back home on wifi the attempt is sent without the child doing anything, graded, and shows up on Today and on the parent's grading queue with a small "Nộp offline" label. Hints and scores appear then.

### Decisions made with the user

- Usage: the app is normally already open in Safari from home. "Only web, no native app": the PWA is the same website, optionally added to the home screen through Safari's Share → "Thêm vào Màn hình chính". No App Store.
- Downloading: automatic. Every assignment the child can currently take is downloaded whenever the app is online. The child doesn't need to mark anything. (The user suggested marking assignments to download; the automatic download was proposed by Claude and accepted, because a child forgets to mark.)
- Submitting offline: hand-in only, no grading on the device. The child sees "Đã nộp, sẽ gửi khi có mạng"; score and AI hints appear after sync. Answer keys never reach the device, same as today (`toTakeQuestion`).
- Timed assignments: allowed offline with the countdown running on the iPad (device clock, the child could cheat by changing it; accepted). Online behaviour stays exactly as now (server deadline, `startAttempt`, 30 s grace).
- Hand-in time: the iPad's time when the child pressed "Nộp bài" counts for due date, overdue and streak. The server clamps it to ≥ the attempt's start and ≤ the moment it received it.
- The parent sees a "Nộp offline" label on attempts handed in offline.

### Non-goals

- Parent mode offline (editing sets, grading, scanning, reports).
- Paper work offline (needs photo upload; it stays "Cần có mạng").
- Grading or showing correct answers on the device.
- Native app, App Store, push notifications, background sync on iOS (Safari has no Background Sync API; sync happens while the app is open).
- AI features offline.

### Anti-goals (failure even if it "works")

- Losing a child's offline answers: a sweep, a stale server draft, an expired timer or a failed sync must never overwrite or discard them silently.
- Answer keys or solutions reachable on the device.
- Changing the online experience: online timed work, autosave and submission behave as they do today.
- A broken app for the parent because of caching (stale UI after deploy, cached parent pages).

## 1. Pieces

1. **Offline pack**: per child, the data needed to take every open assignment, stored in IndexedDB on the device.
2. **Local work store + outbox**: drafts and pending hand-ins in IndexedDB, written before any network call.
3. **Sync**: sends the outbox to a new server action, idempotently, when online.
4. **Service worker**: lets the app start and navigate to offline screens without network, and caches the static assets the take screen needs (JS chunks, KaTeX CSS/fonts, MathLive chunk and `public/mathlive/fonts`, `/sounds`).
5. **UI**: "Đã tải ✓" on cards, an offline banner, "Chờ gửi (n)", the offline hand-in confirmation, a "Làm bài offline" screen for cold starts, the parent's "Nộp offline" label.

All new pure logic (clamping, pack diffing, outbox merging, time rules) goes in `src/lib/offline/*` with unit tests; IndexedDB and service-worker code are thin wrappers around it.

## 2. Offline pack

**Server**: a new student read `getOfflinePack()` (Server Action under `src/server/actions/offline.ts`, `assertAccess("student")`, awaits `settleExpiredAttempts()` first like every attempt reader). It returns, for each assignment where `canTake(stateOf(...))` is true and `mode === "web"`:

- assignment id, title, subject, `dueAt`, `availableFrom`, `timeLimitMinutes`, attempt number, `canRetry`;
- the take questions (`toTakeQuestion`, so no keys, no solutions, no `answerStatus`) with figure `path` and a fresh signed `imageUrl`;
- the open draft if any: attempt id, `startedAt`, server-saved responses, `durationSeconds`, timed deadline;
- a `version` (hash or max `updatedAt` of set + assignment + draft) so the client can skip unchanged entries.

Also include assignments that become available within the next 24 h (`availableFrom` in the future), shown as "Mở lúc …" and openable once the device clock passes `availableFrom`. *(Claude's call: covers a trip the morning a scheduled set opens.)*

If the child is locked, `assertAccess` refuses; the client then clears the pack.

**Client** (`src/lib/offline/pack-client.ts`, called from a small `OfflineSync` component mounted in `AppFrame` in student mode only):

- Runs on app load, after `refresh()`-driven layout re-syncs, on the `online` event, and every 10 minutes while visible and online.
- Stores each assignment entry in IndexedDB keyed by `(studentId, assignmentId)`; deletes entries no longer in the pack **unless** they have local work or an outbox item.
- Downloads figure images by fetching the signed URL and storing the blob keyed by storage **path** (signed URLs expire after 1 h, so the URL can't be the cache key). Offline, `QuestionPicture` gets an object URL from the blob.
- Warms the MathLive dynamic chunk (e.g. `import()` it once) when any downloaded question has `math: true`, so the service worker caches it.
- Marks the entry "Đã tải ✓" only when data and all its images are stored.

Library: `idb-keyval` or `idb` (tiny); builder's choice. Keyed by student id so a shared device switching children doesn't mix data; on PIN change to another child, the previous child's pack stays but is never shown.

## 3. Local work and outbox

`TakeAssignment` keeps its UI but its persistence goes through a **work adapter** (`TakeRoute` today wires server actions directly). The adapter:

- `save(answers, seconds)`: writes the local draft to IndexedDB first (always, synchronously from the user's point of view), then, if online and the attempt was started online, calls `saveDraft` as today. A failed network save is no longer an error state when a local copy exists: the save indicator shows "Đã lưu trên máy" instead of "Chưa lưu được".
- `start()` for timed work: online → `startAttempt` as today. Offline → records `startedAtClient = Date.now()` locally and runs the countdown from `startedAtClient + limit` on the device clock.
- `submit(answers, seconds)`: online → `submitAttempt` as today; on network failure (or when offline from the start) → writes an outbox item and shows the offline confirmation.

Outbox item: `{ clientId (uuid), studentId, assignmentId, attemptNo, serverAttemptId?, responses, activeSeconds, startedAtClient?, submittedAtClient, timed: { deadlineMs, source: "server" | "device" } | null }`.

The local draft is the source of truth for answers while it exists. When the take page opens online and both a server draft and a newer local draft exist, the local one wins (one child, one device; last write by the device wins). *(Claude's call.)* It is deleted after the server confirms the hand-in.

Time-up offline: the countdown reaching zero hands in locally (outbox) with `submittedAtClient = deadline`, same as the online "Hết giờ – tự nộp" path, instead of today's wait-for-network retry loop.

## 4. Sync

New action `syncOfflineAttempt(item)` in `src/server/actions/offline.ts`: `assertAccess("student")`, `assertAssignmentInScope`, zod-validated with the existing `responsesSchema` (300 keys / 2 MB cap). Rules:

- **Idempotent**: `attempts.offline_id uuid unique` stores `clientId`. A repeat call with the same id returns the existing result.
- **Which attempt**: the open draft for that assignment if any (created online or by an earlier autosave), otherwise a new attempt with the next `attemptNo` (still max 2; reject if the assignment no longer allows it, e.g. the parent deleted it or turned off retry — see "Refused hand-ins" under Edge cases).
- **Times**: `now = server time`.
  - `startedAt` = existing row's `startedAt`, else `clamp(startedAtClient ?? submittedAtClient, availableFrom, now)`.
  - `submittedAt = clamp(submittedAtClient, startedAt, now)`.
  - Timed, device-run: `durationSeconds = min(submittedAt − startedAt, limit)`; accept the answers if `submittedAt ≤ startedAt + limit + 30 s`, otherwise set `submittedAt = startedAt + limit` (answers still accepted; the clock was the device's).
  - Timed, started online then lost network: the server deadline stands. `submittedAt = min(clamped, deadline)`; answers are accepted even if late (see Edge cases).
  - Untimed: `durationSeconds = mergeActiveSeconds(existing, activeSeconds)`.
- **Grading**: same path as `submitAttempt` (`closeAttempt` → `gradeAttempt`, snapshots into `answers.question`).
- Sets `attempts.submitted_offline = true`.
- **Auto-settled attempts**: if `settleExpiredAttempts()` already handed this attempt in (deadline passed while the device was offline) with the stale server answers, and the parent has not graded it by hand (`gradedBy` is null or `"auto"`), and the client's hand-in is within deadline + 30 s, replace its answers with the outbox answers and regrade. This needs a marker for "settled by sweep": `attempts.auto_settled boolean` set by `settleAttempt`. *(Claude's call; without it the child's offline answers would be lost, which is an anti-goal.)* If the parent already graded it by hand, keep the parent's grade and store nothing; the client shows "Bài này đã được chấm, bản offline không được gửi".
- Returns `{ attemptId, graded, score }`; the client removes the outbox item and local draft, then calls `router.refresh()`.

The client sends outbox items one at a time, on app load, on `online`, on visibility → visible and every 30 s while items are pending and `navigator.onLine`. Network errors keep the item. Access errors (PIN expired, child locked) keep the item and show a hint ("Nhập lại mã PIN để gửi bài"). The student cookie lasts 180 days, so this is rare.

Migration (`pnpm db:generate`): `attempts.offline_id uuid null unique`, `attempts.submitted_offline boolean not null default false`, `attempts.auto_settled boolean not null default false`.

Rewards: no change. Streak uses `submittedAt`, which is now the clamped device time; stars come from the score after grading.

### Edge cases (all Claude's calls)

- **Set edited after download.** Question ids survive edits (`saveExerciseSet` reinserts with the same uuid) and `exerciseSets.updatedAt` changes on every save. The pack stores the set's `updatedAt`; the outbox item carries it. A pack refresh never replaces the questions of an assignment that has a local draft or outbox item. On sync, if the set's `updatedAt` differs, the server stores the answers whose question ids still exist (snapshot = current question), does **not** auto-grade, leaves the attempt for the parent ("Đề đã sửa sau khi con tải bài" note on the grading page), and keeps answers to deleted questions out (they had no question to grade against). If the version is unchanged, grading is automatic as usual.
- **Clock offset.** Every server reply that carries server time (pack, `startAttempt`, sync) updates a stored `clockOffsetMs = serverNow − Date.now()` (midpoint of the round trip, as `TakeAssignment` already does). All device timestamps in the outbox (`startedAtClient`, `submittedAtClient`) are corrected by that offset before being stored, and the device-run countdown uses corrected time. The server still clamps as above. This keeps an iPad a minute fast from losing an on-time hand-in.
- **Refused hand-ins** (assignment deleted, retry no longer allowed, parent already graded the auto-settled attempt by hand, or an online-started timed attempt later than deadline + 30 s by corrected time). Device only, no new server table: the item stays in the outbox marked "Không gửi được" with the reason, visible on the child's list. Discarding it needs the parent PIN, checked online by the existing PIN action. Late timed hand-ins are the one exception to "refused": the server accepts the answers but sets `submittedAt = deadline` (same as today's auto hand-in) rather than dropping them; the attempt is marked `submitted_offline` so the parent can see it.
- **Offline-started attempt, network comes back before hand-in.**
  - Timed, device-started: stays device-driven (device countdown, outbox) until it is handed in, even if the network returns. The work adapter remembers the attempt's origin (`"server"` or `"device"`) and never calls `submitAttempt` for a device-started one.
  - Untimed: when the network returns, the next autosave calls `saveDraft`, which creates the server draft; `saveDraft` gets an optional `startedAt` (corrected device time, clamped to `[availableFrom, now]`) used only when it inserts a new row. From then on it behaves like a normal online draft, so the parent sees "đang làm".
- **Shared device.** Not supported: each child has their own device (project premise). The pack and outbox are still keyed by student id, and outbox items for a child other than the cookie's child are left alone until that child signs in.

## 5. Service worker

Recommended: Serwist, as the Next 16.4 PWA guide suggests (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`, Turbopack example around line 674); a hand-written `public/sw.js` is acceptable if Serwist doesn't fit the build. Builder's call. Follow the guide: register with `{ scope: "/", updateViaCache: "none" }`; serve `/sw.js` with `Cache-Control: no-cache, no-store, must-revalidate` (add `headers()` in `next.config.ts`).

Caching rules:

- Precache / cache-first: `/_next/static/*`, `/mathlive/fonts/*`, `/sounds/*`, icons, manifest.
- Navigations (`request.mode === "navigate"`): network-first. On network failure, under `/student/*` or `/`: serve the cached `/offline` page. Parent routes: no fallback beyond a plain "Không có mạng" page. Never cache HTML of dynamic pages (they carry per-child data and the RSC payload).
- RSC / Server Action requests (`RSC` header, `Next-Action` header, POST): never cached, pass through.
- New deploy: activate the new worker on next load (`skipWaiting` + `clientsClaim`), clean old precaches. The parent must never be stuck on stale UI.

`src/proxy.ts` matcher must exclude `/sw.js`, `/offline` and `/mathlive/` so the worker and the offline shell load without the PIN check. The offline page holds no data itself; it reads IndexedDB.

**`/offline` page** (`src/app/offline/page.tsx`, outside the `(app)` group so it can be static): a client screen "Làm bài offline" in the app's visual style listing downloaded assignments for the last signed-in child (stored with the pack), each with status: Chưa làm / Đang làm / Chờ gửi / Mở lúc …. Tapping one opens the take screen in the same page (client state, not a server route), using the work adapter in offline mode. When the network returns, a banner offers "Về trang chính" (full reload) and the outbox sync runs.

Already-open app going offline:

- On the take page, the work adapter handles everything; nothing else changes.
- Navigating from Today/Assignments to a take page while offline: `useAppNavigation().navigate` checks connectivity (a failed RSC fetch or `navigator.onLine === false`) and, for a downloaded assignment, does a full navigation to `/offline?a=<id>` (served by the worker), which opens that assignment directly.
- Not enabling `experimental.useOffline` (Next's pending-navigation retry): it makes Server Actions hang instead of reject while offline, which breaks the adapter's fallback. *(Claude's call; revisit if it stops being experimental.)*

Safari note: script-writable storage (IndexedDB, service worker caches) of a site **not** added to the home screen may be wiped after 7 days without a visit. Daily use avoids this; the parent screen shows a one-time tip to add the app to the home screen.

## 6. UI

Follow the existing visual language and sounds; all text in Vietnamese.

- Student cards (Today, Assignments): small "Đã tải ✓" chip when the pack entry is complete; "Cần có mạng" for paper work; "Chờ gửi" for outbox items (the card shows as submitted locally, with no score).
- Offline banner at the top of the student shell: "Đang không có mạng — bài làm được lưu trên máy". "Chờ gửi (n)" next to it when the outbox isn't empty; "Đã gửi n bài" toast after sync.
- Save indicator on the take page: "Đã lưu trên máy" when offline.
- Offline hand-in screen: confirmation with the usual submit animation/sound, text "Đã nộp — sẽ gửi khi có mạng", no score, button back to the list.
- Parent: "Nộp offline" chip on the grading queue item and the attempt detail when `submitted_offline`.
- Parent home or Students page: one-time tip how to add to home screen on the child's iPad.

## 7. Testing

- Unit (`src/lib/offline/*.test.ts`): time clamping and timed acceptance rules, outbox merge/idempotency decisions, pack diffing (keep entries with local work), local-vs-server draft choice.
- Server action tests follow the existing pattern for actions, if any; otherwise cover the rules through the pure helpers.
- E2E (Playwright WebKit, `context.setOffline(true)`): open Today online → wait for "Đã tải ✓" → go offline → open an assignment, answer, hand in → see "sẽ gửi khi có mạng" → go online → result appears graded; parent sees "Nộp offline". A timed variant: start offline, let a 1-minute limit run out, go online, attempt is handed in with the answers. Playwright's WebKit service-worker support is limited; test the cold-start `/offline` path in Chromium or manually on an iPad, and say so in the PR.
- Manual on a real iPad: Safari tab, airplane mode, reload → offline screen; home-screen install.

## 8. Left to the builder

- Serwist vs hand-written worker; IndexedDB helper library.
- Exact pack refresh triggers and cadence (within the spirit above).
- How the work adapter is shaped (interface vs props) as long as `TakeAssignment`'s online behaviour is unchanged.
- Visual details of chips, banner and the offline screen within the existing design.
- Splitting the work into tasks; a sensible order is: migration + sync action and rules → work adapter + outbox (in-app offline) → pack download + "Đã tải ✓" → service worker + `/offline` cold start → parent label + tips → E2E.
