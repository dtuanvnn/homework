# Multiple students and school years — design

Date: 2026-10-15 · Status: approved design, not implemented

## Goal

One parent (or tutor) manages several children, each on their own device, and each child's history is kept per school year when they move up a grade. The data model and access layer are built so a later move to real multi-tenant accounts (many families, real login) only adds authentication instead of rewriting every table and query.

Today: one student is assumed everywhere. `getStudent()` (`server/queries.ts`) returns the first `students` row; `students.grade` / `className` are overwritten on promotion; `rewards`, `reward_redemptions`, `star_adjustments`, `badge_seen` have no owner; the PIN gate (`lib/pin.ts`, `proxy.ts`) compares the `hh_pin` cookie with hashes of `APP_PIN` / `PARENT_PIN` from env. A large mode toggle (`ModeToggle`) sits in the sidebar and phone app bar in both modes.

Success: the tutor adds a second child with an avatar and PIN; on the child's iPad the child taps their avatar, enters their PIN and from then on sees only their own work, stars and badges. The parent switches the "viewing" child from the header, assigns one set to two children at once, grades each child's queue. In September the parent presses "Lên lớp": the child is now in grade 4, Reports and Calendar default to 2026–2027, and the 2025–2026 year is still viewable. A child can't reach the parent screens by tapping around.

### Decisions made with the user

- Scope "tutor" (option 2): one household, several children, each on their own device; no accounts. Built tenant-ready: a `households` table (one row for now), `household_id` on root tables, one `getContext()` helper all reads and writes go through.
- Parent UI: a "viewing child" picker in the header; every existing parent screen filters by that child (option A). The exercise library and rewards catalogue are shared within the household. Assigning can target several children at once.
- School year: per-child enrollment rows; promotion is manual ("Lên lớp"); an assignment's year is derived from its due date, not stored.
- On promotion, stars, badges and streak all carry over (option A). Reports can still be viewed per year.
- Context travels in cookies (approach 1), not in URLs: routes and `typedRoutes` helpers don't change.
- The mode toggle is removed. Student mode: long-press (2 s) the header avatar/logo to reach the parent PIN screen. Parent mode: "Mở chế độ học sinh" lives in the header avatar menu.

### Out of scope

Real accounts, sign-up, many households (later spec; this one only prepares for it). Per-child copies of the library or rewards catalogue. Aggregated "all children" views. Moving sets between households. Automatic promotion by date. PWA and offline work (separate spec, built after this one).

## 1. Data (`src/db/schema.ts`, one migration)

- **`households`** (new): `id uuid pk`, `name text`, `createdAt`. RLS on. The parent PIN stays in env `PARENT_PIN` for now; it moves to this table when accounts arrive.
- **`students`**: add `householdId uuid not null → households (cascade)`, `pinHash text null` (null = no PIN), `archivedAt timestamptz null`. Drop `grade`, `className`.
- **`enrollments`** (new): `id`, `studentId → students (cascade)`, `schoolYear smallint` (start year: 2026 = "2026–2027"), `grade smallint`, `className text null`, `startsOn date`, `createdAt`. Unique `(studentId, schoolYear)`; check `grade between 1 and 12`.
- **`exercise_sets`, `rewards`**: add `householdId not null`. Index `(householdId, subject, grade)` replaces `exercise_sets_subject_grade_idx`.
- **`reward_redemptions`, `star_adjustments`, `badge_seen`**: add `studentId not null → students (cascade)`. `badge_seen` primary key becomes `(studentId, badgeId)`. `reward_redemptions_one_pending_idx` becomes `(studentId, rewardId) where status = 'pending'`.
- Child rows (`questions`, `attempts`, `answers`, `attachments`) need no new column: they reach the household through their set or assignment.
- **Migration** (hand-edited SQL after `pnpm db:generate`): insert one household; set `household_id` on all students, sets and rewards to it; set `student_id` on redemptions, adjustments and badge_seen to the oldest student; insert one enrollment per student from the old `grade` / `class_name` with `school_year` = the start year of the current school year and `starts_on` = that year's 5 September; then add the not-null constraints and drop the old columns.
- **Storage paths stay as they are** (`{folder}/{ownerId}/…`, where the owner is a set or attempt). Ownership is checked through the owner row instead of a household prefix: `createUploadTargets` / `isUploaded` callers must first verify that the set or attempt belongs to the context's household (and, for attempts in student mode, to the child). Signed read URLs are only issued for paths found on rows already filtered by context.

