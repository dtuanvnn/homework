# Vocabulary flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new "Từ vựng (Flashcard)" exercise: the parent pastes a word list, AI writes English explanations, the child studies flip cards with text-to-speech and then writes every word by hand from the explanation alone; the parent marks each word ✓/✗.

**Architecture:** Each word is a question of the new type `tu-vung` in an ordinary exercise set (new column `exercise_sets.format = 'flashcard'`), so assigning, drafts, offline packs, submit/sync, the grading queue, scores and stars stay unchanged. The take screen, the grader and the result screen switch to flashcard UIs when every question of the set is `tu-vung` (`isFlashcardSet`), so the offline pack and the grading loader need no new fields. The take screen's save/submit/timer machinery moves out of `TakeAssignment` into a shared hook so both take UIs use it.

**Tech Stack:** Next.js (App Router, Server Actions), Drizzle + Postgres, zod, motion, perfect-freehand ink, Web Speech API, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-vocab-flashcard-design.md`

## Global Constraints

- All UI text Vietnamese; English words/explanations carry `lang="en"`.
- `tu-vung` content: `{ type: "tu-vung", word, prompt, points: 1, skills: [] }`; `word` trimmed, 1–60 chars, letters/spaces/hyphens/apostrophes; `prompt` 1–300 chars.
- Max 40 words per set. Flashcard sets: subject `tieng-anh`, kind `chu-de`, only `tu-vung` questions; normal sets never contain `tu-vung`.
- Response = `EssayValue` `{ text: "", ink }`; blank ⇒ wrong, any ink ⇒ parent grades.
- The writing phase never renders the word.
- TTS rates: Bình thường 1, Chậm 0.7, Rất chậm 0.45; voice `en-US`, else any `en-*`; no voice ⇒ disabled buttons with "Thiết bị chưa có giọng đọc tiếng Anh".
- Flashcard assignments are web only (paper refused in UI and server).
- One Drizzle migration (`0007`); existing rows get `format = 'cau-hoi'`.
- Existing question sets, take screen, grading, offline sync and rewards keep their behaviour.

## Review Focus

1. A pasted list with blank lines, duplicates in different case, "a / b / c" lines and > 40 words → parsed words are unique (case-insensitive), capped at 40 with a notice. (Task 1 tests.)
2. AI explanation containing the word itself ("A rainforest is…") → rejected for that word (left empty for the parent), never shown to the child. (Task 3 tests.)
3. A strip ink from the take screen must pass `inkSchema` and render in `HandwritingView`/`ink-image.ts`, while old 1000×700 ink still validates. (Task 1 tests.)
4. Resuming a flashcard attempt with handwriting but no study marks on this device → "Viết từ" is open. (Task 5, `canWrite` test.)
5. A flashcard set saved with a stray non-`tu-vung` question, or assigned as paper → server refuses. (Task 2 test via pure `checkSetFormat`.)

---

### Task 1: Domain — `tu-vung` type, grading, strip ink, word lists

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/question-schema.ts`, `src/lib/grading.ts`, `src/lib/ink.ts`, `src/lib/views/student.ts` (`toTakeQuestion`, `answerText`, `correctAnswerText`), `src/lib/views/grading.ts`, `src/lib/questions.ts`, `src/lib/ai/*` switches, `src/lib/answer-key.ts`, `src/db/seed.ts`, other exhaustive switches TypeScript reports
- Create: `src/lib/flashcard.ts`, `src/lib/flashcard.test.ts`
- Test: `src/lib/grading.test.ts`, `src/lib/ink.test.ts`, `src/lib/views/student.test.ts`

**Interfaces:**
- Produces: `VocabQuestion { type: "tu-vung"; word: string }` in the `Question` union; `QuestionType` gains `"tu-vung"`.
- `lib/flashcard.ts`: `MAX_WORDS = 40`; `parseWordList(text: string): { words: string[]; duplicateCount: number; overflow: number }`; `isValidWord(word: string): boolean`; `isFlashcardSet(qs: { type: string }[]): boolean` (non-empty and all `tu-vung`); `vocabQuestion(word: string, prompt: string): QuestionContent`.
- `lib/ink.ts`: `Ink.size?: "strip"`; `STRIP_H = 300`; `pageHeight(ink: Pick<Ink, "size">): number`; `paperLines(paper, height = PAGE_H)`; `inkPageSvg` uses the ink's height; `newInk(paper, size?)`.

