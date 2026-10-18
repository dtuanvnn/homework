# Vocabulary flashcards (Từ vựng – Flashcard) — design

Date: 2026-10-19 · Status: draft design, not implemented

## Goal

The child learns the new words of each unit of the English textbook **Oxford Discovery 2** until they can **write each word correctly from memory**. The parent pastes a unit's word list, AI writes a short child-friendly English explanation per word, the parent assigns it. The child studies the words as flip cards (hearing each word read aloud at three speeds), then writes every word **by hand** from the explanation and the audio alone. The parent looks at the handwriting and marks each word right or wrong.

Today the only English practice is ordinary question sets. There is no word list, no text-to-speech, and handwriting exists only inside essay answers (`tu-luan`).

Success: the parent pastes 12 words of Unit 3, presses "AI viết giải thích", fixes one explanation, saves and assigns it for tonight. On the iPad the child flips through the 12 cards, taps 🐢 "Chậm" to hear "rainforest" slowly, marks each "Em thuộc rồi", switches to "Viết từ", sees only "A thick forest with tall trees where it rains a lot." plus the speaker buttons, writes *rainforest* with the Pencil, and so on for all 12; presses "Nộp bài". The attempt shows up in the parent's "Chấm bài" queue; the parent sees each correct word next to the child's handwriting, taps ✓/✗, gets "Đúng 10/12 từ · 8,3/10", finishes. The child's result screen lists the two wrong words with the right spelling and a speaker button.

### Decisions made with the user

- Source of words: the unit word lists of Oxford Discovery 2. The parent only has a PDF with bare words (no meanings, pictures or audio). **No PDF upload**: the parent pastes the words into a text box.
- It is a **new, separate kind of exercise**, not a variant of the existing question sets.
- **No Vietnamese meaning anywhere.** Each word gets a short **English explanation**, written by **AI**, which the parent reviews and edits before assigning.
- Pronunciation: the word is read aloud at **three speeds** (normal / slow / very slow).
- The goal is memorising and **spelling correctly**; the test is **handwritten** (Apple Pencil or finger).
- **The parent grades by hand** — no AI handwriting recognition.
- Screens were drawn in Figma Make from Prompts 16–18 (to be added to `docs/figma-prompts.md`); the export lives in `design/figma-flashcard/` as visual reference (`FlashcardBuilder.tsx`, `TakeFlashcardAssignment.tsx`, `FlashcardGrading.tsx`, `lib/flashcards.ts`). Keep its look, animations and sounds; rebuild on the app's real components.

### Where the build deviates from the Figma export (on purpose)

- **Writing phase hides the word.** The export shows the word on the writing card (with a "Che từ" toggle) and no explanation. The user's requirement is that the child writes from memory: show the **English explanation + the three speaker buttons, never the word**. Confirmed by the user ("ẩn hoàn toàn"); no "Che từ"/"Hiện từ" toggle.
- The export's writing pad is a raster `<canvas>`; the app stores vector ink (`lib/ink.ts`) so the parent's view, the PNG renderer and the handwriting badge keep working.
- The export's definitions are a hard-coded dictionary; the app calls the real LLM.
- The grading screen in the export draws fake handwriting with a font; the app renders the real ink with `HandwritingView`.

### Non-goals

- Pictures, Vietnamese translations, IPA, example sentences.
- PDF/photo upload or AI scanning of word lists.
- AI reading the handwriting or auto-grading spelling.
- Spaced repetition / Anki-style scheduling, games, typed spelling tests.
- Paper mode (printing a word list) — flashcard assignments are web only.
- Recorded human audio or server-side TTS.

### Anti-goals (failure even if it "works")

- The child can see the word while writing it.
- The child needs the internet to study or write (offline already works for web homework and must keep working).
- Grading a 12-word attempt takes the parent more taps than one per word.
- Existing question sets, the take screen, grading, offline sync or rewards change behaviour.

## Data model

Reuse the whole assignment pipeline (sets → questions → assignments → attempts → answers) by making **each word one question of a new type**, so assigning, drafts, offline packs, submit/sync, the grading queue, scores, stars and results keep working.

- **New question type `tu-vung`** in `QuestionType` / `Question` (`src/lib/types.ts`) and `question-schema.ts`:
  `{ type: "tu-vung", word: string, prompt: <English explanation>, points: 1, skills: [] }`.
  `word` is trimmed, 1–60 chars, letters/spaces/hyphens/apostrophes (multi-word items like "polar bear" are allowed). `prompt` is 1–300 chars.
