# Handwritten essays on pages — design

Date: 2026-10-15 · Status: approved in chat (user asked to implement straight after the spec)

## Goal

The child writes a whole paragraph with Apple Pencil on the iPad as naturally as in a school notebook; the parent reads it clearly while grading; AI grading still reads it. Today's essay handwriting (`DrawingCanvas` in `src/components/take/questions.tsx`) is one fixed 320–420px raster canvas: no room for a paragraph, the palm draws, strokes are jagged, rotation distorts it, and it is stored as a PNG data URL inside `answers.response`.

Success: the child writes 2–3 pages of a "tập làm văn" with the Pencil, rests their palm on the screen and scrolls with a finger without stray marks, rotates the iPad without the writing changing; the parent sees every page sharp and zoomable on the grading screen, AI grading reads every page, and the child sees their pages on the result screen.

### Decisions made with the user

- Device: iPad with Apple Pencil. Pencil writes, fingers scroll; an off-by-default "Viết bằng ngón tay" switch lets fingers write.
- Fixed-size pages with a "+ Thêm trang" button (no endless sheet, no auto-added pages).
- Paper by grade: ô li (4-ô-ly notebook) for grade ≤ 3, ruled lines from grade 4. Stored with the ink so old work keeps its paper.
- Shown on the parent's grading screen and on the child's result screen, both full width and zoomable.
- Storage: vector strokes are the only source; the browser draws them everywhere; the server renders PNGs only for AI grading. No Storage upload on submit (replaces the earlier "upload PNG" idea — vectors are far below the 4 MB action limit).
- AI handwriting-to-text and on-page spelling marks are deferred (`docs/backlog.md`).

### Out of scope

Colors/thickness choices, Pencil double-tap, parent annotation on the child's writing, converting old PNG answers to vectors, handwriting outside essays.

## 1. Data

`answers.response` of a `tu-luan` question (jsonb, no migration):

```ts
interface EssayValue {
  text: string
  drawing?: string // legacy PNG data URL: read-only, never written by new code
  ink?: Ink
}
interface Ink {
  v: 1
  paper: "o-li" | "ke-ngang"
  pages: { strokes: number[][] }[] // each stroke is a flat [x, y, p, x, y, p, …]
}
```

- A page is 1000 × 700 units whatever the screen. `x`, `y` are integers inside the page, `p` (pressure) is an integer 0–10. Every renderer just scales.
- About 10 bytes per point; a 3-page essay is ~100–200 KB, well under `saveDraft`'s 2 MB response cap.
- `inkSchema` (zod) in `src/lib/ink.ts`: `v` literal 1, ≤ 10 pages, ≤ 3000 strokes per page, ≤ 4000 points per stroke, stroke length a multiple of 3, values integers within the page / pressure range. `attempts.ts` uses it in `responseSchema`.

## 2. Core library — `src/lib/ink.ts` (pure, tested)

- Types, `inkSchema`, `PAGE_W = 1000`, `PAGE_H = 700`, `MAX_PAGES = 10`.
- `paperFor(grade)` → `"o-li"` when grade ≤ 3, else `"ke-ngang"`; `paperLines(paper)` → line y positions with weight (main/minor) for both the canvas and SVG.
- `quantizePoint(x, y, pressure)` → clamped integers.
- `strokePath(stroke)` → SVG path `d` of the stroke outline from `perfect-freehand` (`getStroke` with pressure, smoothing, round caps). The same string feeds `Path2D` on canvas and `<path>` in SVG, so writing looks identical everywhere.
- `eraseStrokes(strokes, cx, cy, r)` → strokes with points inside the circle removed, splitting a stroke into its remaining runs and dropping runs shorter than 2 points.
- `isInkEmpty(ink)`, `pageIsEmpty(page)`, `trimInk(ink)` (drops trailing blank pages, keeps at least one).
- `inkPageSvg(ink, pageIndex, { width })` → standalone SVG string (white background, paper lines, strokes). Only numbers and fixed strings go into it.