### School-year logic (pure, `src/lib/school-year.ts`, tested)

```ts
type Enrollment = { schoolYear: number; grade: number; className: string | null; startsOn: string }
currentEnrollment(enrollments: Enrollment[], today: string): Enrollment | null
  // the latest startsOn ≤ today; falls back to the earliest if all are in the future
yearRange(enrollments: Enrollment[], schoolYear: number): { from: string; to: string | null }
  // from = its startsOn, to = next enrollment's startsOn (exclusive), null for the latest
yearOf(enrollments: Enrollment[], dueAt: Date): number | null   // which year a due date falls into
suggestPromotion(current: Enrollment, today: string): Enrollment
  // grade + 1, schoolYear + 1, startsOn = 5 Sep of that year (or today if later), className: null
schoolYearLabel(schoolYear: number): string                     // "2026–2027"
```

## 2. Access, PIN token and context

### Signed token (`src/lib/session-token.ts`, pure, Web Crypto so it runs in the proxy)

- The `hh_pin` cookie holds `base64url(json).base64url(hmac)`, HMAC-SHA256 with env `SESSION_SECRET` (required in production; dev falls back to a fixed value with a warning). Payload `{ v: 1, role, householdId, studentId?, iat }`.
- `signToken(payload, secret)`, `verifyToken(value, secret): Payload | null`. Lifetime: student 180 days, parent 30 days (`iat`-based).
- When no PIN is configured for a mode (parent: `PARENT_PIN` empty; student: the chosen child has no `pinHash`), entering that mode still issues a token so the server knows the household and child.

### PIN flow (`server/actions/pin.ts`, `app/pin/*`)

- `/pin?role=parent`: as today, checked against `PARENT_PIN`; issues a parent token for the single household.
- `/pin?role=student`: shows the household's non-archived children as an avatar grid. Tapping one asks for that child's PIN (skipped if none), checked against `pinHash` (`sha256` of `homework-hub:student:{studentId}:{pin}`, compared in constant time). Issues a student token with `studentId`. "Đổi học sinh" on the PIN page returns to the grid.
- No wrong-PIN throttling (none exists today either): PINs keep a child out, they are not account security.

### Proxy (`src/proxy.ts`)

Verifies the token signature and that `role` matches the path (`roleForPath`); `/student/*` also needs `studentId`. No database access. Invalid or missing → `/pin?role=…&next=…` as now. Paths outside both modes accept either role.

### Context (`src/server/context.ts`, `server-only`, memoized per request with React `cache`)

```ts
type Context = { householdId: string; mode: "parent" | "student"; studentId: string }
getContext(): Promise<Context>
```

- Student mode: `studentId` from the token; the row must exist, belong to the household and not be archived, otherwise the cookie is cleared and the PIN page shown.
- Parent mode: `studentId` from cookie `hh_student` if it belongs to the household and isn't archived, else the oldest active child. If the household has no children, parent pages show the "add a child" empty state.
- `assertAccess(role)` returns the `Context`. Every action uses it; **no action accepts a `studentId` or `householdId` from the client** except `setViewingStudent` and `createAssignments` (checked against the household).
- Ownership helpers in `server/ownership.ts`: `assertSetInHousehold(ctx, setId)`, `assertAssignmentInScope(ctx, assignmentId)` (household; in student mode also `studentId`), `assertAttemptInScope(ctx, attemptId)`. Each throws a Vietnamese "Không tìm thấy." when out of scope.
- `getStudent()` is removed. Its replacement `getViewingStudent(ctx)` returns `Student` (from `lib/types.ts`) with `grade` / `className` / `schoolYear` from `currentEnrollment`.

### Queries and rewards scoped by context

