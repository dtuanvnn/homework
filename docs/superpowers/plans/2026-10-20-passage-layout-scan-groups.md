# Formatted passages, read-aloud and scan auto-grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bài's shared prompt can be formatted like the paper (instruction, title, paragraphs, dialogue) and read aloud, and AI scan returns worksheets already grouped into bài, joined across pages.

**Architecture:** `QuestionGroup.layout` switches on a light markup in `group.prompt`, parsed by a pure `lib/passage.ts` and rendered by one `components/question/Passage.tsx` everywhere a shared prompt shows. Read-aloud is a client hook over `lib/speech.ts`, generalised to English and Vietnamese. Scan gets a scan-only response extension (`groups`, `groupKey`), mapped and joined across pages by pure code in `lib/ai/scan.ts` / `lib/ai/scan-groups.ts`. The review step shows bài with pure editing helpers from `lib/question-groups-edit.ts`.

**Tech Stack:** Next.js (App Router, read `node_modules/next/dist/docs/` before touching routing), React, TypeScript, zod, Vitest, Playwright (WebKit iPad + iPhone), Web Speech API.

**Spec:** `docs/superpowers/specs/2026-10-20-passage-layout-scan-groups-design.md`

## Global Constraints

- All UI text is Vietnamese. Copy fixed by the spec: "Nghe cả bài", "Đoạn văn chưa có câu hỏi", "Gộp vào bài trên", "Tách thành bài riêng", "Bỏ bài", "Trình bày", "Thường" / "Đoạn văn" / "Hội thoại", "Thiết bị chưa có giọng đọc tiếng Việt". Keep the existing "Thiết bị chưa có giọng đọc tiếng Anh".
- `layout` absent ⇒ exactly today's rendering (`<p className="… whitespace-pre-line">` with `RichText` / `BlankText`). No migration, no change for existing sets.
- Layout values are exactly `"doan-van" | "hoi-thoai"`.
- Markup (only when `layout` is set): `# ` line = title (read aloud); a whole line `**…**` = instruction (not read); inline `**…**` = bold; other non-empty lines = paragraphs; blank lines ignored; in `hoi-thoai`, `Name: text` with name ≤ 30 chars and no `$` or `_` = turn.
- Blank k is still the k-th `___` across the whole prompt; `checkBlanks` must keep holding.
- `aiQuestionSchema` and `ai-generate` do not change.
- Speaker only on the take screen and the child's result screen, only when `layout` is set and the subject is `tieng-anh` (voice `en`) or `tieng-viet` (voice `vi`). Never on grading, print, editor, or `toan`.
- Question text renders through `RichText`, figures through `QuestionPicture`. Testable logic lives in `src/lib/` (tests can't import `"server-only"` modules).
- Keep the app's visual language: indigo bài box, take-screen scroll box with max height, scroll kept between câu of a bài.
- Scan join never reaches past an adjacent page; pages added later ("Thêm tệp") are never auto-joined.
- Every passage-only group is kept (never dropped) after the join.

## Review Focus

- An old bài whose plain prompt contains `Mai: hello`, `# 1` or `**x**` renders and reads exactly as today (layout absent) → test in Task 1.
- A split passage whose `___` sit in several paragraphs keeps global blank numbers and stays highlighted/coloured per blank → tests in Tasks 1 and 2.
- The AI returns a `groupKey` that matches no group, or a group whose câu are not contiguous → câu stay standalone, no crash, `checkGroups` passes → tests in Tasks 6 and 7.
- Speech keeps playing after the child moves to a câu of another bài or leaves the take screen → E2E with a stubbed `speechSynthesis` in Task 10.
- A restored scan draft with bài pictures shows them after a reload (signed `group.image`) → test of `draftFigurePaths` in Task 8.

---

### Task 1: `layout` on QuestionGroup and the passage parser

**Files:**
- Modify: `src/lib/types.ts` (`QuestionGroup`), `src/lib/question-schema.ts` (`groupSchema`), `src/lib/question-groups.ts` (`sameGroup`), `src/lib/question-groups-edit.ts` (`updateGroup` drops an empty `layout` as it does `label`), `src/lib/blanks.ts` (`PassagePiece` text piece gains `bold?: boolean`; `passagePieces(prompt, offset = 0)`)
- Create: `src/lib/passage.ts`, `src/lib/passage.test.ts`
- Test: `src/lib/question-groups.test.ts`, `src/lib/question-schema.test.ts` (or wherever the schema is tested)

**Interfaces:**
- Produces:
  - `type PassageLayout = "doan-van" | "hoi-thoai"` (in `types.ts`); `QuestionGroup.layout?: PassageLayout`
  - `interface PassageBlock { kind: "instruction" | "title" | "paragraph" | "turn"; speaker?: string; pieces: PassagePiece[] }`. Blank indices in `pieces` are global (1-based over the whole prompt).
  - `parsePassage(prompt: string, layout: PassageLayout): PassageBlock[]`
  - `readable(block: PassageBlock): boolean`, which is false for `instruction`
  - `speechText(block: PassageBlock): string` drops `$…$` math, turns each blank into `", "` and prefixes a turn with `"<speaker>. "`
  - `passagePieces(prompt: string, offset?: number): PassagePiece[]`

- [ ] **Step 1: Write the failing tests** in `src/lib/passage.test.ts`:
  - `parses the A Giant Rat passage`: the prompt `"**Read the text, then answer the questions in FULL sentences.**\n# A Giant Rat\nRats and mice are well-known rodents.\n\nLike most rodents, the capybara's front teeth never stop growing.\nThe capybara lives near fresh water."` with layout `doan-van` gives kinds `["instruction", "title", "paragraph", "paragraph", "paragraph"]`. The title text is `"A Giant Rat"`.
  - `parses dialogue turns`: `"Mai: Hi, Tom.\nTom: I went to the zoo.\nThey walk home."` with `hoi-thoai` gives turn (speaker `"Mai"`), turn (speaker `"Tom"`), then paragraph.
  - `does not take LaTeX or long prefixes as speakers`: `"$a:b$ là tỉ số"` and a line whose part before `:` is 31 characters are both paragraphs in `hoi-thoai`. `"Mai: hi"` in `doan-van` is a paragraph.
  - `bold inside a line`: `"The **capybara** swims."` gives text pieces `"The "`, `{text: "capybara", bold: true}`, `" swims."`.
  - `keeps blank numbers global`: `"One ___ two.\nThree ___ and ___."` gives blank indices `[1]` and `[2, 3]`.
  - `speechText`: drops `$\frac{1}{2}$`, reads a blank as a pause, and gives `"Mai. Hi, Tom."` for a turn. `readable` is false for the instruction.
  - In `question-groups.test.ts`: `checkGroups` reports "Các câu của một bài phải có cùng đề chung." when two members differ only by `layout`.
  - Schema test: `layout: "doan-van"` survives parsing, and `layout: "x"` is rejected.

- [ ] **Step 2: Run** `pnpm test src/lib/passage.test.ts src/lib/question-groups.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** the type, the schema (`layout: z.enum(["doan-van", "hoi-thoai"]).optional()`), `sameGroup` (compare `layout ?? ""`), `updateGroup` and `passagePieces` offset, then `lib/passage.ts`. Split lines on `\n` and trim each line. Detect a turn with `/^([^:$_]{1,30}):\s+(.*)$/u`. Split bold on `**` pairs, leaving an unpaired `**` as literal text. Count blanks with a running offset across lines.

- [ ] **Step 4: Run** `pnpm test src/lib`. Expected: PASS (all existing tests too).

- [ ] **Step 5: Commit** `feat: passage layout on bài and markup parser`

---

### Task 2: `Passage` component used by every shared-prompt screen

**Files:**
- Create: `src/components/question/Passage.tsx`
- Modify: `src/components/question/BlankText.tsx` (render `bold` text pieces in `<strong>`), `src/components/take/SharedPromptBox.tsx`, `src/components/question/GroupHeader.tsx`, `src/components/schedule/PrintableExercise.tsx`, `src/components/exercise-detail/GroupCard.tsx`

**Interfaces:**
- Consumes: `parsePassage`, `passagePieces`, `PassageBlock` (Task 1)
- Produces: `Passage({ group, renderPieces, reading?, onReadBlock?, className? })` where
  - `group: QuestionGroup`
  - `renderPieces?: (pieces: PassagePiece[]) => ReactNode`; the default is `RichText` for text and `"___"` for blanks
  - `reading?: number` is the index of the block being read, which is highlighted (`bg-yellow-100`, as in the mockup)
  - `onReadBlock?: (index: number) => void`; when given, each readable paragraph or turn shows a small speaker button. Task 3 passes it.

  It renders the prompt and the figure, so callers stop rendering `QuestionPicture` for the group. With `layout` absent the output is exactly today's markup (prompt `<p>`, then the figure below). With `layout` set the figure floats right at `md:` (`md:float-right md:ml-4 md:w-2/5`) and is a full-width block below `md`. Each block also carries `data-block={index}` for scrolling.

- [ ] **Step 1: Implement `Passage.tsx`.** Styling:
  - instruction: `font-bold`
  - title: `text-center font-extrabold`
  - paragraph in `doan-van`: `indent-8`
  - turn: grid `grid-cols-[auto_1fr]` with the speaker in `font-bold text-indigo-800`
  - blocks: `space-y-2`, with `whitespace-pre-line` kept on each block so LaTeX and blanks behave as today

- [ ] **Step 2: Switch the four callers to `Passage`.** Keep their current props:
  - `SharedPromptBox` passes `BlankText` with its `blanks.slots` mapping.
  - `GroupHeader` passes its `passage` slot.
  - `PrintableExercise` passes its "(n) ……………" renderer.
  - `GroupCard` uses the default.
  - `SharedPromptBox` keeps scrolling `[aria-current='true']` into view.

- [ ] **Step 3: Verify** with `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS. Run `pnpm exec playwright test e2e/grouped-questions.spec.ts`. Expected: PASS (old bài render unchanged).

- [ ] **Step 4: Commit** `feat: render formatted passages on take, result, grading, print and editor`

---

### Task 3: Read aloud (English and Vietnamese voices)

**Files:**
- Modify: `src/lib/speech.ts`, `src/components/pages/FlashcardBuilder.tsx`, `src/components/results/WordReview.tsx`, `src/components/take/TakeFlashcards.tsx` (move to the new API with `"en"`), `src/components/take/SharedPromptBox.tsx`, `src/components/take/TakeAssignment.tsx`, `src/components/question/GroupHeader.tsx`, `src/components/results/ResultDetail.tsx`
- Create: `src/components/question/use-passage-reader.ts`, `src/lib/speech.test.ts`

**Interfaces:**
- Consumes: `parsePassage`, `readable`, `speechText` (Task 1); `Passage` `reading` / `onReadBlock` (Task 2)
- Produces:
  - `type SpeechLang = "en" | "vi"`
  - `speechLangFor(subject: SubjectId): SpeechLang | null`, mapping `tieng-anh` to `"en"`, `tieng-viet` to `"vi"` and `toan` to `null`
  - `useVoice(lang: SpeechLang): boolean`
  - `noVoiceMessage(lang: SpeechLang): string`
  - `speak(text, rate, on?: { lang?: SpeechLang; start?; end? })`, with `lang` defaulting to `"en"`
  - `stopSpeaking()`
  - `voiceFor(lang, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null`, a pure helper that prefers `en-US`, then any `en*` / `vi-VN`, then any `vi*`
  - `usePassageReader(group: QuestionGroup, lang: SpeechLang | null)` returns `{ available, hasVoice, reading?: number, playing: boolean, playAll(), playBlock(index), stop(), speed, setSpeed }`; `available` is false when `lang` is null or `layout` is absent
  - `SharedPromptBox` and `GroupHeader` gain `speech?: SpeechLang | null`

- [ ] **Step 1: Write the failing tests** in `src/lib/speech.test.ts`:
  - `voiceFor` picks `en-US` over `en-GB`, picks `vi-VN` for `"vi"`, accepts `vi_VN`, and returns null when no voice matches
  - `speechLangFor` maps the three subjects

- [ ] **Step 2: Run** `pnpm test src/lib/speech.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the `speech.ts` changes.** Keep `NO_VOICE` as `noVoiceMessage("en")` and `useEnglishVoice` as `useVoice("en")` so the flashcard callers keep compiling. Then write `usePassageReader`:
  - `playAll` walks the readable block indices, calling `speak` on each one's `end`.
  - `playBlock` cancels the queue and reads one block.
  - The hook stops on unmount. Because `SharedPromptBox` is keyed by bài, moving to another bài or leaving the page stops it.
  - Rates come from `SPEEDS`.

- [ ] **Step 4: Wire it into the screens.**
  - `SharedPromptBox` header gets a "Nghe cả bài" button, which turns into "Dừng" while playing, plus the compact speed choice.
  - When `available && !hasVoice`, hide the buttons and show `noVoiceMessage(lang)` once.
  - Pass `reading` and `onReadBlock` to `Passage`, and scroll `[data-block=reading]` into view inside the box.
  - `TakeAssignment` passes `speech={speechLangFor(subject)}` and calls `stopSpeaking()` on submit.
  - `ResultDetail` passes `speech={speechLangFor(r.subject)}` to `GroupHeader`. `GradeAttempt` passes nothing.

- [ ] **Step 5: Verify** with `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.

- [ ] **Step 6: Commit** `feat: read formatted passages aloud in English or Vietnamese`

---

### Task 4: "Trình bày" in the bài editor

**Files:**
- Modify: `src/components/exercise-detail/GroupEditorSheet.tsx`, `src/components/pages/ExerciseSetDetail.tsx` (no change beyond types if `GroupEdit` spreads into `updateGroup`)

**Interfaces:**
- Consumes: `PassageLayout` (Task 1), `Passage` (Task 2), `updateGroup` (Task 1 change)
- Produces: `GroupEdit.layout?: PassageLayout`; `GroupEditorSheet` gains `previewOnly?: boolean` (hides "Điểm cả bài"), for reuse in the review step in Task 9

- [ ] **Step 1: Implement** a three-option segmented control labelled "Trình bày", with options Thường (`undefined`), Đoạn văn and Hội thoại.
  - When a layout is chosen, show a live `<Passage group={{ id, prompt, layout }} />` preview instead of `FormulaPreview`, plus the hint line `# tiêu đề · **hướng dẫn** · Tên: lời nói` (the last part only for Hội thoại).
  - Submitting sends `layout`.
  - Switching back to Thường keeps the text unchanged.

- [ ] **Step 2: Verify** with `pnpm typecheck && pnpm lint`. Then check manually with `pnpm dev`: on a seeded set, make a bài, pick Đoạn văn, type `# Tiêu đề`, save, and see the formatted bài on the take screen.

- [ ] **Step 3: Commit** `feat: choose passage layout when editing a bài`

---

### Task 5: Pure bài helpers for scan and review

**Files:**
- Modify: `src/lib/question-groups-edit.ts`
- Test: `src/lib/question-groups-edit.test.ts`

**Interfaces:**
- Produces:
  - `joinPreviousGroup(qs: Question[], groupId: string): Question[]`. The câu of `groupId` are released (lossless, using the existing `release`) and then take the group of the bài directly above. If the item above is not in a bài, nothing changes.
  - `splitGroupAt(qs: Question[], questionId: string): Question[]`. The câu and the ones after it in its bài get a copy of the group with a new id and no `label`. If the câu is already the first of its bài, nothing changes.
  - `splitBlanksInGroup(qs: Question[], groupId: string, min = 3): Question[]`. Applies when every member is a `dien-cho-trong` and together they hold at least `min` blanks:
    - the members merge into one passage (prompts joined with `"\n"`, answers concatenated)
    - then it splits like `splitBlanks`: one blank câu per `___`, 1 point each, with the missing-key rule
    - the bài keeps its `id`, `label`, `layout` and `image`, and its prompt becomes `group.prompt + "\n" + passage` (trimmed)
    - otherwise nothing changes

  Share the blank-câu construction with `splitBlanks` instead of copying it.

- [ ] **Step 1: Write the failing tests:**
  - `joinPreviousGroup` moves Bài 2's câu into Bài 1, and each of them keeps Bài 2's old prompt in front of its own (lossless)
  - `splitGroupAt` on câu 3 of a 4-câu bài gives two bài [1–2] and [3–4] with the same prompt and different ids
  - `splitBlanksInGroup` on a bài `{prompt: "**Fill in.**", layout: "doan-van"}` holding one `dien-cho-trong` with 3 blanks gives 3 blank câu, `group.prompt` = `"**Fill in.**\n<passage>"`, layout kept, and `checkGroups` = null
  - `splitBlanksInGroup` leaves a bài with a `trac-nghiem` member, or fewer than 3 blanks, unchanged

- [ ] **Step 2: Run** `pnpm test src/lib/question-groups-edit.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat: join, split and blank-split helpers for bài`

---

### Task 6: Scan schema, prompt and per-page grouping

**Files:**
- Modify: `src/lib/ai/scan.ts`
- Create: `src/lib/fixtures/giant-rat-scan.ts`, a transcribed AI response for the reference page in the new schema (one bài: instruction, title and 3 paragraphs with layout `doan-van`, a group figure box, 5 `tu-luan` câu with `groupKey`)
- Test: `src/lib/ai/scan.test.ts`

**Interfaces:**
- Consumes: `aiQuestionSchema`, `toQuestion`; `PassageLayout`
- Produces:
  - `scanGroupSchema = z.object({ key: z.string(), label: z.string().nullable(), layout: z.enum(["doan-van", "hoi-thoai"]).nullable(), prompt: z.string(), figure: z.object({ box: z.array(z.number()) }).nullable(), continues: z.boolean().nullable(), midParagraph: z.boolean().nullable() })`
  - `scanResponseSchema` gains `groups: z.array(scanGroupSchema)`, and its `questions` become `aiQuestionSchema.extend({ groupKey: z.string().nullable() })`
  - `ScannedQuestion` gains `groupFigure?: { page: number; box: Box }` (identical on every member of a bài) and `placeholder?: true` (Task 7)
  - `interface ScanPart extends ScanResult { lead?: { groupId: string; continues: boolean; label?: string; midParagraph: boolean }; tail?: { groupId: string; empty: boolean } }`
  - `toScanResult(res, meta, fileCount, newId): ScanPart`:
    - creates one `QuestionGroup` per AI group (`id: uid("bai")`, `label`, `prompt` trimmed, `layout`) on the câu whose `groupKey` matches
    - a `groupKey` that matches no group leaves the câu standalone
    - the group figure box goes through `repairBox` and becomes `groupFigure` on its câu
    - a câu figure box that equals its group's box is dropped
    - `lead` describes the first group if it `continues` and comes before any standalone câu
    - `tail` is the last group on the page (`empty` when it has no câu; such a group is kept as a placeholder item, see Task 7)
    - other groups with no câu are dropped

- [ ] **Step 1: Write the failing tests:**
  - the Giant Rat fixture gives 5 items, all with the same `group.id`, `group.layout` `"doan-van"`, a `group.prompt` starting `"**Read the text"`, câu 1's prompt `"How do capybaras look different from rats and mice?"`, and the same `groupFigure` on all 5
  - a `groupKey` with no matching group leaves the câu without `group`
  - a câu figure equal to the group's box is dropped
  - `lead` and `tail` are set from a page whose first group `continues: true, midParagraph: true`
  - `scanSystemPrompt()` no longer contains "repeat shared context", and does contain "groupKey", "continues", "midParagraph", `# ` and `**`

- [ ] **Step 2: Run** `pnpm test src/lib/ai/scan.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Rewrite the prompt rules from spec §4:
  - emit shared parts once as a bài, keep the printed bài label, and still drop câu numbering
  - passages get a layout and the markup, with lines rejoined where the page only wrapped
  - a fill-in passage becomes a bài (instruction/title) holding one `dien-cho-trong` with the passage and its `___`
  - plain Toán instructions form a bài with layout null
  - one bài-level figure box
  - `continues` / `midParagraph` at the top of a page, and a passage cut before its questions is still emitted as a group

  Replace the batch sentence in `scanRequestText` ("transcribe the part shown here") with one that asks for `continues`. Update the existing test fixtures for the new required fields (`groups: []`, `groupKey: null`).

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat: scan returns bài with formatted passages per page`

---

### Task 7: Cross-page join, cloze split, orphans and validation

**Files:**
- Create: `src/lib/ai/scan-groups.ts`, `src/lib/ai/scan-groups.test.ts`
- Modify: `src/lib/ai/scan.ts` (`mergeScanResults(parts: ScanPart[]): ScanResult` calls `finalizeScanGroups`), `src/server/actions/ai-scan.ts` (types only)

**Interfaces:**
- Consumes: `ScanPart` (Task 6); `splitBlanks`, `splitBlanksInGroup`, `updateGroup`, `ungroup` (Task 5); `normalizeGroups`, `checkGroups`
- Produces:
  - `joinPages(parts: ScanPart[]): ScannedQuestion[]`. Runs in page order; when page N has a `lead` and page N−1 has a `tail`, and the labels match or the lead has none:
    - the lead group's câu take the tail group's id and fields
    - the lead's prompt is appended to every member's `group.prompt`: with a space onto the last line if `midParagraph`, otherwise after `"\n"`
    - if the last câu before the boundary and the first câu after it are both `dien-cho-trong`, they merge into one (prompt joined the same way, answers concatenated)
    - an empty tail placeholder that got câu this way disappears
    - a tail that is still empty, followed on page N by leading standalone câu (with no `lead`), takes those câu instead
  - `finalizeScanGroups(items: ScannedQuestion[]): ScannedQuestion[]` applies, in order:
    - `splitBlanksInGroup` on every bài
    - `splitBlanks` on every standalone `dien-cho-trong` with ≥ 3 blanks, followed by `updateGroup(…, { layout: "doan-van" })`
    - `normalizeGroups`
    - `ungroup` of every bài that is not contiguous, until `checkGroups` is null

    New blank câu inherit the source item's `page`, `confidence` and `note`, and the source item's `groupFigure` if it had one.
  - The placeholder for an empty passage is an item with `placeholder: true` whose question is a `tu-luan` with an empty prompt, 0 points (it never saves) and the group.

- [ ] **Step 1: Write the failing tests** in `scan-groups.test.ts`, with small hand-built `ScanPart`s:
  - two pages, where page 2's lead `continues` with no label: one bài holding câu from both pages, prompt with `"\n"` between the page texts
  - the same case with `midParagraph`: joined with a space, so `parsePassage` sees one paragraph across the boundary
  - lead label "Part 3" against tail label "Part 2": two separate bài
  - no joining across a page that has no lead (page 1 tail, page 2 standalone first, page 3 lead): page 3 stays separate
  - a cloze passage split over two pages: 4 + 3 blanks give 7 blank câu numbered 1–7, and `checkGroups` is null
  - an empty tail followed by leading standalone câu: they join it, with no placeholder left
  - an empty tail on the last page: a placeholder item remains
  - a non-contiguous AI bài is ungrouped and `checkGroups` is null
  - a standalone 3-blank `dien-cho-trong` becomes a split passage with `layout: "doan-van"`

- [ ] **Step 2: Run** `pnpm test src/lib/ai/scan-groups.test.ts src/lib/ai/scan.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat: join bài across scanned pages and split cloze passages`

---

### Task 8: Upload flow: bài figures, drafts, placeholders

**Files:**
- Modify: `src/components/pages/UploadFlow.tsx` (`cropFigures`, `restoreDraft`, save guard), `src/components/upload/review-utils.ts`
- Test: `src/components/upload/review-utils.test.ts`

**Interfaces:**
- Consumes: `ScannedQuestion.groupFigure`, `placeholder` (Tasks 6 and 7)
- Produces:
  - `draftFigurePaths(items: ReviewItem[]): string[]` returns the paths of `question.image` and `question.group.image`, without duplicates
  - `withSignedFigures(items: ReviewItem[], urls: Record<string, string>): ReviewItem[]` sets `imageUrl` on both
  - `hasPlaceholder(items: ReviewItem[]): boolean`
  - `appendScanned` shifts the page of `groupFigure` too

- [ ] **Step 1: Write the failing tests:**
  - `draftFigurePaths` returns a group image path once, even when 3 câu share it
  - `withSignedFigures` sets `group.imageUrl` on every member
  - `appendScanned` shifts the page of `groupFigure`

- [ ] **Step 2: Run** `pnpm test src/components/upload/review-utils.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `cropFigures` queues each unique `page:box` from `figure` and from `groupFigure`. A crop from a group box writes `group.image` / `group.imageUrl` on every item of that `group.id`, and still sets `figureState`.
  - `restoreDraft` uses `draftFigurePaths` and `withSignedFigures`. Remove the stale "Scan drafts never carry bài" comment.
  - Saving is disabled while `hasPlaceholder(items)`, with the reason "Đoạn văn chưa có câu hỏi" shown where the incomplete count is shown today.

- [ ] **Step 4: Verify** with `pnpm test && pnpm typecheck && pnpm lint`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: crop bài figures and keep bài in scan drafts`

---

### Task 9: Review step shows and edits bài

**Files:**
- Modify: `src/components/upload/ReviewStep.tsx`, `src/components/upload/ExtractedQuestionCard.tsx` (show nothing of the group itself; numbering stays set position)
- Create: `src/components/upload/ReviewGroupCard.tsx`

**Interfaces:**
- Consumes:
  - `groupBlocks`
  - `joinPreviousGroup`, `splitGroupAt`, `ungroup`, `updateGroup`, `releaseQuestion`, `canRelease`, `joinGroup` (Tasks 1 and 5)
  - `GroupEditorSheet` with `previewOnly` (Task 4)
  - `Passage` (Task 2)
  - `hasPlaceholder` (Task 8)
- Produces: `withQuestions(items: ReviewItem[], questions: Question[]): ReviewItem[]` in `review-utils.ts`. It replaces each item's question by id and keeps the item fields; an item whose id is gone is dropped. All review bài operations are `withUndo(withQuestions(items, op(items.map(i => i.question))), message)`.

- [ ] **Step 1: Write the failing test** in `review-utils.test.ts`: `withQuestions` keeps `page`, `confidence` and `figure`, and applies the new `group`.

- [ ] **Step 2: Run** `pnpm test src/components/upload/review-utils.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - The list renders `groupBlocks(items)`. Each bài is a `ReviewGroupCard` (title, `Passage`, figure with "Chỉnh khung" through `FigureCropDialog` writing `group.image`) wrapping its `ExtractedQuestionCard`s.
  - The bài menu has: "Sửa bài" (opens `GroupEditorSheet`), "Gộp vào bài trên" (only when the block above is a bài), "Bỏ bài".
  - Each câu in a bài has "Tách thành bài riêng" (not on the first câu) and "Đưa ra khỏi bài" (when `canRelease`).
  - A standalone câu next to a bài has "Đưa vào bài trên/dưới" (`joinGroup`).
  - A placeholder renders inside its bài card as an amber notice "Đoạn văn chưa có câu hỏi", with "Đưa câu dưới vào bài" (joins the next standalone câu, then removes the placeholder) and "Xóa đoạn văn".
  - "Gộp với câu trên" inside a bài keeps the upper câu's group.

- [ ] **Step 4: Verify** with `pnpm test && pnpm typecheck && pnpm lint`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: show and edit bài in the scan review step`

---

### Task 10: E2E and docs

**Files:**
- Create: `e2e/passage-layout.spec.ts`
- Modify: `CLAUDE.md` (Domain rules: bài layout and markup, read-aloud, scan grouping and join), `docs/backlog.md` (mark phase 3 done; remove "Bài đọc"/"Đã đọc"; keep the answer-key-page matching, Reports, `leaksAnswer` and ai-generate items)

**Interfaces:**
- Consumes: `createSetWithQuestions`, `assign` (`e2e/db.ts`); the scan-draft restore path used by `e2e/answer-keys.spec.ts`

- [ ] **Step 1: Write the tests:**
  - `a formatted passage reads like the paper` (Tiếng Anh set created through `createSetWithQuestions`, with a bài `layout: "doan-van"` whose prompt has an instruction, `# A Giant Rat` and 2 paragraphs, plus 2 câu; then `assign`). On the take screen, "A Giant Rat" is visible and centred (heading text check), the instruction is bold, and the "Nghe cả bài" button is visible.
  - `speech stops when leaving the bài`. Install an init script that stubs `speechSynthesis` (fake voices `en-US` and `vi-VN`, `speak` records texts, `cancel` counts calls). Then:
    - tap "Nghe cả bài": the first recorded text is the title, and the instruction is never recorded
    - go to a câu outside the bài: `cancel` was called
  - `a scanned worksheet arrives as one bài` (ipad only). Restore a scan draft whose 3 items share a group with `layout: "doan-van"`, then:
    - the review shows one bài card with the passage once
    - "Tách thành bài riêng" on câu 2 gives two bài
    - undo restores one bài
    - save opens the set with one bài

- [ ] **Step 2: Run** `pnpm exec playwright test e2e/passage-layout.spec.ts`. Expected: PASS on ipad and iphone.

- [ ] **Step 3: Update `CLAUDE.md` and the backlog.**

- [ ] **Step 4: Run the full check:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`. Expected: all PASS.

- [ ] **Step 5: Commit** `test: e2e for formatted passages and scanned bài; document`