New dependency: `perfect-freehand` (tiny, MIT, no deps).

## 3. Writing UI — `src/components/ink/`

- `Essay` keeps the "Gõ chữ / Viết tay" switch. Hand mode renders `InkEditor` instead of `DrawingCanvas` (removed).
- `InkEditor`: toolbar (Bút, Tẩy, Hoàn tác, Làm lại, Xóa trang, "Viết bằng ngón tay" switch) and the pages stacked vertically, full width, aspect 10:7, "Trang i/n" label, "+ Thêm trang" under the last page (hidden at 10 pages). New ink takes `paperFor(student.grade)`; existing ink keeps `ink.paper`.
- Input: pen and mouse draw; touch draws only when the finger switch is on. With it off the canvas has `touch-action: pan-y` so fingers and palms scroll; with it on `touch-action: none`.
- Each page: base canvas (paper + committed strokes) and an overlay canvas for the live stroke, redrawn in `requestAnimationFrame`. Points come from `getCoalescedEvents()`. Pointer up commits the stroke (quantized) and redraws the base. `ResizeObserver` redraws at the new scale (rotation, split view).
- Eraser: dragging calls `eraseStrokes` along the path; one undo step per drag.
- Undo/redo: stacks of `Ink` snapshots, at most 50. "Xóa trang" asks to confirm, clears the page, and removes it if it is a trailing page beyond the first.
- Every commit/erase calls `onChange({ ...value, ink })`, which goes through the existing debounced autosave. `TakeAssignment` counts the essay answered when text, `drawing` or non-empty `ink` exists.
- A draft that still has a legacy `drawing` and no `ink` shows the old image with "Viết lại trên giấy mới", which clears `drawing` and starts ink.

## 4. Display — `HandwritingView`

- Renders each non-empty page as inline SVG (paper + `strokePath`) at full width. Legacy `drawing` renders as `<img>`.
- Tapping a page opens a full-screen dialog with page navigation; the SVG is shown large and the dialog allows pinch zoom.
- Grading (`GradeAttempt.tsx`) replaces the small `<img>` with `HandwritingView`.
- Result screen: `buildResultDetail` review items gain `handwriting?: { ink?: Ink; drawing?: string }`; the result component shows it under the answer. `answerText` still says "(bài viết tay)" where text is needed.
- Views: `isEssayValue` accepts `ink`; new `essayInk(response)` returns the ink only if `inkSchema` parses it (malformed data is ignored, not rendered); `responseText` / `answerText` treat non-empty ink like `drawing`.

## 5. AI grading

- `src/server/ai/ink-image.ts` renders `inkPageSvg` to PNG (~1500 × 1050) with `@resvg/resvg-js` (or `@resvg/resvg-wasm` if the native package can't be bundled by Next 16).
- `essayBlocks` in `ai-grading.ts`: for ink, one image block per non-empty page labelled "Chữ viết tay của con cho câu N (trang i/n):"; legacy `drawing` path unchanged. `ESSAY_SYSTEM` unchanged.

## 6. Legacy data

No data migration. Every reader handles both `drawing` and `ink`. `next.config.ts` keeps the 4 MB action body limit (old drafts still carry PNGs); its comment is updated.

## 7. Testing

- Unit (`src/lib/ink.test.ts`): quantize/clamp, `eraseStrokes` splitting, `isInkEmpty`, `trimInk`, `paperFor`, `paperLines`, `strokePath` output, `inkPageSvg` structure, `inkSchema` limits.
- Views: `essayInk`, `responseText` / `answerText` with ink, `buildResultDetail.handwriting`.
- Server render: PNG signature check on a sample page.
- E2E (iPad project): write with the mouse, add page 2, undo, submit; parent sees two handwriting pages and grades; child sees the pages on the result screen.
- Manual on a real iPad with Pencil: latency, palm rejection, finger scrolling, rotation.
