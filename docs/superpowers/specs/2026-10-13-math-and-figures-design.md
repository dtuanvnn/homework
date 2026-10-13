# Math formulas and scanned figures — design

Date: 2026-10-13 · Status: approved in chat, awaiting spec review

## Goal

1. Questions can show math notation (fractions, expressions, mixed numbers) everywhere they appear.
2. The child can answer math questions with an on-screen math keyboard, and automatic grading accepts any answer with the same value (6/8 = 3/4 = 0,75) unless the question requires simplest form.
3. When a scanned question has a picture (geometry figure, counting objects, chart), the picture is cut out of the scanned page and attached to the question exactly as it appears in the document. The child answers with the normal question types; there is no drawing on the picture.

Success: a parent scans a grade-3/4 math worksheet with fractions and geometry figures, reviews it with at most a few box adjustments, saves it, and the child sees the same formulas and figures in the test, answers fractions with the keyboard, and is graded correctly.

### Decisions made with the user

- Figures: AI marks a box, browser crops, parent adjusts (not AI-redrawn SVG, not manual-only, not whole page).
- Math scope: display everywhere + math keyboard for the child. The parent edits formulas as `$…$` text with a live preview (no visual formula editor).
- Math grading: equal value counts; a per-question "Bắt buộc dạng tối giản" flag requires simplest form.
- Libraries: KaTeX (display), MathLive (input, lazy-loaded), own exact-rational evaluator (no Compute Engine), `react-image-crop` (box adjust).

### Out of scope

Drawing/marking on figures, letters/variables on the math keyboard (algebra), a visual formula editor for the parent, AI-redrawn figures.

## 1. Data and storage

**Question shape** (`src/lib/types.ts`, stored in `questions.content` jsonb — no migration):

```ts
interface QuestionImage { path: string; width: number; height: number }
interface QuestionBase { …; image?: QuestionImage; imageUrl?: string /* read-side only, never stored */ }
// tra-loi-ngan and dien-cho-trong:
math?: boolean      // answer key(s) are LaTeX; child gets MathAnswerInput; graded by value
simplest?: boolean  // only with math: answer must be an integer or a fraction in lowest terms
```

- Any text field (prompt, options, pairs, tokens, rubric) may contain LaTeX between `$…$`; `\$` is a literal dollar. Text without `$` renders exactly as today, so existing sets are unaffected.
- `image.path` is a Storage object `sets/{setId}/fig-{uuid}.jpg`; width/height reserve layout space.

**Serving:** `src/server/queries.ts` adds a 1-hour signed `imageUrl` (via `attachmentUrl`) to every question with an `image` when loading questions, and to the `answers.question` snapshots used by results and grading. `imageUrl` is stripped before any write.

**Validation:** `src/lib/question-schema.ts` accepts `image` only when `path` starts with `sets/{setId}/` of the set being saved (checked in the action), with positive integer width/height. `saveExerciseSet` checks `isUploaded` for each new image path.

**Cleanup:** `saveExerciseSet` treats question image paths as in use. After saving, it lists `sets/{setId}/fig-*` objects and removes those referenced neither by the set's questions nor by any `answers.question` snapshot.

## 2. Math display and input

**`<RichText text>`** (`src/components/ui/RichText.tsx`, splitting logic pure in `src/lib/rich-text.ts`):
- Splits on unescaped `$…$`; formula segments render with KaTeX (`throwOnError: false`), text segments keep `whitespace-pre-line`.
- A formula that fails to render shows its raw source in a muted colour.
- KaTeX CSS/fonts bundled (imported once in the app layout), no CDN.
- Replaces plain question text in: `exercise-detail/QuestionContent.tsx`, `take/TakeAssignment.tsx`, `take/questions.tsx`, `results/ResultDetail.tsx` (including hints), `grading/GradeAttempt.tsx`, `grading/AiAssist.tsx`, `schedule/PrintableExercise.tsx`, `upload/ExtractedQuestionCard.tsx`, `upload/ReviewStep.tsx`.
- Fill-in-the-blank: the prompt is split into blanks (`___`) first; each text piece between blanks goes through `RichText`.

**`<MathAnswerInput value onChange>`** (`src/components/take/MathAnswerInput.tsx`):
- Wraps MathLive's `<math-field>` with a custom virtual keyboard layout: digits, decimal comma, `+ − × ÷`, fraction, mixed number, parentheses, backspace. No letters or advanced functions.
- Loaded with `next/dynamic` (`ssr: false`) only where a math question is rendered; styled like the existing answer boxes.
- Value is the LaTeX string, so response shapes in `grading.ts`, autosave and drafts are unchanged.
- If MathLive fails to load, falls back to a plain text input.

**`src/lib/math-answer.ts`** (pure, heavily tested):
- `evaluateMath(latex: string): Rational | null` — exact rationals with BigInt numerator/denominator. Supported: integers, decimals with `,` or `.`, `\frac{a}{b}` (nested), mixed numbers `2\frac{1}{3}`, `+ - − × ÷ : · * /`, `\times \div \cdot`, parentheses (`()` and `\left( \right)`), unary minus, whitespace and `\,`. Anything else → `null`.
- `mathAnswerMatches(expected, given, { simplest })`: both evaluate and are equal; with `simplest`, `given` must also be an integer, or a single (optionally negative or mixed) fraction in lowest terms.
- `gradeQuestion` uses it for `tra-loi-ngan`/`dien-cho-trong` when `math` is true; if the key doesn't evaluate, falls back to today's text comparison.

