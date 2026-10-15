# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Homework Hub: a mobile-first (iPad/phone) web app a parent uses to assign, grade and track homework for **one** primary-school child (Grade 3 now, growing to 4–7+; Toán, Tiếng Việt, Tiếng Anh). No authentication — only optional PINs per mode (`APP_PIN` for Student, `PARENT_PIN` for Parent). All UI text is Vietnamese. The UI started as a Figma Make export (prompts in `docs/figma-prompts.md`) and was migrated to Next.js; keep its visual language, animations and sounds when changing screens.

Roadmap: Phase 1 = core flows on a real database. Phase 2 = AI features (DeepSeek or Claude), all in `src/server/actions/ai-*.ts`: scanning images/PDFs into questions (`ai-scan`), AI-generated sets (`ai-generate`), AI grading of essays and scanned paper work (`ai-grading`), AI progress summaries on Reports (`ai-summary`). AI only suggests: scanned/generated sets go through the review/editor UI, and AI marks are applied to the grading form for the parent to confirm with the normal `gradeAttempt` action.

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

Env vars live in `.env.local` (see `.env.example`): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `STORAGE_BUCKET`, `APP_PIN`, `PARENT_PIN`, `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`, `AI_PROVIDER`.

## Architecture

**Routing.** `src/app/(app)/layout.tsx` (server) loads the student, nav badge counts, all exercise sets and assignments, and renders `AppFrame` (client), which owns the shell, `useAppNavigation()` (navigate + unsaved-changes leave guard), `useStudent()` and the `LibraryProvider`. Mode (parent/student) and active tab are derived from the URL (`/parent/...`, `/student/...`) in `src/components/layout/routes.ts`; always build links with its helpers (`TAB_PATHS`, `libraryPaths`, `studentPaths`, `gradingPaths`) because `typedRoutes` is on. New sub-pages need an entry in `SUB_PAGE_TITLES` there.

**Page pattern.** Each `page.tsx` is an async server component that loads data through `src/server/queries.ts`, shapes it with pure builders (`src/lib/views/*`, `src/lib/analytics.ts`), and passes serializable props (plus a `now` ISO string for date math) to a client component in `src/components/pages/`. Read-side DB access goes through `queries.ts`, which returns the UI's own types from `src/lib/types.ts`.

**Mutations.** Server Actions live in `src/server/actions/*`. Each one: calls `assertAccess("parent" | "student")` first (PIN check for the mode it belongs to — actions are reachable by direct POST), validates input with zod, writes via Drizzle, calls `refresh()` from `next/cache`, and returns `ActionResult<T>` via `runAction()` (`src/lib/action-result.ts`) because production Next hides thrown error messages. Client code calls `unwrap(await action(...))`. The library/assignment cache on the client is `src/state/library-store.tsx` (`useLibrary()`), re-synced from layout props after `refresh()`.