- **Response** = `{ ink: Ink }` (an `EssayValue` with empty `text`, so `reward-facts.ts` counts it for the handwriting badge). No ink or zero strokes = blank.
- **Grading** (`gradeQuestion`): `tu-vung` → blank ⇒ `WRONG`; any ink ⇒ `NEEDS_PARENT`. The attempt then waits in "Chấm bài" exactly like essays; parent marks become `isCorrect` with 1 or 0 points, and the existing score maths gives correct/total × 10.
- **Set format**: new column `exercise_sets.format` enum `cau-hoi | flashcard`, default `cau-hoi` (migration; existing rows unchanged). A flashcard set has subject `tieng-anh`, `kind` `chu-de`, source `ai` or `thu-cong`, and only `tu-vung` questions; normal sets never contain `tu-vung`. Do **not** reuse the existing `kind` column (it is a label: đề thi / chủ đề / luyện tập).
- **Offline/answer keys**: `toTakeQuestion` keeps `word` for `tu-vung` — the device needs it for text-to-speech in both phases and for the study cards. Accepted: a curious child could find it in devtools; the UI never shows it during writing.
- **Ink size**: a word is written on a short strip, not a 1000×700 notebook page. The builder may add a page-size variant to `Ink` (e.g. an optional `size` for a wide single-line strip) as long as `inkSchema`, `HandwritingView`, `ink-image.ts` and existing ink stay valid.

## Parent: create a word set

Entry: "+ Thêm bài tập" (`AddExerciseMenu`) gets a 4th option **"Từ vựng (Flashcard)"** (Layers icon) → new page `/parent/library/flashcard/new`; editing an existing flashcard set opens the same builder (`/parent/library/[setId]` routes flashcard sets to it). Add the route titles in `components/layout/routes.ts`.