**Hints:** `leaksAnswer()` compares on normalized forms: LaTeX in both hint and key is converted to plain text (`\frac{3}{4}` → `3/4`) and, for math keys, any number/fraction in the hint with the key's value counts as a leak.

## 3. Scan pipeline and review

**AI output** (`src/lib/ai/question-format.ts`, `aiQuestionSchema`): add `figure: { box: [x0, y0, x1, y1] } | null` (0–1000 of the page's width/height, on the page given by `page`), `math: boolean | null`, `simplest: boolean | null`.

**Scan prompt** (`src/lib/ai/scan.ts`) adds:
- Write every formula as LaTeX between `$…$` in prompts, options and answers.
- Set `math` when the answer is a number, fraction or expression typed with a math keyboard; `simplest` when the exercise asks to "rút gọn"/"tối giản".
- Fill `figure` whenever the child needs a picture, diagram, drawn table or chart to answer; tight around the drawing and its labels, not the question text. Parts of one exercise sharing a figure repeat the same box.

The same LaTeX/`math`/`simplest` rules go into the AI generate prompt (`src/lib/ai/generate.ts`); generate produces no figures.

**`toQuestion()` repairs:** clamp boxes to 0–1000, swap inverted corners, drop boxes under 2% of either side or covering over 95% of the page area (note + capped confidence), drop `simplest` without `math`. `ScannedQuestion` gains `figure?: { page: number; box: Box }`.

**Cropping** (`src/lib/figure-crop.ts`, pure rectangle maths + a small browser helper):
- `cropRect(box, pageWidth, pageHeight, padding = 0.03)` → pixel rectangle, padded and clamped.
- After scan results arrive, `UploadFlow` crops each figure from its page image (in-memory page blobs; on draft restore, fetched through signed URLs), encodes JPEG with the `shrinkImage()` limits, dedupes identical page+box crops, and uploads via `createUploadTargets` + `uploadFiles` to `sets/{setId}/fig-{uuid}.jpg`. File bodies never go through Server Actions.
- Cards show "Đang cắt hình…" until their image is uploaded.

**Review UI:**
- `ExtractedQuestionCard` shows the cropped figure under the rendered prompt, with **Chỉnh khung** (opens the page with the box in `react-image-crop`; save re-crops and re-uploads) and **Bỏ hình**. Cards without a figure get **Thêm hình** (draw a box on the page).
- `SourceViewer` renders PDF pages as images (from the page images produced by `pdf-client.ts`) instead of the "Không có ảnh xem trước" placeholder.
- `src/lib/scan-draft.ts` stores figure boxes and image paths so restored drafts show the same figures.

**Early check:** before building the review UI, run a real DeepSeek Flash scan of a worksheet with figures and inspect box accuracy. If boxes are poor, keep the design but default the review to manual boxes (AI box only as a starting suggestion).

## 4. Editor, other AI features, errors, testing

**Question editor** (`QuestionEditorSheet.tsx`, `QuestionTypeFields.tsx`):
- Live `RichText` preview under any text field containing `$`.
- Formula bar inserting `$\frac{}{}$`, `\times`, `\div`, mixed number, with the cursor placed inside.
- "Hình minh họa": show current image; **Chọn ảnh** (photo, `shrinkImage()`, signed upload); **Cắt từ trang tài liệu** (crop from one of the set's attachment pages); **Bỏ hình**.
- **Toán** switch on `tra-loi-ngan`/`dien-cho-trong` turns answer key inputs into `MathAnswerInput` with preview; reveals **Bắt buộc dạng tối giản**. Saving is blocked with a Vietnamese message when a math key doesn't evaluate.

**AI hints and AI grading** (`ai-hints.ts`, `ai-grading.ts`): when a question has an image, send it as an image block next to the question text (via `storageFileBlocks`).

**Errors:**
- Crop/upload failure: card keeps its box and shows "Chưa tải được hình – Thử lại"; saving without the image asks for confirmation.
- Broken formula: muted raw text, never a crash; editor flags it.
- MathLive load failure: plain text input; grading still works.
- Expired signed URL: `<img onError>` triggers one `router.refresh()`.

**Testing:**
- Vitest: `math-answer.ts` (values, simplest form, comma decimals, mixed numbers, nesting, invalid input), `rich-text.ts` splitting (`\$`, unclosed `$`, blanks next to formulas), `toQuestion` box repair and new fields, `cropRect`, `gradeQuestion` with `math` on/off, `leaksAnswer` with LaTeX, image path validation.
- Playwright (iPad + iPhone): seed a set with a fraction question (`math`) and a question with an image; child answers `6/8` via the math keyboard for key `3/4` and is graded correct; image visible on take, result and grading screens.
- Manual: real DeepSeek scan of a geometry worksheet, box adjustment in review, save, take.

## Docs

Update `CLAUDE.md`: question `image` / `math` / `simplest` fields, `RichText` as the only way to render question text, `math-answer.ts`, figure crop flow and fig-object cleanup.