- [ ] **Step 1: Failing tests** — `flashcard.test.ts`: `parseWordList("habitat\n\nDesert\ndesert / nest / polar bear")` → words `["habitat","Desert","nest","polar bear"]`, duplicateCount 1; 45 lines → 40 words, overflow 5; `isValidWord("polar bear")`, `isValidWord("o'clock")`, `!isValidWord("a1")`, `!isValidWord("x".repeat(61))`; `isFlashcardSet([])` false. `grading.test.ts`: `gradeQuestion(vocab, undefined)` and `{text:"", ink: newInk("o-li","strip")}` → `{isCorrect:false, pointsAwarded:0}`; ink with one stroke → `{isCorrect:null}`. `ink.test.ts`: strip ink with y = 290 passes `inkSchema`, y = 310 fails; old ink with y = 690 passes; `pageHeight({size:"strip"}) === 300`. `student.test.ts`: `toTakeQuestion(vocab)` keeps `word` and `prompt`.
- [ ] **Step 2:** Run `pnpm test src/lib` — new tests fail.
- [ ] **Step 3:** Implement; question-schema adds `z.object({ ...base, type: z.literal("tu-vung"), word: z.string().trim().min(1).max(60).regex(/^[A-Za-z][A-Za-z' -]*$/), prompt: z.string().trim().min(1).max(300) })`. `gradeQuestion`: `tu-vung` → blank (no ink / `isInkEmpty`) ⇒ WRONG else NEEDS_PARENT, checked before the `tu-luan` line. Fix every switch `pnpm typecheck` reports (`correctAnswerText` → `q.word`; `responseText` → "" when ink else "(Chưa trả lời)"; `QUESTION_TYPES["tu-vung"] = { label: "Từ vựng", icon: Layers }`; AI prompt helpers treat it like an essay with the word as key; seed switch returns `{ text: "" }`). Pickers that list `QUESTION_TYPES` must not offer `tu-vung`.
- [ ] **Step 4:** `pnpm typecheck && pnpm test` pass.
- [ ] **Step 5:** Commit `Flashcard: tu-vung question type, strip ink, word lists`.

### Task 2: Set format column and server rules

**Files:**
- Modify: `src/db/schema.ts`, `src/lib/types.ts` (`ExerciseFormat`, `ExerciseSet.format`), `src/server/queries.ts` (`toExerciseSet`), `src/server/actions/library.ts`, `src/state/library-store.tsx` (`persist` sends `format`), `src/lib/flashcard.ts`
- Create: `drizzle/0007_*.sql` via `pnpm db:generate`
- Test: `src/lib/flashcard.test.ts`

**Interfaces:**
- `exerciseFormat = pgEnum("exercise_format", ["cau-hoi", "flashcard"])`, column `format` default `cau-hoi`.
- `checkSetFormat(set: { format; subject }, qs: { type: string }[]): string | null` (Vietnamese error or null) in `lib/flashcard.ts`; `saveExerciseSet` throws its message; `insertAssignments` refuses `mode: "paper"` for flashcard sets with "Bộ từ vựng chỉ làm trên web.".

- [ ] **Step 1: Failing tests** for `checkSetFormat`: flashcard with a `trac-nghiem` → error; flashcard subject `toan` → error; 41 words → error; normal set with `tu-vung` → error; valid both → null.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement + `pnpm db:generate`, review SQL (`CREATE TYPE … ; ALTER TABLE … ADD COLUMN "format" … DEFAULT 'cau-hoi' NOT NULL`). **Step 4:** `pnpm db:migrate`, tests + typecheck pass. **Step 5:** Commit `Flashcard: exercise set format column`.

### Task 3: AI explanations

**Files:**
- Create: `src/lib/ai/flashcard.ts`, `src/lib/ai/flashcard.test.ts`, `src/server/actions/ai-flashcard.ts`

**Interfaces:**
- `explainInputSchema = { words: string[1..40], topic: string ≤200, grade: 1..12, avoid?: Record<string,string> }`; `explanationsSchema = { items: { word: string; definition: string }[] }`; `EXPLAIN_SYSTEM_PROMPT`; `buildExplainPrompt(input): string`; `explanationLeaks(word, definition): boolean`; `mapExplanations(words, output): Record<string, string>` (only words with a valid, non-leaking, ≤300-char single explanation; matched by word case-insensitively, falling back to position).
- Action `explainWords(input): Promise<ActionResult<Record<string, string>>>` — `assertAccess("parent")`, `ask({ effort: "low" })`, throws "AI chưa viết được giải thích nào. Vui lòng thử lại." when the map is empty.

