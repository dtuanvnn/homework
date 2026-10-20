# Split blanks (Tách chỗ trống) — design, grouped questions phase 2

Date: 2026-10-20 · Status: draft design · Builds on `docs/superpowers/specs/2026-10-20-grouped-questions-design.md` (phase 1, on branch `worktree-backlog-update`) · Backlog: `docs/backlog.md` → "Bài có nhiều câu hỏi con (kèm bài đọc)", item "Điền chỗ trống trong đoạn văn".

## Why

The user's words: when the child does a fill-in passage, the result shows **one line with every answer the child wrote**, and **if one blank is wrong the whole thing is marked wrong**, so the child does not know which blank was wrong. (Points are already proportional — `grading.ts` `proportional()` — but `isCorrect` is false unless every blank is right, and `ResultDetail` / `GradeAttempt` print all blanks joined with " ; " / " · ".)

Reference: the live draft "Life in the Wild" (phase 1 spec, table). Q10 is one `dien-cho-trong` holding a whole passage with 9 blanks (9 pts). Q11–20 (bài "Part 3") are single sentences with 2 blanks each ("David is very kind to his little sister. ___ always helps ___ with her homework.").

## Decisions made with the user

1. **Passage → one câu con per blank** ("cách 1"). The passage becomes the shared prompt of a bài; each blank becomes its own câu con with its own number, right/wrong, AI hint and answer key, and counts as a câu on the grid and in Reports.
2. **Short questions with several blanks are not split** ("2 chỗ điền cho 1 câu hỏi hoàn chỉnh thì không tách nữa") — but the result **must show right/wrong per blank**.
3. **Take screen, layout A**: the passage sits in the shared-prompt scroll box; the blank being answered is highlighted, blanks already answered show what the child wrote, the others show their number; the child writes in a **large answer box below** the passage. Reason (user): the box must work with **Apple Pencil** (Scribble) and **answers can be long**.
4. **Result, layout A**: the sentence/passage is shown with the child's words inside it — green ✓ when right, red struck-through when wrong with the correct word next to it **only once answers are revealed** (`answersRevealed`). For a split passage the bài header shows the whole passage this way, and each câu con still has its own row (right/wrong, hint, key) — proposed by Claude, user agreed.
5. **Both ways to split** ("cả 2"): a per-question action in the editor, and "Tự chia bài" proposing it.

## Calls Claude made (user can overrule)