- `queries.ts`: `listExerciseSets`, `getQuestions*` filter by household; `listAssignments`, `getAttemptDetail`, `getNavCounts`, `listGradedAnswers`, `loadGradingQueue` filter by `studentId` (assignment join).
- `settleExpiredAttempts()` stays global (it only finalizes expired drafts, no data leaves it).
- `loadRewardFacts(db, studentId)` filters assignments, attempts, adjustments, redemptions and badge_seen by child. `loadRewards()` memo is keyed by child. `requestRedemption` takes the advisory lock `pg_advisory_xact_lock(REDEEM_LOCK, hashtext(studentId))`.
- AI actions (`ai-summary`, `ai-hints`, `ai-grading`) read through the same scoped queries.

## 3. UI

### Mode switching (removes `ModeToggle` from `Sidebar` and `TopAppBar`)

- **Student mode:** no toggle. Pressing and holding the header avatar/logo for 2 s fills a progress ring around it, then navigates (full page load) to `/pin?role=parent`. Releasing earlier does nothing; no hint or tooltip is shown. Component `components/layout/HoldToOpen.tsx` (pointer events, cancels on move > 10 px or pointerup; respects reduced motion by showing a static fill).
- **Parent mode:** a header avatar button opens a menu: the children list (switch viewing child), "Quản lý học sinh", and "Mở chế độ học sinh" (full page load to `/student`, which asks for a child via the PIN grid).

### Viewing child (parent)

- Header avatar shows the viewing child's emoji and name; the menu lists active children with grade label ("Lớp 4"). Choosing one calls `setViewingStudent(id)` (parent access, checks household, sets `hh_student`, `refresh()`). With one child the menu shows no list, just the other items.
- `AppFrame` / `useStudent()` expose the viewing child, its current enrollment and the household's children list.

### Students page (`/parent/students`, entry in `SUB_PAGE_TITLES`, helper in `routes.ts`)

- List of children (avatar, name, "Lớp 4 · 4C1 · 2026–2027"), archived ones collapsed at the bottom with "Khôi phục".
- Add / edit sheet: name, avatar emoji picker (existing emojis), PIN (4–6 digits, optional; "Xoá PIN"), first enrollment (grade, class name, school year) when adding.
- Child detail: enrollments by year (edit class name / start date of any year), **"Lên lớp"** sheet prefilled from `suggestPromotion` (grade, class name, school year, start date, all editable), "Lưu trữ học sinh" (hides from pickers and PIN grid; data kept; assignments not deleted).
#### Screens

Entry points: the parent header avatar menu ("Quản lý học sinh"), and the "add a child" empty state. Same visual language as the rest of the app (cards, sheets from the bottom on phone / centered dialog on iPad, existing motion and sounds).

**A. Students list** — `/parent/students`

```
┌─ ← Học sinh ───────────────────────────── [+ Thêm học sinh] ┐
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🦊  Minh An                      Đang xem ✓              │ │
│ │     Lớp 4 · 4C1 · 2026–2027      ⭐ 128   🔒 Có PIN    › │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🐼  Bảo Ngọc                                             │ │
│ │     Lớp 5 · 5A2 · 2026–2027      ⭐ 40    🔓 Không PIN  › │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ▸ Đã lưu trữ (1)                                             │
└──────────────────────────────────────────────────────────────┘
```
Tapping a card opens C. Archived children expand under "Đã lưu trữ" with a "Khôi phục" button each.

**B. Add / edit child** — sheet

```
┌─ Thêm học sinh ─────────────────────────────────────── ✕ ┐
│ Ảnh đại diện   🦊 🐼 🐰 🐯 🦁 🐸 🐨 🐧 🦄 🐙   (chọn 1)     │
│ Tên            [ Bảo Ngọc                      ]          │
│ Lớp            [1][2][3][4][5][6][7]  (chip)              │
│ Tên lớp        [ 5A2            ]  (không bắt buộc)       │
│ Năm học        [ 2026–2027  ▾ ]                           │
│ Mã PIN         [ • • • • ]  4–6 số, để trống = không PIN  │
│                                                           │
│                              [ Huỷ ]   [ Thêm học sinh ] │
└───────────────────────────────────────────────────────────┘
```
Editing shows only avatar, name and PIN ("Đổi mã PIN" / "Xoá PIN"); grade, class and year are edited per year in C. The PIN is shown once as dots with a reveal eye while typing; it is never shown again after saving.

**C. Child detail** — `/parent/students/[id]` (entry in `SUB_PAGE_TITLES`)