- [ ] **Step 1: Failing tests:** `explanationLeaks("rainforest", "A rainforest is wet.")` true; `explanationLeaks("burrow", "Rabbits burrowed here.")` true; `explanationLeaks("nest", "A bird's home made of twigs.")` false; `explanationLeaks("polar bear", "A big white bear…")` true (shares "bear"); `mapExplanations(["nest","hive"], {items:[{word:"Hive",definition:"Bees live here."},{word:"nest",definition:"A nest of twigs."}]})` → `{ hive: … }` only, keyed by the original word; prompt contains every word, the topic, the grade and the "never use the word" rule; with `avoid` it lists the old explanation to avoid.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `Flashcard: AI word explanations`.

### Task 4: Parent builder and library entry

**Files:**
- Create: `src/components/pages/FlashcardBuilder.tsx`, `src/app/(app)/parent/library/flashcard/new/page.tsx`, `src/lib/speech.ts`
- Modify: `src/components/layout/routes.ts` (`libraryPaths.newFlashcard`, title "Bộ từ vựng mới"), `src/app/(app)/parent/library/[setId]/page.tsx` (flashcard sets render the builder), `src/components/library/AddExerciseMenu.tsx` (4th option "Từ vựng (Flashcard)", Layers), `ExerciseLibrary.tsx` + its route wrapper (`onFlashcard`), `ExerciseCard.tsx` ("Flashcard" badge, "N từ"), `AssignSheet.tsx` (paper disabled for flashcard)

**Interfaces:**
- `lib/speech.ts` (client): `RATES = { normal: 1, slow: 0.7, verySlow: 0.45 }`; `useEnglishVoice(): boolean` (voices load async); `speak(text: string, rate: number, on?: { start?(): void; end?(): void }): void`; `stopSpeaking(): void`.
- `FlashcardBuilder({ initialSet?: ExerciseSet; initialQuestions?: Question[] })`: fields Tên bộ / Chủ đề / Lớp; textarea "Dán danh sách từ" + "Đã nhận N từ" + "Thêm vào danh sách"; button "AI viết giải thích" (only words without explanation); cards with word input, speaker, "Giải thích (tiếng Anh)" textarea, "Viết lại", delete with undo toast, up/down reorder; footer "Lưu nháp" / "Lưu & sẵn sàng" / "Giao bài này" (opens `AssignSheet` with `setId`). Saving requires a title and every word with an explanation (≥1 word). Saves through `library.saveSet`. Leave guard via `registerLeaveGuard` when dirty.

- [ ] **Step 1:** Build; `pnpm typecheck && pnpm lint`. **Step 2:** Manual check in `pnpm dev` (paste, save, reopen, assign). **Step 3:** Commit `Flashcard: parent builder`.

### Task 5: Student study and write

**Files:**
- Create: `src/components/take/use-take-session.ts`, `src/components/take/TakeChrome.tsx` (save status, clock, exit/submit dialogs, time-up and paper-plane overlays), `src/components/take/TakeFlashcards.tsx`, `src/components/ink/InkStrip.tsx`, `src/lib/flashcard-study.ts` (+ test)
- Modify: `src/components/take/TakeAssignment.tsx` (uses the hook and chrome; same behaviour), `src/components/take/TakeRoute.tsx` (renders `TakeFlashcards` when `isFlashcardSet(questions)`), `src/components/ink/InkEditor.tsx` (exports `InkCanvasPage` with `height`, `ToolBtn`, `useFingerMode`)