**Domain rules that span files.**
- Assignment status is never stored: `deriveAssignmentState()` (`src/lib/assignment-status.ts`) computes scheduled / not-started / in-progress / submitted / graded, overdue and retry eligibility from the assignment, its attempts and the current time. `src/server/views.ts` maps that to the parent-facing status enum.
- An assignment has at most 2 attempts. A draft attempt (no `submittedAt`) holds autosaved answers; submitting grades objective questions on the server with `src/lib/grading.ts` (pure, heavily tested); essays and all paper work leave `isCorrect = null` until the parent grades, and the parent's grade recomputes the score server-side. Scores are on a 10-point scale in quarter points.
- PIN gate (`src/lib/pin.ts`, `src/proxy.ts`): the `hh_pin` cookie holds a hash of the last PIN entered and opens one mode at a time; `/parent/*` needs the parent PIN, `/student/*` the student PIN, and switching modes is a full page load that asks again.
- The child sees correct answers only once no retry is left (`answersRevealed` in `buildResultDetail`); until then wrong answers show AI hints (`explainMistakes` in `ai-hints.ts`, saved in `answers.hint`, filtered by `leaksAnswer()`), and parent-only actions such as `loadQuestions` return answer keys, so they must stay `assertAccess("parent")`.
- `answers.question` snapshots the question at submit time, so results and analytics survive later edits to a set. Analytics read skills from those snapshots.
- Question JSON shapes are the `Question` union in `src/lib/types.ts`, stored in `questions.content`; runtime validation is `src/lib/question-schema.ts`. Student response shapes per type are documented at the top of `src/lib/grading.ts`.
- Question text may contain LaTeX between `$…$` (`\$` is a literal dollar). Always render question text with `components/question/RichText` (KaTeX, `trust: false`) and figures with `QuestionPicture`; `lib/rich-text.ts` does the splitting.
- `tra-loi-ngan` / `dien-cho-trong` with `math: true` store LaTeX answer keys (no `$`), show the MathLive keyboard (`take/MathAnswerInput`, lazy-loaded, fonts in `public/mathlive/fonts`) and grade by exact value with `lib/math-answer.ts` (6/8 = 3/4 = 0,75); `simplest: true` also requires lowest terms.
- Answer keys can come later. `question.answerStatus`: absent = entered by the parent or read from the document; `"missing"` = scanned without a key (answer fields hold placeholders, `question-schema` accepts an empty short answer, `gradeQuestion` leaves non-blank responses for the parent, the editor shows no choice); `"ai"`/`"ai-check"` = solved by "Giải đáp án" (`ai-solve.ts`, one question per call, applied by `lib/ai/solve.ts` and saved straight away). `question.solution` is shown to the parent and to the child once answers are revealed; `toTakeQuestion` strips both. A scan only transcribes unless the parent ticks "Tài liệu có sẵn lời giải" (`ScanMeta.withSolutions`), which reads printed answers and solutions instead of solving. Snapshots taken without a key pick up a later one via `withLaterAnswerKey` in `getAttemptDetail` (not for matching/ordering, whose responses point at positions).
- Handwritten essays: `EssayValue.ink` holds vector strokes on fixed 1000×700 pages (`lib/ink.ts`, validated by `inkSchema`); the same `strokePath` draws the take canvas (`components/ink/InkEditor`), the grading/result SVGs (`HandwritingView`) and the PNGs rendered with resvg only for AI grading (`server/ai/ink-image.ts`). Old answers may still carry a PNG data URL in `drawing`; every reader handles both.
- Figures: `question.image = { path, width, height }` points at `sets/{setId}/{uuid}-figure.jpg`. The scanner returns a 0–1000 box per figure (`lib/figure-crop.ts`); AI boxes are only roughly right, so the browser snaps each one to the ink on the page (`snapBox`) before cropping and uploading it (`lib/figure-client.ts`), and the review step lets the parent adjust it (manual boxes are cut exactly, no snap or padding). Display paths through `getQuestionsWithImages` / `getAttemptDetail`, which add a signed `imageUrl`; `getQuestions` stays raw because attempts snapshot it. `saveExerciseSet` / `deleteExerciseSet` delete figure objects that no question, answer snapshot or attachment references.

**Files.** Photos and PDFs go straight from the browser to a private Supabase Storage bucket using one-time signed upload URLs (`createUploadTargets` in `src/server/storage.ts` + `uploadFiles` in `src/lib/upload-client.ts`); the server only records paths after checking `isUploaded`. Never route file bodies through Server Actions (Vercel caps request bodies at ~4.5 MB; the action body limit stays 4 MB for drafts that still carry legacy handwriting data URLs). The browser only ever sees signed URLs.

**AI.** Every model call goes through `ask()` in `src/server/ai/llm.ts`, which returns an object validated by a zod schema and throws Vietnamese error messages. Two providers via `AI_PROVIDER` (default: DeepSeek when `DEEPSEEK_API_KEY` is set): DeepSeek `deepseek-flash` through its Anthropic-compatible endpoint, where the schema is sent as a forced tool and the tool input is validated (one retry), images only — no PDFs; or Claude with structured outputs and refusal fallback. PDFs are split into page images in the browser (`src/lib/pdf-client.ts`) before scanning. Prompts, output schemas and response mapping live as pure, tested code in `src/lib/ai/*`; question output uses the flat `aiQuestionSchema` and `toQuestion()` (repairs + confidence capping). Scans are sent from Storage via `storageFileBlocks()`; photos are downscaled in the browser with `shrinkImage()` before upload. Pages whose actions call AI export `maxDuration = 300`.

**Database.** Drizzle + node-postgres (`pg`) against Supabase Postgres (`src/db/schema.ts`, migrations in `drizzle/`). RLS is enabled on every table with no policies, so nothing is reachable through Supabase's public REST API; the app connects directly from the server. In production use Supabase's **transaction** pooler (port 6543): the session pooler caps clients at 15, which serverless instances exhaust, and postgres-js (still used by `src/db/seed.ts`) pipelines queries, which the transaction pooler hangs on; `pg` doesn't (see `src/db/index.ts`).

## Gotchas

- Time zone: "today", due times and week boundaries are Vietnam time. `src/instrumentation.ts` sets `process.env.TZ = "Asia/Ho_Chi_Minh"` on the server; scripts set it themselves (see `src/db/seed.ts`). Local-time helpers in `src/lib/dates.ts` rely on this.
- `db.execute()` returns a node-postgres result (`.rows`); pass dates in raw `sql` templates as `date.toISOString()`.
- Supabase cloud Storage rejects the new `sb_secret_…` keys ("Invalid Compact JWS"): `SUPABASE_SECRET_KEY` in production must be the legacy `service_role` JWT. The local stack accepts either.
- Test files can't import modules that import `"server-only"`; keep testable logic in `src/lib/`.
- Don't add mock data for screens — load real data.
- E2E and `pnpm db:seed` wipe the local database.