Builder (follow `FlashcardBuilder.tsx`):
- Fields: **Tên bộ** (required, e.g. "Unit 3 – Từ mới"), **Chủ đề** (e.g. "Where Do Animals Live?"), **Lớp**. Book and unit are just part of the title/topic text — no extra columns (builder's call; the export has separate "Sách"/"Unit" inputs, which may stay as helpers that fill the title).
- **Textarea "Dán danh sách từ"**: one word per line; also accepts "a / b / c" on one line; trims, drops blank lines and case-insensitive duplicates (`parseWordList` in the export). Live counter "Đã nhận 12 từ". Max 40 words per set.
- **"AI viết giải thích"** (sparkle): one server action call for the whole list → one explanation per word, filled into editable word cards. Skeleton state while waiting. Words already having an explanation keep it unless the parent asks to rewrite.
- Word card: word (editable), speaker button (normal speed), **Giải thích (tiếng Anh)** textarea, **"Viết lại"** (AI rewrites this one word, different wording), delete with undo toast, drag to reorder.
- Footer: "Lưu nháp", "Lưu & sẵn sàng", "Giao bài này" (existing `AssignSheet`, with paper mode hidden/disabled for flashcard sets). Saving requires a title and ≥1 word with a non-empty explanation.
- Library grid: flashcard sets show a "Flashcard" badge and "12 từ" instead of "12 câu"; add a format filter only if trivial.

AI (new server action next to `ai-generate.ts`, prompt in `lib/ai/`): input words, topic, grade; output `{ word, definition }[]` in the same order. Prompt rules: one sentence, ≤ 15 words, simple vocabulary a Grade 2–4 learner knows, never contains the word itself or an obvious form of it (so the explanation doesn't give away the spelling), no Vietnamese, matches the unit topic when the word has several meanings. Validate with zod; on mismatch/failure show a toast and leave the cards editable. Uses `ask()` from `server/ai/llm.ts` (DeepSeek in prod). Parent-only, like the other AI actions.

## Student: study and write

The do-page (`student/assignments/[id]/do`) renders a new **`TakeFlashcards`** component instead of `TakeAssignment` when the set's format is `flashcard`, inside the existing `TakeRoute` (drafts, offline adapter, timer if any, submit). Follow `TakeFlashcardAssignment.tsx` for layout, motion and sounds. Full-screen, top bar with X ("Lưu và thoát?"), title, progress bar, segmented **"1. Học từ" / "2. Viết từ"**.

**Phase 1 – Học từ**
- Big flip card: front = the word huge; tap → 3D flip → back = the English explanation.
- Three speaker buttons under the card: **"Bình thường"** (rate 1), **"Chậm"** (0.7), **"Rất chậm"** (0.45); the active one pulses while speaking.
- "Từ trước"/"Từ tiếp", swipe, counter "Thẻ 4/12", button **"Em thuộc rồi"** marks the card and moves on.
- When every card is marked: **"Sang phần Viết từ"**. "Viết từ" is locked until all cards are marked, except when the attempt already has handwriting (resuming).
- Study marks are not graded and not sent to the server; keeping them in the local draft is enough.

**Phase 2 – Viết từ**
- Card shows the **English explanation** in a speech bubble and the **same three speaker buttons**. **The word is never shown.**
- Below: a wide lined handwriting strip (ink editor variant: pen, eraser, undo, "Xóa hết"; Pencil and finger as in `InkEditor`).
- Moving between words: "Câu trước"/"Câu tiếp", counter, a word-number grid (sheet) showing written / not written. No right/wrong feedback.
- Each change autosaves through the existing draft path (works offline).
- End: summary "Đã viết 11/12 từ – còn 1 từ chưa viết", **"Nộp bài"** with confirm (blank words allowed; they count as wrong). Success/offline-queued messages and celebration are the existing ones.

**Text-to-speech** (`lib/speech.ts`, client only): `speechSynthesis` with an English voice (`en-US`, falling back to any `en-*`); cancel on navigation/unmount; if the API or an English voice is missing, the speaker buttons show disabled with a tooltip "Thiết bị chưa có giọng đọc tiếng Anh". iPad's built-in voices work offline. Safari needs the first `speak()` inside a tap (it always is here).

## Parent: grade

From the "Chấm bài" queue (item reads "Unit 3 – Từ mới · 12 từ viết tay · chờ chấm"), a flashcard attempt opens a **flashcard grading view** (follow `FlashcardGrading.tsx`) instead of the per-question grader:
- One row per word: correct word (green), explanation (small grey), the child's handwriting (`HandwritingView`, tap to zoom), big **"✓ Đúng" / "✗ Sai"**, optional quick comments "Sai chính tả", "Thiếu chữ", "Viết chưa rõ" (picking one of the first two also marks Sai).
- Blank words show "Chưa viết" and are already Sai.
- "Đánh dấu tất cả đúng", filter "Tất cả / Chưa chấm / Sai".
- Sticky footer: live "Đúng 10/12 từ · 8,3/10", "Nhận xét chung", "Cho phép làm lại lần 2" (existing rule), "Hoàn tất chấm bài" (enabled when every word is marked). Saves through the existing grading action (per-answer `isCorrect`/points/comment, overall comment, retry).
- AI grading suggestions are not offered for `tu-vung`.

## Student: result

The existing result screen works per question; for flashcard attempts it shows the score and stars as usual and a list **"Từ cần luyện lại"** of wrong words: correct spelling, explanation, speaker button (normal/slow), the child's handwriting small next to it. Attempt 2 (if allowed) is a normal new attempt of the same set.

- *Claude's call:* the correct spellings show here even while a second attempt is still allowed (normally answers are revealed only when no retry is left, `answersRevealed`). Harmless, because attempt 2 starts with the study cards that show every word anyway.
- *Claude's call:* no AI hints for wrong `tu-vung` answers (`hintsPending` / `explainMistakes` skip them like `tu-luan`); a hint would be a weaker copy of the spelling already on screen.

## Constraints

- Everything the take screen needs (words, explanations) must be inside `TakeQuestion`, so the offline pack carries it; no server or AI calls while studying/writing.
- Responses must pass `parseResponses`; ink per word must stay small (a strip, 12–40 words, under the 4 MB action limit with room to spare).
- Grading stays in pure `gradeQuestion`; `closeAttempt` / `syncOfflineAttempt` unchanged.
- All UI text Vietnamese except the English words/explanations (`lang="en"` on them).
- Student screens keep the app's motion/sound language (`lib/animations.ts`, `hooks/useSound.ts`, reduced-motion respected).
- Schema change = one Drizzle migration; the user applies it to prod before the push to master (Vercel deploys on push).

## Testing

- Unit (Vitest): word-list parsing; `tu-vung` schema validation; `gradeQuestion` (blank → wrong, ink → parent); `toTakeQuestion` keeps `word`; AI response validation/ordering; score from parent marks.
- E2E (Playwright, iPad WebKit): parent pastes words → (AI stubbed) explanations → save → assign; child studies, switches to writing, confirms the word is not visible, draws on each strip, submits; parent grades with ✓/✗ and finishes; child sees wrong words on the result. Offline: the flashcard assignment is in the offline pack and can be written and handed in offline (extend the existing offline spec).

## Left to the builder

Component split, exact ink strip dimensions and how `Ink` expresses them, the word-number grid look, where study marks live in the draft, whether the builder's "Sách/Unit" helpers stay, library filter, copy tweaks.

## Open questions

None. (Writing phase hides the word completely — confirmed by the user.)