**Interfaces:**
- `useTakeSession({ initialAnswers, timer, onSave, onExit, onSubmit, onSubmitted, onResync, onTimeUpStart? })` returns `{ answers, set, elapsed, clock, countdown, showTimer, setShowTimer, status: { saving, justSaved, saveFailed, savedLocal }, flight, graded, queued, timeUp, confirmExit, setConfirmExit, confirmSubmit, setConfirmSubmit, exiting, exit, submit, onTimeUp, reduced }`.
- `lib/flashcard-study.ts`: `loadStudy(key): string[]`, `saveStudy(key, ids)`, `studyKey(studentId, assignmentId, attemptNo)`, `canWrite(questionIds, studied: Set<string>, answers: Answers): boolean` (all studied, or any answer has ink).
- `InkStrip({ ink, onChange, label })`: one strip page (`size: "strip"`), tools Bút/Tẩy/Hoàn tác/Xóa hết/Viết bằng ngón tay.
- `TakeFlashcards` props = `TakeAssignment` props + `studyKey: string`. Phase "1. Học từ": flip card (front word, back explanation), 3 speaker buttons, "Từ trước"/"Từ tiếp", "Thẻ i/n", "Em thuộc rồi", "Sang phần Viết từ". Phase "2. Viết từ": explanation bubble + speakers (no word), `InkStrip`, "Câu trước"/"Câu tiếp", grid sheet, review screen "Đã viết x/n từ", "Nộp bài" with confirm.

- [ ] **Step 1: Failing test** `canWrite`: none studied & no ink → false; all studied → true; one answer with a stroke → true.
- [ ] **Step 2–3:** Implement hook extraction first; run the existing E2E `handwriting`/`timed` specs (iPad) to confirm `TakeAssignment` unchanged; then flashcards.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test`. **Step 5:** Commit `Flashcard: study and handwriting take screen`.

### Task 6: Parent grading

**Files:**
- Create: `src/components/grading/FlashcardGrading.tsx`
- Modify: `src/app/(app)/parent/grading/[attemptId]/page.tsx`, `src/lib/views/grading.ts` (`GradingQueueItem.flashcard`), `src/components/pages/Grading.tsx` (queue line "N từ viết tay")
- Test: `src/lib/views/grading.test.ts`

**Interfaces:**
- `buildGradingQueue` sets `flashcard: rows.length > 0 && rows.every(r => r.type === "tu-vung")`; `tu-vung` rows are not counted as auto-graded.
- `FlashcardGrading({ detail: GradingDetail; now: string })`: rows with word (green), explanation, `HandwritingView`, "Đúng"/"Sai", quick comments "Sai chính tả" / "Thiếu chữ" (also mark Sai) / "Viết chưa rõ"; blanks pre-marked Sai with "Chưa viết"; "Đánh dấu tất cả đúng"; filter Tất cả / Chưa chấm / Sai; sticky "Đúng x/n từ · s/10", "Nhận xét chung", retry switch, "Hoàn tất chấm bài" (disabled until all marked). Saves with `gradeAttempt` (`pointsAwarded` 1 or 0).

- [ ] **Step 1: Failing test:** queue item of an attempt with two `tu-vung` rows → `flashcard: true`, `autoWrong: 0`. **Step 2–4.** **Step 5:** Commit `Flashcard: parent grading`.

### Task 7: Student result

**Files:**
- Modify: `src/lib/views/student.ts` (`ReviewItem.word`, `correctAnswer` for `tu-vung` always shown when wrong, `hintsPending` skips `tu-vung`), `src/server/actions/ai-hints.ts` (skip `tu-vung`), `src/components/results/ResultDetail.tsx` (flashcard results show "Từ cần luyện lại")
- Test: `src/lib/views/student.test.ts`

- [ ] **Step 1: Failing test:** graded flashcard attempt with retry open → wrong item has `word` and `correctAnswer`, `hintsPending` false. **Step 2–4.** **Step 5:** Commit `Flashcard: result screen`.

### Task 8: E2E and docs

**Files:**
- Create: `e2e/flashcard.spec.ts`
- Modify: `CLAUDE.md` (domain rule paragraph), `docs/superpowers/specs/2026-10-19-vocab-flashcard-design.md` status

- [ ] **Step 1:** Spec: parent opens "Từ vựng (Flashcard)", pastes 3 words, types explanations by hand (no AI key in E2E), "Lưu & sẵn sàng", "Giao bài này"; child studies all cards, opens "2. Viết từ", asserts the word text is not on screen, scribbles on 2 of 3 strips, submits; parent opens the attempt, marks ✓ ✗ (blank is pre-marked Sai), finishes; child result shows "Từ cần luyện lại" with the wrong words.
- [ ] **Step 2:** `pnpm test:e2e e2e/flashcard.spec.ts` (iPad) passes; full `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] **Step 3:** Commit `Flashcard: E2E and docs`.
