# Streaks, badges, stars and rewards — design

Date: 2026-10-15 · Status: approved design, awaiting implementation plan

## Goal

Keep the child doing homework regularly and carefully. Stars (already shown) become a spendable balance; the parent sets real-life rewards ("📺 Xem TV 30 phút") the child buys with stars; streaks reward finishing every due assignment on time; badges celebrate milestones.

Today: `starsFor(score)` (`src/lib/grading.ts`) gives 0–3 stars per graded attempt and `getStudent()` sums them over **every** graded attempt into `totalStars`; `streakDays()` (`src/lib/views/student.ts`) counts consecutive days with any submission. Nothing is stored, there are no badges and no rewards.

Success: the parent creates a few rewards; the child sees their balance, streak and badges on a "Phần thưởng" tab, requests a reward, and the parent hands it over or declines from the dashboard; regrading an attempt updates the balance; a new badge or streak milestone is celebrated exactly once.

### Decisions made with the user

- Redemption: the child requests, the stars are held, the parent marks it "Đã trao" (given) or "Từ chối" (declined, stars return). The child may cancel their own pending request.
- Streak: only days with something due count. A day counts when every assignment due that day had its first attempt submitted by its due time; a day with nothing due is skipped.
- Star sources: score stars + streak milestone bonuses + parent adjustments (± with a reason). Badges give no stars (avoids star inflation).
- Score stars come from **attempt 1 only**, from its current score: when the parent regrades an AI-graded (or any) first attempt, its stars follow the new score. Attempt 2 never earns stars. This lowers existing totals, which today also count attempt 2.
- Badges: a fixed catalog in code, awarded automatically.
- Rewards: name, emoji, cost, active switch; unlimited redemptions; at most one pending request per reward.
- Architecture: everything derivable is computed from assignments/attempts (like `deriveAssignmentState()`); only facts that can't be derived are stored.

### Out of scope

Weekly limits or stock per reward, parent-defined badges, streak freezes, push notifications, multiple students.

## 1. Data

New tables in `src/db/schema.ts`, all `.enableRLS()` with no policies. No `studentId`: the app has one student; adding it later is a single migration.

```ts
rewards            { id uuid pk, name text, emoji text, cost integer check > 0,
                     active boolean default true, position integer, createdAt }
reward_redemptions { id uuid pk, rewardId uuid → rewards (on delete set null),
                     name text, emoji text, cost integer,          // snapshot at request time
                     status enum('pending','given','declined'),
                     requestedAt timestamptz, decidedAt timestamptz null }
                   unique index (rewardId) where status = 'pending'
star_adjustments   { id uuid pk, amount integer check <> 0, reason text not null, createdAt }
badge_seen         { badgeId text pk, seenAt timestamptz }
```

A cancelled request is deleted (it never happened). `badge_seen` also records streak milestones with ids like `streak-7@2026-10-20` so the celebration runs once per milestone reached.

## 2. Rules (pure, in `src/lib/rewards/`)

All functions take plain records plus `now` and are unit tested. Days are Vietnam calendar days (`src/lib/dates.ts`).

**`streak.ts` — `streakRuns(assignments, now)`** returns `{ current, longest, milestones: { days, reachedOn }[] }`.
- Group assignments with `availableFrom <= dueAt` by the day of `dueAt`.
- Past day: counts if every assignment that day has attempt 1 with `submittedAt <= dueAt`; otherwise the run breaks.
- Today: counts if all are submitted on time; breaks if one is already past due without an on-time submission; otherwise neutral (doesn't count, doesn't break).
- Days with nothing due are skipped. Future days are ignored.
- Replaces `streakDays()`; `buildToday()` uses `current`.

**`stars.ts`**
- Score stars: for each assignment whose attempt 1 is graded, `starsFor(attempt1.score)` dated `attempt1.gradedAt`.
- Milestone bonus: each run reaching 3 / 7 / 14 / 30 days earns +5 / +10 / +20 / +50; then +50 at every further multiple of 30 (60, 90, …). A new run after a break earns them again. Dated the day reached.
- `starLedger(facts)` returns `{ balance, earned, entries }` where entries are `{ at, amount, label, kind: 'score' | 'streak' | 'adjust' | 'redeem' }` sorted newest first.
- `balance = score stars + milestone bonuses + adjustments − cost of pending and given redemptions`. It may be negative (regrade down, parent deduction).
- `canRedeem(balance, reward, hasPending)` → `null` or a Vietnamese error ("Con chưa đủ sao", "Phần thưởng này đang tạm ẩn", "Con đã gửi yêu cầu này rồi, chờ bố mẹ nhé").

**`badges.ts`** — `BADGES: { id, name, emoji, description, hint, earnedAt(facts): Date | null }[]`:

| id | Badge | Earned when |
|---|---|---|
| `first-submit` | 🎒 Bài đầu tiên | first submitted attempt |
| `streak-3` / `streak-7` / `streak-30` | 🔥 Chuỗi 3 / 7 / 30 ngày | any run reaches that length |
| `first-ten` | 💯 Điểm 10 đầu tiên | first graded attempt with score 10 |
| `ten-tens` | 🏆 10 bài điểm 10 | 10th attempt scoring 10 |
| `toan-20` / `tieng-viet-20` / `tieng-anh-20` | 🔢 Chăm Toán / 📖 Chăm Tiếng Việt / 🌍 Chăm Tiếng Anh | 20 submitted assignments in the subject |
| `comeback` | 📈 Tiến bộ | attempt 2 score ≥ attempt 1 score + 2 |
| `pen-10` | ✍️ Ngòi bút chăm chỉ | 10 submitted attempts with handwriting ink |
| `fifty` | 🌟 50 bài hoàn thành | 50 submitted assignments |

`newBadges(earned, seenIds)` returns earned badges and milestones not yet in `badge_seen`.

## 3. Server

**Queries (`src/server/queries.ts`).** `getRewardFacts()` loads assignments with attempts (number, score, submitted/graded times, subject, has-ink flag), adjustments, redemptions and seen ids; builders in `src/lib/rewards/` shape them. `getStudent().totalStars` becomes the **balance**, so `StarCount` and the Today header need no change. The `(app)` layout adds `pendingRedemptions` to the nav counts (badge on the parent "Tổng quan" tab).

**Actions (`src/server/actions/rewards.ts`)**, each `assertAccess` → zod → Drizzle → `refresh()` → `runAction`:

| Action | Access | Behaviour |
|---|---|---|
| `saveReward`, `reorderRewards` | parent | create/edit (name, emoji, cost, active), set order |
| `deleteReward` | parent | deletes if never redeemed, otherwise sets `active = false` |
| `requestRedemption(rewardId)` | student | in one transaction: `pg_advisory_xact_lock(<constant>)`, recompute balance server-side, `canRedeem`, insert snapshot row |
| `cancelRedemption(id)` | student | deletes a `pending` request |
| `decideRedemption(id, 'given' \| 'declined')` | parent | only from `pending`; sets `decidedAt` |
| `adjustStars(amount, reason)` | parent | integer ≠ 0, reason required |
| `markBadgesSeen(ids)` | student | upsert into `badge_seen` |

The advisory lock serializes concurrent requests (double tap), so stars can't be overspent.

## 4. UI

**Student (playful, animations + sounds from `lib/animations.ts` / `useSound`).**
- New 4th tab "Phần thưởng" (`/student/rewards`, `Gift` icon; `rewards` in `TAB_PATHS` and `STUDENT_NAV`). The "Kết quả" tab description drops "huy hiệu".
  - Header: ⭐ balance (count-up), 🔥 current and longest streak, next milestone ("Còn 2 ngày nữa đến mốc 7 ngày (+10 ⭐)").
  - Shop: big card per active reward (emoji, name, cost); "Đổi" when affordable, otherwise a progress bar "Còn thiếu 12 ⭐"; confirm dialog, then animation + sound.
  - "Đang chờ bố mẹ": pending requests with "Hủy".
  - Badges: grid, earned in color with date, locked in grey with the hint.
  - "Lịch sử sao": compact ledger ("+3 Bảng nhân 8", "+10 Chuỗi 7 ngày", "−30 Xem TV").
- Celebration: the student shell shows a confetti + sound overlay for new badges/milestones (from layout props), then calls `markBadgesSeen`.
- Result screen: "+N sao" only on attempt 1; attempt 2 shows "Lần làm lại không tính sao".

**Parent (calm, no sound).**
- Dashboard card "Phần thưởng": balance, streak, pending requests with "Đã trao" / "Từ chối" inline, link to the page below.
- Sub-page `/parent/rewards` (`parentPaths.rewards`, `SUB_PAGE_TITLES` entry, back to Tổng quan): reward list editor (add/edit/toggle/reorder), "Cộng/trừ sao" form with reason, redemption history, full star ledger.

## 5. Testing, seed, rollout

- Unit (vitest): streaks (weekend gaps, late submission, today pending/overdue, several assignments per day, re-reaching milestones after a break, VN day boundary); stars (attempt 1 only, regrade changes stars, attempt 2 ignored); balance (pending/given/declined/cancelled, negative); `canRedeem`; badge dates; `newBadges`.
- E2E (Playwright, iPad + iPhone): parent creates a reward → child requests → parent marks given → balance drops; decline refunds; parent adjustment; badge celebration shows once; double-tapping "Đổi" creates one request.
- Seed: rewards "📺 Xem TV 30 phút" 20, "🎮 Chơi game 1 giờ" 40, "🍦 Đi ăn kem" 50, "📚 Mua truyện mới" 80; one pending request; one adjustment; demo history yields a streak and a few badges.
- Rollout: one additive migration. Production star totals drop once (attempt 2 no longer counts).
