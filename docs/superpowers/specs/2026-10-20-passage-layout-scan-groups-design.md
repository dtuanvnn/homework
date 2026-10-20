# Formatted passages, read-aloud and scan auto-grouping: design, grouped questions phase 3

Date: 2026-10-20 · Status: draft design · Builds on `2026-10-20-grouped-questions-design.md` (phase 1) and `2026-10-20-split-blanks-design.md` (phase 2) · Backlog: `docs/backlog.md` → "Bài có nhiều câu hỏi con (kèm bài đọc)": items "Bài đọc", "Quét đề", "Bài bị cắt qua hai trang", and the *Quét đề* edge cases.

## Why

Real English and Vietnamese worksheets are reading comprehension: an instruction, a titled passage or a dialogue, often a picture, then questions about it. The reference is the production set "Reading Worksheet 3 – A Giant Rat" (Tiếng Anh, Lớp 3, one scanned page). On paper it has a bold instruction ("Read the text, then answer the questions in FULL sentences."), a bold centred title, three indented paragraphs with the capybara picture beside them, then "Questions 1–5". In the app:

1. The scan copied the whole passage into each of the 5 câu, because `lib/ai/scan.ts` tells the model to "repeat shared context … in each part's prompt" and has no notion of bài. A bài only appears if the parent later presses "Tự chia bài" in the set editor.
2. Even inside a bài, the shared prompt renders as plain lines (`whitespace-pre-line`): instruction, title and paragraphs all look the same, and the picture always sits under the text.

The user also wants the device to **read the passage aloud** so the child can listen while reading. This is a reading aid. The passage always stays visible. Listening tests ("Listen and choose", text hidden) are not supported.

## Decisions made with the user

1. **This is not a "reading-only bài".** The backlog's "Bài đọc" (a bài with no câu, finished by "Đã đọc", 0 points) is dropped. It was a misunderstanding. Every bài still has at least one câu.
2. **Formatted like the paper.** A shared prompt can show an instruction (bold), a title (bold, centred), paragraphs (first-line indent, space between them) or a dialogue (speaker name bold, one turn per line). The bài picture sits beside the text on iPad and below it on iPhone. Mockup accepted: `.superpowers/brainstorm/…/passage-layout.html`.
3. **Old sets stay as they are.** Nothing is migrated or re-rendered differently. Only new scans, or a parent who edits a bài, get formatting.
4. **Speaker button, option A.** A "Nghe cả bài" button in the bài header reads the passage block by block and highlights the block being read. Each paragraph or dialogue turn also has its own small speaker button to replay just that block.
5. **Scan groups bài by itself**, in this phase. A scanned worksheet arrives with its bài already formed: the shared prompt and picture appear once, and each câu holds only its own part. That includes bài cut across two pages.
6. Claude's guesses below were played back and the user had no corrections: storage as light markup in the prompt text, where formatting and speakers appear, voice chosen by subject, the instruction not read aloud, stopping when leaving the bài.

## Goals

- Scanning the A Giant Rat page gives one bài: label taken from the paper if any (else "Bài 1"), layout "đoạn văn", the instruction, title and 3 paragraphs in the shared prompt, the capybara picture as the bài picture, and câu 1–5 holding only "How do capybaras look different from rats and mice?" etc.
- A two-page worksheet whose bài continues on page 2 arrives as one bài, not two.
- On the take screen the passage looks like the paper. "Nghe cả bài" reads it in an English voice with the current block highlighted, and each block can be replayed.
- A Tiếng Việt passage reads in a `vi-VN` voice.
- Every set that exists today renders exactly as before.

## Non-goals

- Listening exercises (hidden text), reading-only bài, "Đã đọc".
- AI generate (`ai-generate`) producing bài: it keeps single câu. Its schema must not change (it shares `aiQuestionSchema`).
- Matching an answer-key page at the end of the document to bài by label and letter ("Bài 3: a) … b) …"). With one page per request, a key on a later page is still never seen. This is an existing gap and stays in the backlog.
- Reports grouped by bài, counts like "5 bài · 25 câu", `leaksAnswer` comparing against the passage: these stay in the backlog.
- Formatting inside a câu's own prompt. Formatting applies only to a bài's shared prompt.
- Re-formatting or re-grouping old sets automatically.