```
┌─ ← Bảo Ngọc ────────────────────────────────── [Sửa] ┐
│  🐼  Bảo Ngọc        ⭐ 40 sao · 🔥 5 ngày · 🏅 3       │
│  [ Xem như đang chọn ]        [ 🎓 Lên lớp ]          │
│                                                        │
│  Các năm học                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 2026–2027 · Lớp 5 · 5A2 · từ 05/09/2026  Hiện tại ✎│ │
│  │ 2025–2026 · Lớp 4 · 4A1 · từ 05/09/2025          ✎│ │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [ Lưu trữ học sinh ]  (đỏ nhạt, hỏi xác nhận)         │
└────────────────────────────────────────────────────────┘
```
"Xem như đang chọn" sets the viewing child and goes to Today. ✎ opens a small sheet to edit grade, class name and start date of that year.

**D. Promote** — sheet from "Lên lớp"

```
┌─ Lên lớp cho Bảo Ngọc ──────────────────────────── ✕ ┐
│ Lớp 5 (2026–2027)  →  Lớp [6] (2027–2028)             │
│ Tên lớp        [ 6A?            ]                     │
│ Bắt đầu từ     [ 05/09/2027 ]                         │
│ Sao, huy hiệu và chuỗi ngày được giữ nguyên.          │
│ Bài của năm cũ vẫn xem được trong Báo cáo.            │
│                                 [ Huỷ ]  [ Lên lớp 🎉 ] │
└───────────────────────────────────────────────────────┘
```
Confirming plays the existing celebration sound/confetti and returns to C with the new year marked "Hiện tại".

**E. First run / no children** — parent Today (and any parent page) when the household has no active child: a centered card "Chưa có học sinh nào" with an illustration and "Thêm học sinh đầu tiên", opening B. The student PIN grid with no children shows "Nhờ bố mẹ thêm học sinh trước nhé."

- Actions in `server/actions/students.ts` (parent access): `createStudent`, `updateStudent`, `setStudentPin`, `archiveStudent`, `restoreStudent`, `promoteStudent`, `updateEnrollment`, `setViewingStudent`. zod validation; unique school year per child enforced by the DB and reported in Vietnamese.

### Assigning and library

- `AssignSheet`: a "Giao cho" row of child avatar chips (multi-select, default = viewing child; hidden with one child). `createAssignments` inserts one assignment per selected child; all other fields (dates, mode, time limit, chain) are copied. `quickAssign` targets the viewing child.
- Library grade filter defaults to the viewing child's current grade (still changeable). New sets default to that grade and the household.

### Reports and Calendar

- A school-year picker (chips of the child's enrollments, default current) on Reports and the parent Calendar/Schedule. Analytics and lists filter assignments whose `dueAt` falls in `yearRange`. Rewards pages are not filtered by year (stars carry over).

## 4. Seed and tests

- **Seed:** one household; two children ("Minh An", grade 3, PIN unset in dev; "Bảo Ngọc", grade 5) each with an enrollment; An also has a 2025–2026 grade-2 enrollment with a few old graded assignments so the year picker has data. Existing demo data goes to An. Earned badges marked seen per child.
- **Unit (vitest):** `session-token` (sign/verify, tamper, expiry, wrong secret), `school-year` (current, ranges, `yearOf` at boundaries, promotion suggestion), student PIN hashing, `computeRewards` fed with two children's facts not mixing.
- **E2E (Playwright, iPad + iPhone):**
  - Student device: avatar grid → An → PIN → sees only An's assignments; Bảo Ngọc's attempt URL returns "Không tìm thấy".
  - Hold-to-open: short tap on the avatar does nothing; 2 s hold reaches the parent PIN page. No mode toggle visible in student mode.
  - Parent: switch viewing child changes Today/Grading; assign a set to both children → each sees it.
  - Students page: add a child with PIN, archive, restore; "Lên lớp" → Reports shows 2026–2027 by default and 2025–2026 still selectable; stars unchanged after promotion.
- Existing E2E keep passing with the seed's An as the default child.

## 5. Later: multi-tenant

What the later spec adds on top of this one: Supabase Auth (or similar) sessions replacing the signed PIN token as the source of `householdId`; `households.parentPinHash`; sign-up creating a household; an audit that every action goes through `getContext()` + ownership helpers; per-household AI usage limits.
