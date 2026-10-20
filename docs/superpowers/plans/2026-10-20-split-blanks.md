# Split blanks (Tách chỗ trống) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fill-in passage can become a bài with one `tra-loi-ngan` câu con per blank (answered under a highlighted passage), and every multi-blank question shows right/wrong per blank on the result and grading screens.

**Architecture:** A split passage is a phase-1 bài whose `group.prompt` keeps its `___` markers; each blank câu is a `tra-loi-ngan` with `blank: k` (1-based marker index). Pure helpers in `src/lib/` (validation in `question-groups.ts`, split/merge in `question-groups-edit.ts`, display/marking in new `blanks.ts`) feed one shared renderer `components/question/BlankText.tsx` used by the take box, result, grading and print.

**Tech Stack:** Next.js (repo version — read `node_modules/next/dist/docs/` before touching framework APIs), React, TypeScript, zod 4, dnd-kit, vitest, Playwright (WebKit iPad/iPhone).

**Spec:** `docs/superpowers/specs/2026-10-20-split-blanks-design.md` (builds on `docs/superpowers/specs/2026-10-20-grouped-questions-design.md`).

## Global Constraints

- All UI text Vietnamese; copy fixed by the spec: "Tách chỗ trống", "Gộp chỗ trống", "Bỏ bài", "Tách khỏi bài trước", "Dùng Gộp chỗ trống", "Chỗ trống (n)", "k/N ô đúng", "tách N chỗ trống".
- Blank marker is `BLANK = "___"` from `src/lib/questions.ts`; count with `countBlanks(prompt)`.
- "Tự chia bài" proposes splits only for standalone `dien-cho-trong` with ≥ 3 blanks; manual "Tách chỗ trống" needs ≥ 2.
- Points split exactly (`points / N`, no rounding).
- Correct words on the child's result only when `answersRevealed`; the grading screen always shows them.
- Colouring neutral (`correct: null`) when: key missing (`answerStatus: "missing"` or that blank's key empty), the stored grade differs from the auto grade (parent changed it), or the attempt is paper.
- Render question text only through `RichText`; tests can't import `"server-only"` modules — keep logic in `src/lib/`.
- No migration; ungrouped sets, the unsplit take screen, flashcards, offline, timers, retries, rewards unchanged.
- `pnpm typecheck && pnpm lint && pnpm test` green at the end of every task.

## Review Focus

1. A passage whose answer-key array is shorter/longer than its `___` count (scanned sets) — split pads missing keys as `""` + `answerStatus: "missing"` on that câu, drops extras; the save must not then be refused. (Test in Task 2.)
2. A drag that drops an ordinary câu between blank câu (allowed) vs. one that moves a blank câu out of / within its bài (refused, list unchanged). (Test in Task 2 via `canApplyMove`, wired in Task 3.)
3. Editing the passage in "Sửa bài" so the `___` count changes — save refused with the `checkGroups` message, nothing lost. (Test in Task 1.)
4. A split set taken offline — the take question keeps `blank` and `group` but no `answer`. (Test in Task 1 on `toTakeQuestion`.)
5. Result of an unsplit question the parent re-graded by hand — blanks neutral, no "k/N ô đúng", the badge shows the parent's verdict. (Test in Task 4.)

---

### Task 1: Data model, validation, `fullPrompt`

**Files:**
- Modify: `src/lib/types.ts` (`ShortAnswerQuestion`), `src/lib/question-schema.ts` (`tra-loi-ngan` object), `src/lib/question-groups.ts`
- Test: `src/lib/question-groups.test.ts`, `src/lib/question-schema.test.ts`, `src/lib/views/student.test.ts` (`toTakeQuestion`)

**Interfaces:**
- Produces: `ShortAnswerQuestion.blank?: number`; `checkGroups(items: { group?: QuestionGroup; blank?: number }[]): string | null` with the new rules; `fullPrompt(q: { prompt: string; group?: QuestionGroup; blank?: number }): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// question-groups.test.ts
const passage = { id: "g", prompt: "They are ___ and ___. Lions ___." }
const b = (k: number) => ({ group: passage, blank: k })
it("accepts blank câu 1..N in order, plus ordinary câu", () => {
  expect(checkGroups([b(1), b(2), { group: passage }, b(3)])).toBeNull()
})
it("refuses a blank câu outside a bài", () => {
  expect(checkGroups([{ blank: 1 }])).toBe("Câu điền chỗ trống phải nằm trong một bài.")
})
it("refuses blank câu that don't match the ___ in the shared prompt", () => {
  expect(checkGroups([b(1), b(2)])).toBe("Số chỗ trống trong đề chung phải bằng số câu điền chỗ trống.")
  expect(checkGroups([b(1), b(3), b(2)])).toBe("Các câu điền chỗ trống phải theo đúng thứ tự.")
})
it("leaves bài without blank câu alone even if the prompt has ___", () => {
  expect(checkGroups([{ group: passage }])).toBeNull()
})
it("fullPrompt marks which blank a blank câu answers", () => {
  expect(fullPrompt({ prompt: "", group: { id: "g", label: "Part 2", prompt: "A ___ b ___." }, blank: 2 }))
    .toBe("Part 2\nA ___ b [___].\nChỗ trống số 2")
})
// question-schema.test.ts — through the parse entry point the file already uses
it("keeps blank on a short answer and refuses blank 0", () => { /* blank: 2 survives; blank: 0 fails */ })
// student.test.ts
it("toTakeQuestion keeps blank and group but strips the answer", () => { /* not.toHaveProperty("answer"); toMatchObject({ blank: 1, group }) */ })
```

- [ ] **Step 2: Run** `pnpm test src/lib/question-groups.test.ts src/lib/question-schema.test.ts src/lib/views/student.test.ts` — Expected: the new tests FAIL (messages absent / `blank` stripped / no `[___]`).

- [ ] **Step 3: Implement**
  - `types.ts`: `blank?: number` on `ShortAnswerQuestion` with the spec's doc comment.
  - `question-schema.ts`: `blank: z.number().int().positive().optional()` on the `tra-loi-ngan` object.
  - `checkGroups`: after the existing checks — a blank câu without a group → message 1; per bài with any blank câu, blanks in position order must be `1..k` (else the order message), and `k === countBlanks(group.prompt)` (else the count message). Order before count.
  - `fullPrompt`: with `blank`, replace the `blank`-th `___` of the group prompt by `[___]` and append `Chỗ trống số ${blank}`.

- [ ] **Step 4: Run** the same command — PASS; then `pnpm typecheck && pnpm test` — PASS.

- [ ] **Step 5: Commit** `git commit -m "feat: blank câu of a split passage (data, validation, AI prompt)"`

---

### Task 2: `splitBlanks`, `mergeBlanks`, `canApplyMove`, "Tự chia bài"

**Files:**
- Modify: `src/lib/question-groups-edit.ts`
- Test: `src/lib/question-groups-edit.test.ts` (fixture `lifeInTheWild` in `src/lib/fixtures/life-in-the-wild.ts`: `p2` is the passage — 3 markers, 9 pts, keys `["","",""]`, `answerStatus: "missing"`)

**Interfaces:**
- Consumes: Task 1's `checkGroups`, `blank`.
- Produces:
  - `canSplitBlanks(qs: Question[], questionId: string, min = 2): boolean` — standalone `dien-cho-trong` with `countBlanks(prompt) >= min`
  - `splitBlanks(qs: Question[], questionId: string): Question[]`
  - `isBlankGroup(qs: Question[], groupId: string): boolean` — every member has `blank`
  - `mergeBlanks(qs: Question[], groupId: string): Question[]`
  - `canApplyMove(next: Question[]): boolean` — `checkGroups(next)` returns none of the three blank messages
  - `SuggestedGroup.blanks?: number`

- [ ] **Step 1: Write the failing tests**

```ts
const keyed: Question = { id: "p", type: "dien-cho-trong", prompt: "Part 2. Fill in.\nThey are ___ and ___. Lions ___.", answers: ["gentle", "fierce", "hunt"], points: 9, skills: ["vocab"], solution: "S", image: { path: FIG, width: 1, height: 1 } }

it("splits a passage into one short answer per blank", () => {
  const out = splitBlanks([keyed], "p")
  expect(out.map((q) => q.type)).toEqual(["tra-loi-ngan", "tra-loi-ngan", "tra-loi-ngan"])
  expect(out.map((q) => (q as ShortAnswerQuestion).answer)).toEqual(["gentle", "fierce", "hunt"])
  expect(out.map((q) => (q as ShortAnswerQuestion).blank)).toEqual([1, 2, 3])
  expect(out.every((q) => q.points === 3 && q.prompt === "" && q.id !== "p")).toBe(true)
  expect(out[0].group).toMatchObject({ label: "Part 2", prompt: "Fill in.\nThey are ___ and ___. Lions ___.", image: keyed.image })
  expect(out[0].solution).toBe("S")
  expect(out[1].solution).toBeUndefined()
  expect(checkGroups(out)).toBeNull()
})
it("pads missing keys and drops extra ones", () => {
  const out = splitBlanks([{ ...keyed, answers: ["gentle"] }], "p")
  expect(out.map((q) => q.answerStatus)).toEqual([undefined, "missing", "missing"])
  expect(checkGroups(out)).toBeNull()
  expect(splitBlanks([{ ...keyed, answers: ["a", "b", "c", "d"] }], "p")).toHaveLength(3)
})
it("refuses a 1-blank question or one already in a bài", () => { /* returns the same array (toBe) */ })
it("merge undoes split", () => {
  const split = splitBlanks([keyed], "p")
  const [merged] = mergeBlanks(split, split[0].group!.id)
  expect(merged).toMatchObject({ type: "dien-cho-trong", prompt: keyed.prompt, answers: keyed.answers, points: 9, skills: ["vocab"], solution: "S", image: keyed.image })
  expect(merged.group).toBeUndefined()
})
it("merge takes the weakest answerStatus and keeps notes", () => { /* one "missing" → "missing"; "ai-check" beats "ai"; note "x" on câu 2 → solution ends "(2) x" */ })
it("refuses moves that break blank order but allows ordinary câu among them", () => {
  const split = splitBlanks([keyed, { id: "x", type: "tra-loi-ngan", prompt: "Q", answer: "a", points: 1, skills: [] }], "p")
  expect(canApplyMove([split[0], split[2], split[1], split[3]])).toBe(false)
  expect(canApplyMove([split[0], { ...split[3], group: split[0].group }, split[1], split[2]])).toBe(true)
  expect(canApplyMove([split[1], split[2], split[3], { ...split[0], group: undefined }])).toBe(false)
})
it("Tự chia bài splits passages with 3+ blanks first and leaves 2-blank sentences", () => {
  const { questions, groups } = suggestGroups(lifeInTheWild)
  expect(groups.map((g) => [g.title, g.from, g.to, g.blanks])).toEqual([["Bài 1", 1, 9, undefined], ["Bài 2", 10, 12, 3], ["Part 3", 13, 22, undefined], ["Part 4", 23, 27, undefined]])
  expect(questions.filter((q) => q.group?.label === "Part 3").every((q) => q.type === "dien-cho-trong")).toBe(true)
})
```

(Existing `suggestGroups` tests that expect Q10 standalone change to the numbering above — intended; say so in the commit message.)

- [ ] **Step 2: Run** `pnpm test src/lib/question-groups-edit.test.ts` — Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement** in `question-groups-edit.ts`:
  - `splitBlanks` per the spec's "Pure helpers": `LABEL` for the label, `uid("q")` for câu ids (match the prefix `newQuestion` uses if different), `uid("bai")` for the bài; câu keep `skills`, `math`, `simplest`, `answerStatus` (padded blanks → `"missing"`); `solution`/`solutionImage`/`solutionImageUrl` only on câu 1; the group carries the question's `image`/`imageUrl`.
  - `mergeBlanks`: only when `isBlankGroup`; prompt = (`label ? label + ". " : ""`) + group prompt; status order missing > ai-check > ai > absent; solutions joined with `"\n"`; non-empty notes appended to the solution as `(k) note` lines.
  - `suggestGroups`: first pass every standalone `dien-cho-trong` with `countBlanks >= 3` through `splitBlanks`, then the existing run detection (which already skips grouped câu); report split bài with `blanks: N`.
  - `canApplyMove` as in Interfaces.

- [ ] **Step 4: Run** the file — PASS; then `pnpm typecheck && pnpm test` — PASS.

- [ ] **Step 5: Commit** `git commit -m "feat: split/merge passage blanks; Tự chia bài splits passages"`

---

### Task 3: Library editor

**Files:**
- Modify: `src/components/exercise-detail/QuestionList.tsx`, `GroupCard.tsx`, `QuestionCard.tsx`, `QuestionEditorSheet.tsx`, `SuggestGroupsSheet.tsx`

**Interfaces:**
- Consumes: Task 2 functions.
- Produces: `QuestionCard` prop `canDelete?: boolean` (default true); `GroupCard` prop `blanks?: boolean` (bài made of blank câu) plus `onMergeBlanks?: () => void`.

- [ ] **Step 1: Actions** in `QuestionList.actionsFor`:
  - standalone `dien-cho-trong` with ≥ 2 blanks: `{ label: "Tách chỗ trống", onSelect: () => onChange(splitBlanks(questions, q.id)) }`;
  - `dien-cho-trong` inside a bài with ≥ 2 blanks: the same item `disabled`, `hint: "Tách khỏi bài trước"`;
  - a blank câu: "Tách khỏi bài" `disabled` with `hint: "Dùng Gộp chỗ trống"`; the card gets `canDelete={false}`.
- [ ] **Step 2: GroupCard**: for a blank bài, menu item "Gộp chỗ trống", and "Bỏ bài" calls the same `mergeBlanks`.
- [ ] **Step 3: Drag refusal** in `handleDragEnd`: `next = applyDrop(arrayMove(...))`; if `!canApplyMove(next)`, keep the list and `toast("Các câu điền chỗ trống phải giữ đúng thứ tự trong bài.")` (sonner, as elsewhere in the editor).
- [ ] **Step 4: QuestionCard / QuestionEditorSheet** for a blank câu: the card text reads `Chỗ trống (n)` (n = câu number) followed by the note if any, and its key as for short answers; the editor hides "Chọn loại khác" and labels the prompt field "Ghi chú (không bắt buộc)".
- [ ] **Step 5: SuggestGroupsSheet**: a group with `blanks` shows `· tách {blanks} chỗ trống` after its range.
- [ ] **Step 6: Verify** `pnpm typecheck && pnpm lint && pnpm test`; in `pnpm dev`, on a set with a 3-blank passage: Tách chỗ trống → 3 câu in a bài; dragging a blank câu → toast, unchanged; Gộp chỗ trống → one question again; save succeeds both ways. Expected: as described, no console errors.
- [ ] **Step 7: Commit** `git commit -m "feat: Tách/Gộp chỗ trống in the library editor"`

---

### Task 4: Display helpers and `BlankText`

**Files:**
- Create: `src/lib/blanks.ts`, `src/lib/blanks.test.ts`, `src/components/question/BlankText.tsx`
- Modify: `src/lib/grading.ts` (export the per-blank matcher)

**Interfaces:**
- Produces:
  ```ts
  export type PassagePiece = { kind: "text"; text: string } | { kind: "blank"; index: number } // 1-based
  export function passagePieces(prompt: string): PassagePiece[]
  export interface BlankMark { given: string; correct: boolean | null; answer?: string }
  export function blankMarks(q: FillBlankQuestion, response: unknown, stored: { isCorrect: boolean | null; pointsAwarded: number | null } | null, showKeys: boolean): BlankMark[]
  export function blankCount(marks: BlankMark[]): { right: number; total: number } | null // null when any mark is neutral
  // grading.ts
  export function blankMatches(q: FillBlankQuestion, index: number, given: string): boolean
  ```
  `BlankText` props: `{ pieces: PassagePiece[]; slot: (index: number) => { label?: string; given?: string; correct?: boolean | null; answer?: string; current?: boolean } }` — text through `RichText`; each slot "(label) given": green + ✓ when `correct === true`; red line-through followed by the green `answer` when `false`; neutral when null/undefined; "___" when no `given`; yellow highlight + `aria-current="true"` when `current`.

- [ ] **Step 1: Write the failing tests**

```ts
it("cuts a passage at each ___", () => {
  expect(passagePieces("A ___ b ___.")).toEqual([{ kind: "text", text: "A " }, { kind: "blank", index: 1 }, { kind: "text", text: " b " }, { kind: "blank", index: 2 }, { kind: "text", text: "." }])
})
const q: FillBlankQuestion = { id: "q", type: "dien-cho-trong", prompt: "___ helps ___.", answers: ["He", "her"], points: 1, skills: [] }
it("marks each blank with the grading matcher", () => {
  expect(blankMarks(q, ["he", "him"], { isCorrect: false, pointsAwarded: 0.5 }, true)).toEqual([{ given: "he", correct: true }, { given: "him", correct: false, answer: "her" }])
  expect(blankMarks(q, ["he", "him"], { isCorrect: false, pointsAwarded: 0.5 }, false)[1]).toEqual({ given: "him", correct: false })
})
it("is neutral when the parent changed the grade", () => {
  expect(blankMarks(q, ["he", "him"], { isCorrect: true, pointsAwarded: 1 }, true).every((m) => m.correct === null)).toBe(true)
})
it("is neutral without an answer key", () => {
  expect(blankMarks({ ...q, answers: ["He", ""], answerStatus: "missing" }, ["he", "x"], null, true).map((m) => m.correct)).toEqual([null, null])
})
it("counts right blanks only when all are marked", () => {
  expect(blankCount([{ given: "a", correct: true }, { given: "b", correct: false }])).toEqual({ right: 1, total: 2 })
  expect(blankCount([{ given: "a", correct: null }])).toBeNull()
})
```

- [ ] **Step 2: Run** `pnpm test src/lib/blanks.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement**: `blankMatches` in `grading.ts` reusing what the `dien-cho-trong` case uses (and make that case call it); `blankMarks`: "parent changed" = `stored` given and differing from `gradeQuestion(q, response)` (isCorrect differs or points differ by > 1e-9); `answerStatus === "missing"` or an empty key → that blank neutral (missing status → all neutral); empty `given` counts as wrong when keyed. Then `BlankText.tsx`.
- [ ] **Step 4: Run** — PASS; `pnpm typecheck && pnpm lint && pnpm test` — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: per-blank marks and BlankText"`

---

### Task 5: Take screen (layout A)

**Files:**
- Modify: `src/components/take/SharedPromptBox.tsx`, `src/components/take/TakeAssignment.tsx`, `src/components/take/questions.tsx` (`ShortAnswer`)

**Interfaces:**
- Consumes: `passagePieces`, `BlankText`, `groupBlocks`.
- Produces: `SharedPromptBox` prop `blanks?: { slots: Map<number, { number: number; given?: string }>; current?: number }` (keys = blank index).

- [ ] **Step 1: SharedPromptBox**: with `blanks`, render `group.prompt` through `BlankText` (label = câu number, given = answer, current = current câu's blank); when `current` changes, `scrollIntoView({ block: "nearest" })` the `[aria-current]` slot inside the scroll box.
- [ ] **Step 2: TakeAssignment**: build `slots` for the current bài from its blank câu (number = set position, given = `answers[id]` if a non-empty string); heading for a blank câu = its note if non-empty, else `Chỗ trống (${number})` (replaces the prompt `h2`).
- [ ] **Step 3: ShortAnswer**: the `Textarea` grows with its content — ref + layout effect on `value`: `height = "auto"` then `scrollHeight + "px"`; keep `min-h-28`; math and decimal inputs unchanged.
- [ ] **Step 4: Verify** `pnpm typecheck && pnpm lint && pnpm test`; in `pnpm dev`, take a split-passage assignment: current slot highlighted, answered slots show words, a long answer grows the box. Expected: as described.
- [ ] **Step 5: Commit** `git commit -m "feat: split passage on the take screen (highlighted blank, growing answer box)"`

---

### Task 6: Result and grading screens

**Files:**
- Modify: `src/lib/views/student.ts` (`ReviewItem`, `buildResultDetail`), `src/lib/views/student.test.ts`, `src/components/results/ResultDetail.tsx`, `src/components/question/GroupHeader.tsx`, `src/components/grading/GradeAttempt.tsx`

**Interfaces:**
- Consumes: `blankMarks`, `blankCount`, `passagePieces`, `BlankText`.
- Produces: `ReviewItem.blanks?: BlankMark[]` (web, unsplit `dien-cho-trong` with ≥ 2 blanks) and `ReviewItem.blank?: { index: number; given?: string; correct: boolean | null }` (blank câu; `given` only for web, `correct` = stored `isCorrect`, null for paper); `GroupHeader` prop `passage?: (index: number) => BlankSlotProps` — when set, the prompt renders through `BlankText`.

- [ ] **Step 1: Write the failing tests** (`student.test.ts`, reusing its `buildResultDetail` fixtures)

```ts
it("marks each blank of an unsplit question, keys only once revealed", () => {
  // graded, retry open → blanks [{ given: "He", correct: true }, { given: "him", correct: false }]
  // graded, no retry → second mark also has answer: "her"
})
it("gives a blank câu its index, the child's word and the stored verdict", () => {
  // tra-loi-ngan, blank: 2, isCorrect false, response "calm" → blank: { index: 2, given: "calm", correct: false }
})
it("paper attempts carry no per-blank marks", () => { /* mode paper → blanks undefined; blank: { index: 2, correct: null } */ })
```

- [ ] **Step 2: Run** `pnpm test src/lib/views/student.test.ts` — FAIL.
- [ ] **Step 3: Implement** in `buildResultDetail` (showKeys = `answersRevealed`; stored = the row's `isCorrect`/`pointsAwarded`).
- [ ] **Step 4: ResultDetail**: an item with `blanks` renders its prompt through `BlankText` instead of the prompt + "Em trả lời" + "Đáp án đúng" lines, and shows `k/N ô đúng` when `blankCount` is not null; a blank câu row's prompt line is `Chỗ trống (n)` (+ note); the bài header gets `passage` from its items' `blank` + `correctAnswer`.
- [ ] **Step 5: GradeAttempt**: the same rendering from `GradingAnswer` and the live marks (stored = the current mark, showKeys = true); split header slots coloured from the current marks; paper attempts keep today's rows, the header shows numbered blanks only.
- [ ] **Step 6: Run** `pnpm typecheck && pnpm lint && pnpm test` — PASS.
- [ ] **Step 7: Commit** `git commit -m "feat: per-blank right/wrong on result and grading"`

---

### Task 7: Print

**Files:**
- Modify: `src/components/schedule/PrintableExercise.tsx`

- [ ] **Step 1:** In the bài header, a bài with blank câu prints `group.prompt` via `passagePieces`, each blank as `(n) ……………` with n = that blank câu's number; blank câu print no `<li>` of their own (the "Câu n." text is explicit, so other numbers stay right).
- [ ] **Step 2: Verify** `pnpm typecheck && pnpm lint`; print preview of a split set in `pnpm dev` shows the passage once with its numbered blanks. Expected: as described.
- [ ] **Step 3: Commit** `git commit -m "feat: print a split passage once with numbered blanks"`

---

### Task 8: E2E and docs

**Files:**
- Modify: `e2e/grouped-questions.spec.ts`, `CLAUDE.md` (Bài bullet), `docs/backlog.md` (phase note)

- [ ] **Step 1: Write the E2E** (two new tests in the serial file; no `closeDb()`):
  - **Parent:** `createSetWithQuestions(title, [passage, sentence], "nhap")` with a standalone `dien-cho-trong` `"Life in the Wild\nThey are ___ and ___. Lions ___ other animals."`, answers `["gentle","fierce","hunt"]`, 3 pts, and a sentence `"___ always helps ___."` answers `["He","her"]`, 1 pt. "Tự chia bài" sheet shows `tách 3 chỗ trống`; apply; "Lưu nháp"; reopen → `Chỗ trống (1)`…`(3)` listed in the bài, the sentence untouched.
  - **Child:** a second set created already split (bài `{ id, prompt: "Life in the Wild\nThey are ___ and ___. Lions ___ other animals." }` + three `tra-loi-ngan` with `blank` 1–3) plus the sentence, then `assign(setId)`. Answer `gentle`, `calm`, `hunt` under the region named by the bài title, asserting the `[aria-current="true"]` slot moves and the previous slot shows the previous word; answer the sentence `He` / `him`; submit.
  - **Result:** bài header shows `2/3`; only "Câu 2" is marked wrong; the sentence row shows `1/2 ô đúng`.
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/grouped-questions.spec.ts` — Expected: all pass on ipad and iphone.
- [ ] **Step 3: Docs**: CLAUDE.md's Bài bullet gains one sentence on split passages (`blank` on `tra-loi-ngan`, the `checkGroups` rules, `lib/blanks.ts` + `BlankText` for per-blank marks); backlog note: phase 2 (tách chỗ trống) done.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — PASS.
- [ ] **Step 5: Commit** `git commit -m "test: e2e for split passages; document"`
