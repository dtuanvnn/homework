# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Homework Hub: a mobile-first (iPad/phone) web app a parent uses to assign, grade and track homework for **one** primary-school child (Grade 3 now, growing to 4–7+; Toán, Tiếng Việt, Tiếng Anh). No authentication — only an optional `APP_PIN` gate. All UI text is Vietnamese. The UI started as a Figma Make export (prompts in `docs/figma-prompts.md`) and was migrated to Next.js; keep its visual language, animations and sounds when changing screens.

Roadmap: Phase 1 (current) = core flows on a real database. Phase 2 = Claude API features: scanning images/PDFs into questions, AI-generated sets, AI grading of scanned handwriting, AI progress summaries. Until then the upload "scan" (`src/data/scan-mock.ts`) and AI generation (`src/data/generate-mock.ts`) are simulated, and the Reports summary is rule-based.

## Commands

```bash
pnpm exec supabase start      # local Postgres + Storage in Docker (needed for dev, seed, e2e)
pnpm db:migrate               # apply drizzle/ migrations
pnpm db:seed                  # reset DB to demo data (refuses non-local DATABASE_URL without --force)
pnpm dev                      # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build

pnpm test src/lib/grading.test.ts             # one unit test file
pnpm test -t "short answer"                   # tests matching a name
pnpm test:e2e                                 # Playwright (WebKit iPad + iPhone); reseeds the DB first
pnpm exec playwright test e2e/smoke.spec.ts --project=ipad

pnpm db:generate              # after editing src/db/schema.ts, then review the SQL in drizzle/
```

Env vars live in `.env.local` (see `.env.example`): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `STORAGE_BUCKET`, `APP_PIN`.

## Architecture

**Routing.** `src/app/(app)/layout.tsx` (server) loads the student, nav badge counts, all exercise sets and assignments, and renders `AppFrame` (client), which owns the shell, `useAppNavigation()` (navigate + unsaved-changes leave guard), `useStudent()` and the `LibraryProvider`. Mode (parent/student) and active tab are derived from the URL (`/parent/...`, `/student/...`) in `src/components/layout/routes.ts`; always build links with its helpers (`TAB_PATHS`, `libraryPaths`, `studentPaths`, `gradingPaths`) because `typedRoutes` is on. New sub-pages need an entry in `SUB_PAGE_TITLES` there.

**Page pattern.** Each `page.tsx` is an async server component that loads data through `src/server/queries.ts`, shapes it with pure builders (`src/lib/views/*`, `src/lib/analytics.ts`), and passes serializable props (plus a `now` ISO string for date math) to a client component in `src/components/pages/`. Read-side DB access goes through `queries.ts`, which returns the UI's own types from `src/lib/types.ts`.

**Mutations.** Server Actions live in `src/server/actions/*`. Each one: calls `assertAccess()` first (PIN check — actions are reachable by direct POST), validates input with zod, writes via Drizzle, calls `refresh()` from `next/cache`, and returns `ActionResult<T>` via `runAction()` (`src/lib/action-result.ts`) because production Next hides thrown error messages. Client code calls `unwrap(await action(...))`. The library/assignment cache on the client is `src/state/library-store.tsx` (`useLibrary()`), re-synced from layout props after `refresh()`.

**Domain rules that span files.**
- Assignment status is never stored: `deriveAssignmentState()` (`src/lib/assignment-status.ts`) computes scheduled / not-started / in-progress / submitted / graded, overdue and retry eligibility from the assignment, its attempts and the current time. `src/server/views.ts` maps that to the parent-facing status enum.
- An assignment has at most 2 attempts. A draft attempt (no `submittedAt`) holds autosaved answers; submitting grades objective questions on the server with `src/lib/grading.ts` (pure, heavily tested); essays and all paper work leave `isCorrect = null` until the parent grades, and the parent's grade recomputes the score server-side. Scores are on a 10-point scale in quarter points.
- `answers.question` snapshots the question at submit time, so results and analytics survive later edits to a set. Analytics read skills from those snapshots.
- Question JSON shapes are the `Question` union in `src/lib/types.ts`, stored in `questions.content`; runtime validation is `src/lib/question-schema.ts`. Student response shapes per type are documented at the top of `src/lib/grading.ts`.

**Files.** Photos and PDFs go straight from the browser to a private Supabase Storage bucket using one-time signed upload URLs (`createUploadTargets` in `src/server/storage.ts` + `uploadFiles` in `src/lib/upload-client.ts`); the server only records paths after checking `isUploaded`. Never route file bodies through Server Actions (Vercel caps request bodies at ~4.5 MB; the action body limit is 4 MB for handwriting data URLs). The browser only ever sees signed URLs.

**Database.** Drizzle + postgres-js against Supabase Postgres (`src/db/schema.ts`, migrations in `drizzle/`). RLS is enabled on every table with no policies, so nothing is reachable through Supabase's public REST API; the app connects directly from the server. In production use Supabase's **session** pooler (port 5432): postgres-js pipelines queries and the transaction pooler (6543) hangs on them (see `src/db/index.ts`).

## Gotchas

- Time zone: "today", due times and week boundaries are Vietnam time. `src/instrumentation.ts` sets `process.env.TZ = "Asia/Ho_Chi_Minh"` on the server; scripts set it themselves (see `src/db/seed.ts`). Local-time helpers in `src/lib/dates.ts` rely on this.
- Raw `sql` templates with postgres-js reject `Date` parameters; pass `date.toISOString()`.
- Test files can't import modules that import `"server-only"`; keep testable logic in `src/lib/`.
- `src/data/*` only holds the Phase 2 placeholders (scan/generate mocks); don't add mock data for screens — load real data.
- E2E and `pnpm db:seed` wipe the local database.