- "Tự chia bài" proposes splitting only standalone `dien-cho-trong` with **≥ 3 blanks**; the manual action works for **≥ 2**. Part 3 sentences (2 blanks) are never proposed.
- A reverse action **"Gộp chỗ trống"** exists, so splitting is lossless like "Bỏ bài" in phase 1.
- The parent's grading screen gets the same per-blank colouring as the result (unsplit multi-blank câu and split passage headers), always showing the correct words.
- **Points (user, 2026-10-20: "mỗi câu sẽ tính 1 điểm, 7 câu là 7 điểm, không chia nhỏ")**: every blank câu of a split passage is worth 1 point; the passage's old points are not divided. Merging back sums them (N blanks → N points).
- **Colouring source.** Unsplit question: each blank is coloured by the matcher against its key, *unless* the key is missing (`answerStatus: "missing"` or an empty key for that blank → the child's word shown neutral, no ✓/✗) or the parent changed the câu's grade by hand (→ all blanks neutral; the câu's own right/wrong badge and points carry the parent's verdict). "k/N ô đúng" is shown only when every blank was coloured. Split passage header: each slot is coloured from that câu's **stored** `isCorrect` (null → neutral), so parent overrides show.
- **Paper attempts** have no typed response: keep today's display; a split passage header shows the passage plain with numbered blanks.
- **Blank count source = the `___` markers** in the prompt (what the child sees). `splitBlanks` pairs marker k with `answers[k]`; a missing key becomes `""` with `answerStatus: "missing"` on that câu, extra keys beyond the markers are dropped. (The fixture's Q10 is a truncated passage: 3 markers, 9 pts → 3 pts each.)
- **Tự chia bài order**: standalone passages with ≥ 3 blanks are split first and are not considered for the "same first line" runs.
- **Sets already assigned**: splitting/merging behaves like deleting and adding questions today (new ids): no guard. An open draft loses its answer to the old question, an offline hand-in is flagged `offline_set_changed`, finished attempts keep their snapshots.

## Goals

- Splitting Q10 of the reference set gives one bài (title per phase 1's rule) whose shared prompt is the passage, with câu 10–18, one per blank; the child answers them one at a time under the passage (layout A); grading and result report each blank on its own.
- Every multi-blank question that stays unsplit shows per-blank right/wrong on the result and the grading screen.

## Non-goals

- AI scan / AI generate producing split passages; anything in the scan review step (backlog item "AI quét tự gom bài").
- Reading-only bài, dialogue layout, speaker button, Reports grouped by bài.
- Typing inside the passage (layout B, rejected by the user).
- Changing how unsplit `dien-cho-trong` are answered on the take screen.
- Per-blank AI hints for unsplit questions (hints stay per câu).

## Anti-goals

- Splitting then merging loses an answer key, the solution, points, the figure or passage text.
- Câu numbers in the passage box, the grid, grading, result, print and AI requests disagree.
- A blank câu silently points at the wrong "___" (after a drag, a delete, or an edit of the passage) instead of the save being refused.
- Results of attempts finished before a split change (they read the `answers.question` snapshot and stay as they were).
- The correct word appears on the child's result before answers are revealed.
- Ungrouped sets, unsplit questions on the take screen, flashcards, offline sync, timers, retries or rewards change behaviour.

## Data model

A split passage is a phase-1 bài whose shared `group.prompt` is the passage text, still containing its `___` markers. Each blank is a câu con of type **`tra-loi-ngan`** with a new optional field on `ShortAnswerQuestion` (`src/lib/types.ts`):

```ts
/** Split passage: 1-based index of the "___" in group.prompt this câu answers. */
blank?: number
```

- Why `tra-loi-ngan`: it already renders the large answer box (textarea for words, MathLive when `math: true`, decimal input for the maths subject), grades by exact normalised text (`shortAnswerMatches` only adds the number-with-unit leniency, e.g. "24" for "24 kg"), and every screen and AI path already handles it.
- A blank câu's own `prompt` is `""` by default; the parent may type a note. Its `math` / `simplest` / `answerStatus` / `skills` come from the original question; `answer` is that blank's key.
- Validation — extend `checkGroups` (`src/lib/question-groups.ts`, Vietnamese messages, run by the editor and `saveExerciseSet`); `question-schema.ts` accepts `blank` as a positive integer:
  1. A câu with `blank` must belong to a bài.
  2. If any câu of a bài has `blank`, the câu with `blank` carry exactly `1..N` **in position order**, where N = number of `___` in `group.prompt`. A bài may also contain ordinary câu (e.g. "What is the text about?"); they don't count.
  3. A bài with no blank câu keeps phase-1 behaviour (its prompt may contain `___` freely).
- Snapshots, the offline pack (`toTakeQuestion` strips `answer`, keeps `blank` and `group`) and `withLaterAnswerKey` (by id) need no new plumbing.

## Pure helpers (`src/lib/`, unit tested)

- `splitBlanks(qs, questionId): Question[]` — a standalone `dien-cho-trong` with ≥ 2 blanks becomes a new bài: `group = { id: uid, label?, prompt, image? }`, label/prompt by phase 1's label rule (the `LABEL` regex on the first line; the matched label is stripped from the prompt as `groupRun` does), `image` = the question's figure. Then N `tra-loi-ngan` câu with **new ids**, `answer = answers[k]`, `blank = k + 1`, `prompt = ""`, `points = 1`, same skills/math/simplest/answerStatus. The question's `solution` / `solutionImage` go on the first câu con. Anything else returns `qs` unchanged.
- `mergeBlanks(qs, groupId): Question[]` — the inverse, allowed when the bài's members are exactly its blank câu: one standalone `dien-cho-trong` at the bài's position with `prompt` = `"<label>. "` (when a label exists) + group prompt, `answers` in blank order, `points` = sum, skills = union in order, figure = group image, `answerStatus` = `"missing"` if any member is missing, else `"ai-check"` if any, else `"ai"` if any, else absent; solutions joined with newlines (and the first solution image kept).
- `blankSlots(prompt, members, numberOf)` — the passage cut at each `___` into text pieces and slots `{ blank, questionId, number }`, used by the take box, grading/result headers and print, so blanks are numbered by câu number everywhere.
- `fullPrompt(q)` for a blank câu marks which blank it answers: the passage with this câu's `___` replaced by `[___]` and the line `Chỗ trống số k` (k = `blank`) appended. AI requests already carry their own "Câu n" headers; the builder may switch to câu numbers if they can be passed in.
- `suggestGroups` additionally splits every standalone `dien-cho-trong` with ≥ 3 blanks; `SuggestedGroup` gains `blanks?: number` so the preview reads e.g. "Bài 2 · câu 10–18 · tách 9 chỗ trống".
- Per-blank marking for an unsplit `dien-cho-trong`: a pure helper returning `{ given: string; correct: boolean | null; answer?: string }[]`, using the same matcher as `gradeQuestion` (`answerMatches` / `sameText`), `correct: null` per the colouring rule above (missing key, hand-changed grade), `answer` only when the caller may show keys. Used by `lib/views/student.ts` (result, gated by `answersRevealed`) and `lib/views/grading.ts`.

## Editor (library)

- `QuestionList` actions: on a standalone `dien-cho-trong` with ≥ 2 blanks, **"Tách chỗ trống"** → `splitBlanks`. On a bài made only of blank câu, the bài menu gets **"Gộp chỗ trống"** → `mergeBlanks`, and **"Bỏ bài" on such a bài does the merge** (otherwise releasing would leave N empty short answers). A question inside a bài shows "Tách chỗ trống" disabled with hint "Tách khỏi bài trước".
- Blank câu cannot leave or move inside their bài one by one: "Tách khỏi bài" disabled (hint "Dùng Gộp chỗ trống"), a drag that would move a blank câu is refused/reverted, and deleting a single blank câu is disabled. Deleting the whole bài works as in phase 1.
- `QuestionEditorSheet` on a blank câu: the type is fixed (`tra-loi-ngan`), the prompt field is an optional note; answer key, math, points, skills editable as usual.
- Editing the passage in `GroupEditorSheet` so that the `___` count changes: the `checkGroups` message is shown and save is refused until fixed.
- The card of a blank câu reads "Chỗ trống (n)" plus its key.

## Take screen (layout A)

- `SharedPromptBox`, for a bài with blank câu, renders the passage with `blankSlots`: each slot shows "(n)" plus the child's current answer for that câu, or "___"; the current câu's slot is highlighted (yellow in the mockup); the box keeps its scroll across câu of the bài (already keyed by `group.id`) and scrolls the highlighted slot into view.
- The blank câu's heading: its note if any, else "Chỗ trống (n)". The answer box is today's `ShortAnswer`; its textarea must **grow with its content** (long answers) and stay a real text field so Scribble works — for all short answers, not only blank câu.
- Grid, "câu chưa làm" and the review list count blank câu like any câu.

## Grading (parent) and result (child)

- Unsplit `dien-cho-trong` with ≥ 2 blanks: instead of the joined line, render the prompt with each blank replaced by the child's word — green ✓ when right, red struck-through when wrong, with the correct word after a wrong one (result: only when `answersRevealed`; grading: always). Add "k/N ô đúng" next to the câu's existing right/wrong and points.
- Split passage: `GroupHeader` (grading and result) shows the passage via `blankSlots` with the same colouring and the same revealing rule. Each blank câu row is a normal short-answer row whose prompt line reads "Chỗ trống (n)" (+ note).
- Reports, stars and scores: no code change; they already count câu.

## Print

`PrintableExercise`: a split bài prints the passage once with numbered blanks "(n) ……………"; its blank câu print no separate line. Unsplit questions unchanged.

## Testing

- Unit: `splitBlanks` / `mergeBlanks` round trip on the reference Q10 (keys, points, figure, solution, answerStatus) and refusal cases; `checkGroups` new rules (count mismatch, out of order, blank outside a bài); `blankSlots` numbering; `suggestGroups` splits ≥ 3 blanks and leaves 2-blank sentences; per-blank marking incl. the `answersRevealed` gate; `fullPrompt` for a blank câu.
- E2E (extend `e2e/grouped-questions.spec.ts`): parent splits a 3-blank passage with "Tự chia bài" and saves; child answers the 3 câu under the highlighted passage, one wrong; the result shows the passage coloured and only that câu wrong; a 2-blank sentence with one wrong blank shows per-blank colouring.

## Left to the builder

- Exact copy and placement of menu items beyond the names above; how a refused drag is surfaced.
- Whether merge keeps notes typed on blank câu (suggestion: append them to the solution).
- Highlight colours and auto-scroll details, within the app's existing visual language.
