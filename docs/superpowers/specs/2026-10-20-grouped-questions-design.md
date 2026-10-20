# Grouped questions (Bài có nhiều câu con) — design, phase 1

Date: 2026-10-20 · Status: approved design, not yet planned · Backlog: `docs/backlog.md` → "Bài có nhiều câu hỏi con (kèm bài đọc)"

## Goal

Real worksheets are organised as exercises ("Part 3. Complete the sentences with the correct subject or object pronoun." followed by ten sentences). Today each sentence is a flat `Question`, and the scanner copies the shared instruction (and shared figure) into every question. On the take screen the child reads the same instruction ten times and never sees that the sentences belong together; grading and results are not grouped either.

Phase 1 adds the **grouping layer**: a parent can turn consecutive questions of an existing set into one **bài** (shared prompt + optional shared figure + label) with **câu con** underneath, either by one-tap auto-detection or by hand. Then the take, grading and result screens show the bài once with its câu con below.

### Reference set (the user's live draft)

"Advanced Worksheet 3 – Life in the Wild" (`/parent/library/49a641ac-781a-4288-b5a0-09628a0c2906`, English, grade 3, 25 questions, 33 points), as scanned today:

| Paper | In the app now | Repeated in each prompt |
|---|---|---|
| Part 1 – replace the bold words | Q1–9, `tra-loi-ngan`, 1 pt each | first line "Replace the bold words using the word in the box (strong, patient, …):" |
| Part 2 – passage "Life in the Wild" | Q10, one `dien-cho-trong` with 9 blanks, 9 pts | — |
| Part 3 – pronouns | Q11–20, `dien-cho-trong`, 1 pt each | first line "Part 3. Complete the sentences with the correct subject or object pronoun." |
| Part 4 – write about the table | Q21–25, `tu-luan`, 1 pt each | first line "Part 4. Read and write." **and the same figure** (`…/1051d6f3-…-figure.jpg`) |

Success: the parent opens this draft, taps "Tự chia bài", sees a preview of 3 bài (Q1–9 "Bài 1", Q11–20 "Part 3", Q21–25 "Part 4" with the table figure as shared figure), applies it, saves. The child taking it sees "Part 3" with the instruction once in a box above "Câu 11 · David is very kind to his little sister. ___ always helps ___ with her homework.", moving through Câu 11…20 under the same box. The parent's grading screen and the child's result show "Part 3 · 8/10" with the ten câu con below. Q10 stays a standalone question.

### Decisions made with the user

- Settled in the backlog (still valid): a bài = shared part (instruction / passage / figure) + several câu con of any type, mixed; standalone questions stay as now; câu con are numbered continuously across the whole set (Bài 1 has câu 1–9, the next bài continues at 10…); grading stays per câu con (objective auto-graded, essays/paper by the parent, hints and answer keys per câu con); the shared prompt shows at the top of the bài in its own scroll box with a max height on iPad and iPhone; a bài with one câu con is valid; flashcard sets never have bài.
- **Phase 1 scope = grouping existing sets** ("làm phần chia bài trước"), demonstrated on the reference set.
- **Splitting a fill-blank passage into one câu con per blank is deferred** ("tách để sau"): Q10 stays one question with 9 blanks.
- **Bài title**: the label printed on the paper when there is one ("Part 3"), otherwise "Bài n" where n is the bài's 1-based order among all bài in the set. The parent can edit the label. For the reference set: "Bài 1", "Part 3", "Part 4". (Proposed by Claude, user said ok.)
- **Points** (backlog decision): the parent may set a bài's total and it is split **exactly** evenly across its câu con (1 pt over 3 câu = 1/3 each, not 0.33); only the set total is rounded (score out of 10 to 0.25 as today); bài totals display rounded.

### Non-goals (phase 1)

- One câu con per blank in a passage (Q10 case), highlighted blanks in the passage.
- AI scan producing bài, `continues` across pages, merging bài across scan batches, grouping in the scan review step (`ReviewStep`) — the scan pipeline is unchanged; the parent groups after saving, in the library editor.
- AI generate (`ai-generate`) producing bài.
- Reading passages: dialogue layout, speaker buttons, `vi-VN` voices, reading-only bài with no câu con ("Đã đọc"), `doc` type.
- Reports / analytics grouped by bài; "5 bài · 25 câu" counts on cards (cards keep counting câu).
- Per-bài points shown on the parent dashboard or schedule.