## Constraints from the codebase

- A bài is stored as identical copies of `question.group` on every câu (`lib/question-groups.ts`, `normalizeGroups` / `checkGroups`). Snapshots in `answers.question`, the offline pack and AI requests carry it. Anything added to `QuestionGroup` travels the same way, must be accepted by `question-schema.ts` (zod strips unknown keys, as phase 1 found), and must be part of `sameGroup`.
- `QuestionGroup.prompt` may contain LaTeX (`RichText`) and, for a split passage, `___` blanks whose order is the blank index (`passagePieces`, `checkBlanks` counts them). Formatting must keep both working: blank k is still the k-th `___` across the whole prompt.
- `aiQuestionSchema` / `toQuestion` are shared with `ai-generate`. Scan-only grouping fields go in a scan-specific schema around it.
- Scan runs one file per request, all files in parallel on the server (`SCAN_BATCH_FILES = 1`, `Promise.all` in `server/actions/ai-scan.ts`), then `mergeScanResults` concatenates. A failed request fails the whole scan today. Pages added later ("Thêm tệp") are scanned in a separate call and appended (`appendScanned`).
- Figures: the scan returns one box per câu, and câu sharing a picture repeat the box. `cropFigures` in `UploadFlow.tsx` crops each unique `page:box` once and writes `question.image`. Nothing writes `group.image` during a scan.
- The scan review step (`components/upload/ReviewStep.tsx`) only offers delete and "Gộp với câu trên" (`mergeQuestions`). Bài operations exist only in the set editor (`QuestionList`, `lib/question-groups-edit.ts`). Scan drafts (`lib/scan-draft.ts`) assume no `group`, and `restoreDraft` only signs `question.image`.
- `lib/speech.ts` only picks an English voice (`englishVoice`, `useEnglishVoice`, `NO_VOICE` says "tiếng Anh"). It is used by flashcards.

## Design

### 1. Data: `QuestionGroup.layout` + light markup