### Anti-goals

- Saving, editing a question, or "Giải đáp án" silently drops the grouping or the shared figure.
- A shared figure gets deleted from Storage by the unused-figure cleanup, or is missing offline.
- Câu numbers differ between the take screen, the grading screen, the result screen and AI paper grading.
- A set where every câu is right does not score exactly 10/10 (or loses the 10-point badge / 3 stars) because of a 1/3 split.
- Ungrouped sets, flashcards, offline sync, timers, retries or rewards change behaviour.

## Data model

Store the grouping **on each câu con**, so snapshots (`answers.question`), the offline pack (`toTakeQuestion` passes unknown fields through), `withLaterAnswerKey` and AI request builders carry it without new plumbing. No migration (`questions.content` and `answers.question` are jsonb).

- `QuestionBase` (`src/lib/types.ts`) gains `group?: QuestionGroup`:
  `{ id: string; label?: string; prompt: string; image?: QuestionImage; imageUrl?: string /* read side only, like Question.imageUrl */ }`.
  `id` is a client-generated id (`uid()`), unique within the set. `prompt`, `label` and `image` may all be empty (the bài then shows only its title); LaTeX allowed as in any prompt (render with `RichText`). `label` ≤ 40 chars, trimmed, empty ⇒ absent.
- **Invariants**, enforced by a pure `checkGroups(questions)` in `src/lib/` and called by `saveExerciseSet` (Vietnamese errors) and by the editor before save:
  1. Questions sharing `group.id` are contiguous by position.
  2. Every member of a bài carries the identical `label`, `prompt` and `image` (the editor writes the whole bài at once; the server normalises by copying the first member's group onto the rest, then validates).
  3. Flashcard sets (`format = 'flashcard'`) contain no `group` (extend `checkSetFormat`).
- `question-schema.ts`: add `group` to the shared `base` (zod strips unknown keys today, which would delete it). `group.image` uses the existing `imageSchema`; `editedQuestionSchema`'s transform also drops `group.imageUrl`.
- `answers.question` snapshots include `group` automatically (`answerRows` writes the whole question). Results and grading of old attempts group by the snapshot, not the current set.
- Changing groups goes through `saveExerciseSet`, which already bumps `exercise_sets.updatedAt`, so offline `offline_set_changed` stays correct.

### Figure paths — one helper

Every place that enumerates a question's figures must include `group.image`. Extend `figurePaths` (`src/lib/figures.ts`) and use it (or an equivalent shared list) in:

- `saveExerciseSet` new-file check (`figureOwner` + `isUploaded`);
- `removeUnusedFigures` SQL (`server/actions/library.ts`): add `content->'group'->'image'->>'path'` for both `questions.content` and `answers.question`;
- `withImageUrls` (`server/question-images.ts`): sign `group.image` into `group.imageUrl`;
- offline pack download (`lib/offline/pack-client.ts`) and `QuestionPicture`'s blob fallback;
- `UploadFlow` restore signing (only if a restored draft can carry groups — it cannot in phase 1; leave a note);
- the "Giải đáp án" client merge in `ExerciseSetDetail` re-attaches `group.imageUrl` like it does `imageUrl`.

Because each member carries the same `group.image`, signing and downloading must de-duplicate by path.

## Numbering and labels — one helper

A pure helper in `src/lib/questions.ts` (or a new `src/lib/question-groups.ts`), used by **every** screen and AI builder that shows "Câu n":

- `groupBlocks(questions)` → ordered blocks: `{ kind: "single", question, number }` or `{ kind: "group", group, title, number: bàiOrder, items: [{ question, number }] }`.
- Câu numbers are the 1-based position in the set (unchanged from today, so `mapPaperGrades`' position-based mapping and stored positions stay valid).
- `title` = `group.label` if set, else `Bài ${n}` with n = order among bài.
- `groupPoints` = sum of member points; display with the existing score formatter, prefixed "≈" when the rounded display differs from the exact value.

## Points

- Setting a bài total in the editor sets each member's `points = total / count` (exact float). Editing one câu con's points afterwards is allowed and just changes the sum.
- `points` validation stays `> 0, ≤ 100` on the server; the editor's quarter-point rule (`parsePoints`) applies to what the parent types, not to computed splits.
- Remove the 0.01 rounding in `proportional()` (`lib/grading.ts`) and in manual grades (`server/actions/grading.ts` `pointsAwarded`), so 3 correct câu at 1/3 sum to exactly 1. Display stays rounded via the formatter (max 2 decimals).
- Full marks must still be exactly 10: compare with a small epsilon (or round the ratio) in `scoreOutOf10` before the quarter rounding, so float sums like 0.9999999 never yield 9.75. The 10-point badge and `starsFor` then work unchanged.
- Manual grading step for a câu con whose points are not a multiple of 0.25: buttons give 0 / half / full of that câu's points (instead of `pointStep` increments). Existing questions keep today's stepping.

## Parent: library editor (`ExerciseSetDetail` / `QuestionList` / `QuestionCard`)

- The list renders `groupBlocks`: a bài is a card ("Part 3 · 10 câu · 10 điểm") holding the shared prompt (rendered with `RichText`), the shared figure, and its câu con cards (numbered as today). Standalone questions render as today.
- **Bài actions** (on the bài card): "Sửa bài" (sheet with label, shared prompt, shared figure via the existing `FigureField`, and "Điểm cả bài" which splits evenly), "Bỏ bài" (removes `group` from all members, see lossless ungrouping below), delete bài (deletes the bài and its câu con, with the existing undo pattern).
- **Ungrouping is lossless** (Claude's call): "Bỏ bài" and "Tách khỏi bài" put the shared prompt back as the leading line(s) of each released câu's prompt, and give the shared figure back to released câu that have no figure of their own. "Tự chia bài" → "Áp dụng" → "Bỏ bài" therefore restores the original prompts and figures, and the unused-figure cleanup never deletes a shared figure because of an ungroup.
- **Standalone question action**: "Tạo bài từ câu này" (Claude's call) makes a one-câu bài with an empty shared prompt and opens "Sửa bài".
- **Câu con actions** (on the question card menu): "Đưa vào bài trên" / "Đưa vào bài dưới" on a standalone question (joins the adjacent bài, copying its group; if the neighbour is standalone too, forms a new bài with an empty shared prompt and opens "Sửa bài"), "Tách khỏi bài" (only for the first or last câu con, so the bài stays contiguous; for a middle câu con the action is disabled with a hint to drag it out first).
- **Drag and drop**: keep the current single list. Drop rule (Claude's call): if both neighbours after the drop belong to the same bài, the câu joins that bài; else if the câu was in bài G and at least one neighbour is in G, it stays in G (so reordering inside a bài and moving to its first/last slot work); otherwise it leaves its bài (lossless, as below). `checkGroups` must hold after every drop. (How the drag preview shows bài boundaries is left to the builder.)
- **Editing a câu con** in `QuestionEditorSheet` keeps its `group` (`fromDraft` currently rebuilds the object; carry `group` from `previous`).
- **"Tự chia bài"** button next to "Giải đáp án" (hidden for flashcard sets): runs a pure `suggestGroups(questions)` and shows a preview sheet (bài titles, câu ranges, the extracted shared prompt, figure thumbnail) with "Áp dụng" / "Huỷ". Applying replaces the editor state; nothing is saved until the parent saves as usual. Only standalone questions are considered; existing bài are left alone.

### `suggestGroups` rules (pure, tested, in `src/lib/`)

1. Scan runs of ≥ 2 consecutive standalone questions whose prompts share the same first line(s): the longest common prefix **of whole lines** (split on `\n`, compare trimmed). A run ends when the next prompt does not start with that prefix. Prefer the longest run, then the longest prefix.
2. The shared prompt = the common lines; each câu con's prompt = the remaining lines (trimmed). If a câu con would become empty, don't group that run.
3. If every member of the run has the same `image.path`, that image becomes `group.image` and is removed from the members. (`solutionImage` stays per câu.)
4. Label: if the shared prompt starts with `Part|Bài|Exercise|Câu|Phần` + a number (optionally a letter/roman numeral) + `.`/`:`/`)`, that token becomes `label` ("Part 3") and is removed from the shared prompt; if the rest is empty, keep the label only.
5. No match ⇒ no change; the preview says "Không tìm thấy câu nào có chung đề."

On the reference set this yields exactly the three bài in the success scenario; Q10 is not grouped.

## Child: take screen (`TakeAssignment`)

- Still one câu per page, header "Câu i/N" unchanged. When the câu belongs to a bài, a shared box appears above the câu's own prompt: bài title, shared prompt (`RichText`) and shared figure (`QuestionPicture`), in a scroll container with a max height (about 40% of the viewport on iPad, less on iPhone) so the câu con form stays visible.
- The box keeps its scroll position while moving between câu of the same bài (keep the element mounted/keyed by `group.id`), and resets on entering a different bài.
- The question grid shows bài boundaries lightly (e.g. a small title above each bài's cells). Builder's call on the exact look; numbers stay 1…N.
- Answered/unanswered counting and the review screen are per câu, unchanged.
- Offline: works unchanged because `group` travels inside the take question; the shared figure must be in the pack (see Figure paths).
- `PrintableExercise` (paper mode) prints the bài title and shared prompt/figure once, then its câu con.

## Parent: grading (`GradeAttempt`) and child: result (`ResultDetail`)

- Both render `groupBlocks` over the attempt's snapshot questions: bài header "Part 3 · 8/10" (awarded / bài points, both rounded for display), shared prompt and figure once, then the câu con cards numbered as today.
- Result with "chỉ câu sai" filter: a bài header appears if at least one of its câu con is shown; numbering keeps the set position.
- `ReviewItem` (`lib/views/student.ts`) whitelists fields; add `group`.
- The parent's live total and the server's recomputed score are unchanged apart from the rounding changes in Points.

## AI

Every model request about a câu con prepends the bài's shared prompt (and attaches the shared figure, de-duplicated) before the câu's own prompt:

- Solve (`lib/ai/solve.ts` `solveRequestText`, `server/actions/ai-solve.ts` image blocks). `applySolution` already spreads `...q`; the client merge must keep `group` and `group.imageUrl`.
- Essay and paper grading (`lib/ai/grading.ts` `essayQuestionText`, `paperQuestionText`, `paperQuestionList`; figures in `ai-grading.ts`). Numbers stay set positions; add the bài title so a paper page that says "Part 3: a) b)" can be matched.
- AI paper grading's point rounding (`roundToStep`) follows the same 0 / half / full rule for câu whose points are not a multiple of 0.25.
- Hints (`lib/ai/hints.ts` `hintsPrompt`, image in `ai-hints.ts`), and `leaksAnswer` treats text present in the shared prompt like text in the câu's prompt (not a leak).

## Testing

- Unit (vitest, next to sources): `checkGroups`, `groupBlocks`/titles/numbering, `suggestGroups` (fixture: the reference set's 25 prompts as read from the live draft on 2026-10-20 — Part 1's first line is the whole instruction incl. the word box, Q10 is the passage, Parts 3/4 start with "Part 3." / "Part 4. Read and write." lines; Part 4's second line differs per câu), `figurePaths` with group images, score exactness (3 × 1/3 correct ⇒ 10/10, badge), `proportional` without rounding, schema keeps `group`, `toTakeQuestion` keeps `group`, AI request builders include the shared prompt, `leaksAnswer` with shared prompt.
- E2E (`e2e/db.ts` `createSet` can insert grouped content directly): parent runs "Tự chia bài" on an ungrouped set and saves, reload shows bài; child takes a grouped set (shared box visible on each câu con, scroll kept within a bài); parent grades and sees bài header totals; result shows bài headers. Existing suites must pass unchanged.

## Left to the builder

- Visual design of the bài card, bài header and shared box (follow the app's existing card language and colours; no new design tokens needed).
- Whether the bài editing UI is a separate sheet or part of `QuestionEditorSheet`.
- Drag preview/affordances for bài boundaries; keyboard sorting announcements.
- File/helper names, as long as there is a single numbering helper and a single figure-path helper.