- Add `layout?: "doan-van" | "hoi-thoai"` to `QuestionGroup`, the zod schema and `sameGroup`. **Absent means today's plain rendering**, which is how old sets stay unchanged (decision 3).
- The markup lives in `group.prompt` as plain text, so the parent still edits one textarea. It applies only when `layout` is set (Claude's call):
  - A line starting with `# ` is the **title**: bold and centred. It is read aloud.
  - A line wrapped entirely in `**…**` is an **instruction**: bold, not indented. It is not read aloud. `**…**` inside a line makes those words bold; this is the only inline mark.
  - Every other non-empty line is a **paragraph**: one line per paragraph, first-line indent in `doan-van`. Blank lines are ignored.
  - In `hoi-thoai`, a line `Name: text` (name ≤ 30 characters, no `$` or `_`) is a **turn**: the name is bold, and the text sits in a hanging column. Other lines are unindented paragraphs (narration).
  - LaTeX `$…$` and `___` work inside any block as today.
- Pure parser `lib/passage.ts`: `parsePassage(prompt, layout) → PassageBlock[]` with `{ kind: "instruction" | "title" | "paragraph" | "turn", speaker?, text, firstBlank }`, where `firstBlank` is the global index of the block's first `___` so blank numbering stays global. Also `speechText(block)`, which drops `**`, drops `$…$` math, turns `___` into a pause, and puts the speaker name before the turn ("Mai. Hi, Tom…"). Unit tested, including the A Giant Rat text and a split passage with blanks spread over several paragraphs.

### 2. Rendering: one `Passage` component

- `components/question/Passage.tsx` renders a group's prompt: the formatted blocks when `layout` is set, otherwise exactly today's `<p class="whitespace-pre-line">` with `RichText` / `BlankText`. It takes the same blank slot callback as today, so split passages keep their numbered, highlighted or coloured blanks.
- Used everywhere a shared prompt appears: `SharedPromptBox` (take), `GroupHeader` (grading, result), `PrintableExercise` (print) and `GroupCard` (editor preview).
- When `layout` is set, the bài picture floats beside the text at `md` and up and goes below on small screens. Without `layout` it stays where it is today.
- Keep today's visual language: the indigo bài box, the scroll box with max height on the take screen, and the scroll position kept between câu of one bài.

### 3. Read aloud

- **Where:** take screen (`SharedPromptBox`) and the child's result screen (`GroupHeader` in `ResultDetail`), only for bài with `layout` set and a subject of Tiếng Anh or Tiếng Việt. There is no speaker on grading, print, the editor or Toán sets.
- **Voice by subject:** generalise `lib/speech.ts` to a language (`"en" | "vi"`): `voiceFor(lang)`, `useVoice(lang)`, `speak(text, rate, { lang, … })`, and a no-voice message per language ("Thiết bị chưa có giọng đọc tiếng Việt"). Flashcards keep calling it with `"en"`. With no matching voice, the buttons are hidden and that message is shown once in the box.
- **Controls (decision 4):** "Nghe cả bài" in the box header reads every readable block in order (title, paragraphs, turns; not instructions) and becomes a stop button while reading. The block being read is highlighted, as in the mockup, and scrolled into view inside the box. Each paragraph or turn has a small speaker button that reads that block alone; pressing it during "Nghe cả bài" stops the queue and plays just that block. Speed: reuse the flashcard `SPEEDS` choice in a compact form (Claude's call, the builder picks the placement).
- **Stopping:** moving to a câu of another bài, leaving the page, submitting, or opening another speaker stops speech (`stopSpeaking()`). Moving between câu of the same bài keeps reading, because the box is keyed by bài.
- Works offline (device voices). Safari needs the first `speak()` inside a tap, which it always is.

### 4. Scan groups bài

**Prompt (`lib/ai/scan.ts`).** Replace "repeat shared context in each part's prompt" with: when several answerable parts share an instruction, passage, dialogue or picture, emit that **once** as a bài and keep in each câu only its own part. Keep the bài label as printed ("Bài 3", "Part 2", "Exercise 1"), and still drop the câu numbering. For a passage, set the layout and write the markup from §1: title, instruction, one line per paragraph or turn, and lines rejoined where the page merely wrapped. Plain shared instructions (e.g. Toán "Bài 2. Tính: a) … b) …") form a bài with no layout. The picture of a bài gets one box at bài level.

**Schema (scan only).** The scan response gets `groups: [{ key, label?, layout?, prompt, figure?, continues?, midParagraph? }]`, and each scanned question gets an optional `groupKey`. `key` is unique within one page. `continues: true` marks a bài at the top of a page that started on an earlier page; its `label` is given if visible, and its `prompt` holds only the passage text shown on this page (may be empty). `midParagraph: true` says that text starts in the middle of a paragraph cut by the page break. `aiQuestionSchema` itself does not change.

**Fill-in passages (cloze).** The AI emits them as today, one `dien-cho-trong` câu holding the passage with its `___`, placed in a bài whose prompt is the instruction (and title) and whose `layout` is `doan-van`. Mapping then splits it inside that bài: a bài whose câu are only `dien-cho-trong` with ≥ 3 blanks in total becomes a split passage (phase 2), with prompt = the bài's instruction/title lines + the passage, the bài's `layout` and label kept, and one blank câu per `___`. That needs a new pure helper next to `splitBlanks` that splits inside an existing bài (today `canSplitBlanks` requires `!q.group`). A standalone `dien-cho-trong` with ≥ 3 blanks is still split as "Tự chia bài" does, and gets `layout: "doan-van"`. A cloze passage cut across pages: after the join, its consecutive `dien-cho-trong` câu are first merged into one (prompts joined per `midParagraph`, answers concatenated), then split, so blanks are numbered 1..N over the whole passage and `checkGroups` holds.

**Mapping (pure, in `lib/ai/`, tested).** Order: per page map → join pages → split cloze → validate. `toScanResult` turns each page's groups into `QuestionGroup`s with fresh ids on the matching câu. A group with no câu on its page is dropped unless it is the last group on the page (a passage cut before its questions). Then the cross-page join runs in `mergeScanResults` (in page order): a `continues` group at the top of page N joins the last bài of page N−1 when the labels match or it has no label. Its câu get that bài's id, and its prompt text is appended to the bài prompt: joined with a space onto the last line when `midParagraph`, otherwise on a new line. A labelled `continues` group whose label does not match stays a separate bài. Joining never reaches past an adjacent page, and pages appended later by "Thêm tệp" are not joined to earlier ones (the review step fixes that by hand).

A passage still without câu after the join (Claude's call): if the next page begins with standalone câu (before any bài), those câu join it, since the AI most likely missed `continues`. Otherwise the passage is **never dropped**. It reaches the review step as an empty bài flagged "Đoạn văn chưa có câu hỏi", and saving is blocked until the parent moves câu into it or deletes it. This is the only place a bài with no câu exists, and it never leaves the review step.

Câu that end up in no bài stay standalone. Finally `normalizeGroups` and `checkGroups` must pass; if they don't (AI produced a non-contiguous bài), the offending bài is released (lossless, `releaseQuestion`) rather than failing the scan.

**Figures.** A bài box is cropped like a câu box (dedupe by `page:box`, snap) and written to `group.image` on every câu of the bài. If the AI also repeats that box on câu, the câu copies are dropped in favour of the bài picture. Scan drafts store `group`, and `restoreDraft` signs `group.image` too.

**Review step.** `ReviewStep` lists items through `groupBlocks()`. Each bài shows its header (title, `Passage` preview, picture) with: edit the bài (the editor's `GroupEditorSheet`, extended below), "Gộp vào bài trên" (join this bài's câu to the bài just above it), "Tách thành bài riêng" (move a câu and those after it in the bài into a new bài), and "Bỏ bài" (ungroup, lossless). A câu can be moved out of or into an adjacent bài. Reuse `lib/question-groups-edit.ts`; add pure helpers there for join-with-previous and split-at, with tests. "Gộp với câu trên" keeps working inside a bài and keeps the bài. The builder decides whether the review step shares components with `QuestionList` or gets lighter ones.

### 5. Editing a bài

`GroupEditorSheet` gets a "Trình bày" choice: Thường (no layout) / Đoạn văn / Hội thoại, a live `Passage` preview under the textarea, and a one-line hint of the marks (`# tiêu đề`, `**hướng dẫn**`, `Tên: lời nói`). Choosing Thường on a formatted bài keeps the text (the marks show literally), so it is reversible. This is also how a parent formats an old bài if they want to (decision 3).

### 6. Everything else that touches the prompt

- `fullPrompt()` (AI solve, grading, hints) sends the prompt as is; the marks are harmless to the model. No change.
- "Tự chia bài" (`suggestGroups`) on old sets keeps producing groups without layout.
- Offline pack, snapshots and `withLaterAnswerKey` need nothing new beyond `layout` riding along in `group`.
- Releasing a câu from a formatted bài (`release()`) puts the prompt with marks back into the câu; the câu shows it as plain text with the marks. This is accepted (Claude's call).

## Calls Claude made (user can overrule)

- Markup in the prompt text instead of structured blocks, and active only when `layout` is set. Old text never changes look, and the parent keeps one textarea.
- A whole-line `**…**` is the instruction mark. `#` is the title. Dialogue turns are detected by `Name:` only in `hoi-thoai`.
- The speaker reads the speaker name before each turn, skips instructions, and says nothing for blanks (a short pause).
- No speaker on grading or print. No speaker on Toán sets, even with a passage.
- A bài AI returns that breaks `checkGroups` is released, not fatal.
- Pages added later are not auto-joined.
- Auto-split of passages with ≥ 3 blanks also runs after scan. A cloze passage inside a scanned bài is split inside that bài and keeps its layout, so it is formatted and has the speaker.
- A passage left without câu is never dropped: it is either joined to the next page's leading standalone câu, or shown in review as an empty bài that blocks saving.
- `midParagraph` added to the scan schema so a paragraph cut by the page break is joined back into one paragraph.

## Left to the builder

- Exact styling, spacing, icons and the placement of the speed choice, within the accepted mockup and the app's visual language.
- Whether the review step reuses `QuestionList` pieces.
- The precise prompt wording and few-shot examples, as long as the schema and rules above hold. Test the prompt pieces as `scan.test.ts` does today.
- A test fixture for the A Giant Rat page (transcribed AI output, no live model call) and a two-page join fixture. Keep `fixtures/life-in-the-wild.ts` passing for `suggestGroups`.
- E2E: one take-screen spec that a formatted bài renders (title, instruction, paragraphs) and that the speaker button is present for Tiếng Anh. Speech itself is not asserted, since WebKit in CI has no voices; stub `speechSynthesis` if needed.
