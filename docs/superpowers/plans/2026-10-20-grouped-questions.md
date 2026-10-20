# Grouped questions (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent group consecutive questions of a set into a "bài" (shared prompt, figure, label) with "câu con", by auto-detection or by hand, and show bài on the take, grading, result and print screens.

**Architecture:** Each câu con carries an optional `group` object in its question JSON (no migration). Pure helpers in `src/lib/question-groups.ts` (numbering/blocks, validation, AI prompt text, figures) and `src/lib/question-groups-edit.ts` (suggest, join, release, drop, split points) are used by every screen and server path. Screens render `groupBlocks(...)` instead of a flat list.

**Tech Stack:** Next.js (app router, server actions), React, dnd-kit, zod 4, Drizzle/pg, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-grouped-questions-design.md`

## Global Constraints

- All UI copy Vietnamese. Exact strings: "Tự chia bài", "Áp dụng", "Huỷ", "Sửa bài", "Bỏ bài", "Xoá bài", "Tạo bài từ câu này", "Đưa vào bài trên", "Đưa vào bài dưới", "Tách khỏi bài", "Điểm cả bài", "Không tìm thấy câu nào có chung đề.".
- Bài title = `group.label` if set, else `Bài ${n}` (n = 1-based order among bài in the set).
- Câu numbers = 1-based position in the set, everywhere (take, grading, result, print, AI).
- No DB migration. `group` lives in `questions.content` / `answers.question` jsonb.
- Flashcard sets (`format = 'flashcard'`) never contain `group`.
- Render shared prompts with `RichText`, shared figures with `QuestionPicture`.
- Ungrouped sets must behave exactly as before (existing unit + E2E suites pass unchanged).
- Test files must not import `"server-only"` modules; pure logic lives in `src/lib/`.

## Review Focus

1. A set saved, edited (QuestionEditorSheet) or AI-solved keeps every `group` and the shared figure → tests in Tasks 1, 2, 5.
2. Shared figure never deleted by cleanup and present offline/signed → Task 2 (figure paths include `group.image`, de-duplicated).
3. All-correct set with 1/3-point câu con scores exactly 10 → Task 3.
4. Dragging a câu to the first/last slot of its own bài keeps it in the bài; dragging out releases it losslessly → Task 4 `applyDrop` tests.
5. "Tự chia bài" → "Bỏ bài" restores the original prompts and figures (minus extracted label token) → Task 4 round-trip test.

---

### Task 1: Group type, schema, validation, blocks, figure paths

**Files:**
- Modify: `src/lib/types.ts` (QuestionBase ~154)
- Modify: `src/lib/question-schema.ts` (`base`, `editedQuestionSchema`)
- Modify: `src/lib/figures.ts` (`figurePaths`)
- Create: `src/lib/question-groups.ts`
- Test: `src/lib/question-groups.test.ts`, `src/lib/question-schema.test.ts`, `src/lib/figures.test.ts` (create if absent)

**Interfaces:**
- Produces:
  - `export interface QuestionGroup { id: string; label?: string; prompt: string; image?: QuestionImage; imageUrl?: string }` in `types.ts`; `QuestionBase.group?: QuestionGroup`.
  - `figurePaths(q: { image?; solutionImage?; group?: { image?: { path: string } } }): string[]` — now includes `group.image.path`.
  - In `question-groups.ts`:
    - `type Groupable = { group?: QuestionGroup }`
    - `type Block<T> = { kind: "single"; item: T; number: number } | { kind: "group"; group: QuestionGroup; title: string; order: number; items: { item: T; number: number }[] }`
    - `groupBlocks<T extends Groupable>(items: T[], numberOf?: (item: T, index: number) => number): Block<T>[]` — default number = index + 1. Bài order counts every bài in `items`.
    - `groupTitle(group: QuestionGroup, order: number): string`
    - `checkGroups(items: Groupable[]): string | null` — Vietnamese error or null.
    - `normalizeGroups<T extends Groupable>(items: T[]): T[]` — copies first member's `label`/`prompt`/`image` onto later members of the same `group.id`.
    - `fullPrompt(q: { prompt: string; group?: QuestionGroup }): string` — `[group.label, group.prompt, q.prompt]` non-empty parts joined with `"\n"`; just `q.prompt` without group.
    - `questionFigures(q: { image?: QuestionImage; group?: QuestionGroup }): QuestionImage[]` — group image first, then own image, de-duplicated by path.

- [ ] **Step 1: Write failing tests** in `question-groups.test.ts`:

```ts
const g = (id: string, extra: Partial<QuestionGroup> = {}) => ({ id, prompt: "Part 3 text", ...extra })
const items = [{ id: "a" }, { id: "b", group: g("x") }, { id: "c", group: g("x") }, { id: "d", group: g("y", { label: "Part 4" }) }]

it("groupBlocks numbers câu by position and titles bài", () => {
  const b = groupBlocks(items)
  expect(b.map((x) => x.kind)).toEqual(["single", "group", "group"])
  expect(b[1]).toMatchObject({ title: "Bài 1", order: 1, items: [{ number: 2 }, { number: 3 }] })
  expect(b[2]).toMatchObject({ title: "Part 4", order: 2, items: [{ number: 4 }] })
})
it("groupBlocks honours numberOf (filtered result lists)", () => {
  expect(groupBlocks([items[2]], () => 3)[0]).toMatchObject({ items: [{ number: 3 }] })
})
it("checkGroups rejects a split bài", () => {
  expect(checkGroups([{ group: g("x") }, {}, { group: g("x") }])).toMatch(/liền nhau/)
  expect(checkGroups(items)).toBeNull()
})
it("checkGroups rejects members that disagree", () => {
  expect(checkGroups([{ group: g("x") }, { group: g("x", { prompt: "other" }) }])).toMatch(/đề chung/)
})
it("normalizeGroups copies the first member's group", () => {
  const out = normalizeGroups([{ group: g("x") }, { group: g("x", { prompt: "other" }) }])
  expect(out[1].group?.prompt).toBe("Part 3 text")
})
it("fullPrompt prepends label and shared prompt", () => {
  expect(fullPrompt({ prompt: "David ___", group: g("x", { label: "Part 3" }) })).toBe("Part 3\nPart 3 text\nDavid ___")
  expect(fullPrompt({ prompt: "Q" })).toBe("Q")
})
it("questionFigures de-duplicates", () => {
  const img = { path: "p", width: 1, height: 1 }
  expect(questionFigures({ image: img, group: g("x", { image: img }) })).toEqual([img])
})
```

In `question-schema.test.ts`: `editedQuestionSchema.parse({...validShortAnswer, group: { id: "x", label: "Part 3", prompt: "Hi", image: validFigure, imageUrl: "https://…" }})` keeps `group.id/label/prompt/image` and drops `group.imageUrl`; a group with `prompt: ""` and no image/label parses; `label` longer than 40 chars fails. In `figures.test.ts`: `figurePaths({ group: { image: { path: "g" } }, image: { path: "i" } })` contains both.

- [ ] **Step 2: Run** `pnpm test src/lib/question-groups.test.ts src/lib/question-schema.test.ts src/lib/figures.test.ts` — expect FAIL (missing module/field).

- [ ] **Step 3: Implement.** `types.ts`: add `QuestionGroup` with doc comment (stored on each câu con; members identical; `imageUrl` read side only). `question-schema.ts`: `groupSchema = z.object({ id: z.string().min(1).max(64), label: z.string().trim().max(40).optional().transform(v => v || undefined), prompt: z.string().trim().max(10000), image: imageSchema.optional() })`, add `group: groupSchema.optional()` to `base`; in `editedQuestionSchema`'s transform, strip `group.imageUrl`. `checkGroups` messages: `"Các câu của một bài phải liền nhau."`, `"Các câu của một bài phải có cùng đề chung."`.

- [ ] **Step 4: Run** the same tests — PASS; then `pnpm typecheck`.

- [ ] **Step 5: Commit** `feat: question group type, schema and block helpers`.

---

### Task 2: Server save, figure cleanup, signing, offline pack

**Files:**
- Modify: `src/server/actions/library.ts` (`saveExerciseSet` ~90, `removeUnusedFigures` ~200)
- Modify: `src/lib/flashcard.ts` (`checkSetFormat`) + `src/lib/flashcard.test.ts`
- Modify: `src/server/question-images.ts`
- Modify: `src/lib/offline/pack-client.ts` (~54)
- Modify: `src/components/question/QuestionPicture.tsx` (accept a group as input — see below)

**Interfaces:**
- Consumes: `figurePaths`, `checkGroups`, `normalizeGroups` (Task 1).
- Produces: `withImageUrls` also sets `group.imageUrl`; `QuestionPicture` accepts `question: { image?: QuestionImage; imageUrl?: string }` unchanged, so callers pass `q.group` to draw a shared figure.

- [ ] **Step 1: Failing test** in `flashcard.test.ts`: `checkSetFormat({ format: "flashcard", subject: "tieng-anh" }, [{ ...word, group: { id: "x", prompt: "" } }])` returns a non-null message.
- [ ] **Step 2: Run** `pnpm test src/lib/flashcard.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
  - `checkSetFormat`: flashcard + any `group` ⇒ `"Bộ flashcard không chia bài."`.
  - `saveExerciseSet`: after parsing, `qs = normalizeGroups(qs)`, then `checkGroups(qs)` ⇒ throw its message. The existing figure check already uses `figurePaths` (now includes group images).
  - `removeUnusedFigures`: add `groupImagePath = (c) => sql\`${c}->'group'->'image'->>'path'\`` selects for `questions.content` and `answers.question`.
  - `withImageUrls`: also sign `q.group?.image` and return `group: { ...q.group, imageUrl }` when signed.
  - `pack-client.ts`: also save `q.group?.image` via `saveImage(path, q.group.imageUrl)` (skip a path already saved in this entry) and strip `group.imageUrl` from the stored question.
  - `UploadFlow` restore: no change (scan drafts carry no group in phase 1); add a one-line comment at the restore signing site.
- [ ] **Step 4: Run** `pnpm test` (all) and `pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `feat: save, sign, clean up and pack shared bài figures`.

---

### Task 3: Exact points

**Files:**
- Modify: `src/lib/grading.ts` (`proportional` ~70)
- Modify: `src/server/actions/grading.ts` (~61, ~73)
- Modify: `src/lib/views/grading.ts` (`pointStep`, `stepPoints`, `markedTotals` ~156–180)
- Modify: `src/lib/ai/grading.ts` (`roundToStep` ~96)
- Test: `src/lib/grading.test.ts`, `src/lib/views/grading.test.ts`, `src/lib/ai/grading.test.ts`

**Interfaces:**
- Produces: `pointStep(max: number): number` — `max / 2` when `max * 4` is not an integer, else 0.25 (≤ 2) / 0.5 as today. `stepPoints` and `roundToStep` use it and no longer round to 0.01.

- [ ] **Step 1: Failing tests:**
  - `grading.test.ts`: a `dien-cho-trong` with `points: 1/3` and 1 blank answered correctly ⇒ `pointsAwarded === 1/3`; `scoreOutOf10(3 * (1/3), 1) === 10`; `scoreOutOf10(1/3 + 1/3 + 1/3 + 9, 10) === 10`.
  - `views/grading.test.ts`: `pointStep(1/3) === 1/6`; `stepPoints(null, 1/3, 1) === 1/6`; `stepPoints(1/6, 1/3, 1) === 1/3`; `stepPoints(0.5, 2, 1) === 0.75` (unchanged); `markedTotals` with three marks of `1/3` gives `awarded === 1`.
  - `ai/grading.test.ts`: `roundToStep(0.3, 1/3) === 1/3`; existing cases unchanged.
- [ ] **Step 2: Run** those three files — FAIL.
- [ ] **Step 3: Implement.** Remove the `* 100) / 100` rounding in `proportional`, the grading action's `pointsAwarded` write, `stepPoints` and `markedTotals`. In the grading action, compare `points > s.question.points + 1e-9`. Display keeps using `formatScoreValue` (2 decimals).
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Commit** `feat: exact points for split bài`.

---

### Task 4: Editing helpers (suggest, join, release, drop, split points)

**Files:**
- Create: `src/lib/question-groups-edit.ts`
- Test: `src/lib/question-groups-edit.test.ts` (fixture `src/lib/fixtures/life-in-the-wild.ts` exporting the 25 prompts below)

**Interfaces:**
- Consumes: `Question`, `QuestionGroup`, `uid` (`lib/questions.ts`), `checkGroups`.
- Produces (all pure, return new arrays, `checkGroups(result) === null` always):
  - `suggestGroups(qs: Question[]): { questions: Question[]; groups: { title: string; from: number; to: number; prompt: string; image?: QuestionImage }[] }` (`from`/`to` 1-based câu numbers).
  - `createGroup(qs, questionId): Question[]` — one-câu bài, empty prompt.
  - `joinGroup(qs, questionId, direction: "up" | "down"): Question[]` — joins the neighbour's bài, or forms a new bài with the standalone neighbour.
  - `releaseQuestion(qs, questionId): Question[]` — only first/last câu con; lossless.
  - `ungroup(qs, groupId): Question[]` — lossless for all members.
  - `updateGroup(qs, groupId, patch: Partial<Omit<QuestionGroup, "id">>): Question[]`.
  - `setGroupPoints(qs, groupId, total: number): Question[]` — each member `points = total / count`.
  - `deleteGroup(qs, groupId): Question[]`.
  - `applyDrop(before: Question[], after: Question[], movedId: string): Question[]` — `after` is `arrayMove` output.
  - `canRelease(qs, questionId): boolean`.

Rules:
- **suggestGroups**: walk standalone questions left to right; a run = consecutive standalone questions with identical trimmed first line, length ≥ 2. Shared lines = longest common prefix of trimmed lines across the run, shrunk until every member keeps ≥ 1 non-empty line. Members' prompts = remaining lines joined with `"\n"`, trimmed. If all members have the same `image.path`, move it to `group.image`. Label: `/^(Part|Bài|Exercise|Câu|Phần)\s+(\d+|[IVXLC]+)[a-z]?\s*[.:)]\s*/i` on the shared prompt ⇒ `label = "<word> <num>"` (as written), prompt = rest. Existing bài untouched.
- **Lossless release** (`releaseQuestion`, `ungroup`, and `applyDrop` when leaving): `prompt = [group.prompt, q.prompt].filter(Boolean).join("\n")`; if the câu has no `image` and the group has one, `image = group.image`; delete `group`.
- **applyDrop**: let p/n be the moved câu's neighbours in `after`. If `p.group?.id === n.group?.id` and defined ⇒ join that bài (copy its group; if the moved câu came from another bài, release losslessly first). Else if the moved câu had group G and `p` or `n` is in G ⇒ keep. Else if it had a group ⇒ release losslessly. Else unchanged.

- [ ] **Step 1: Failing tests.** Fixture prompts (from the live draft, 2026-10-20):
  - Q1–9: `"Replace the bold words using the word in the box (strong, patient, calm, smart, creep, gentle, fierce, hunt, escape, fight):\n" + ["Pandas are usually **kind and soft** animals.", "Dolphins are **clever** animals that can learn quickly.", …]` (any 9 distinct second lines), `tra-loi-ngan`, 1 pt.
  - Q10: `"Complete the text with the words in the box of Part 1 (…).\nLife in the Wild\nAnimals have many … ___ …"`, `dien-cho-trong`, 9 pts.
  - Q11–20: `"Part 3. Complete the sentences with the correct subject or object pronoun.\n" + "David is very kind to his little sister. ___ always helps ___ with her homework."` (distinct per câu), `dien-cho-trong`, 1 pt.
  - Q21–25: `"Part 4. Read and write.\nWrite the sentences about " + name + " using the table in the picture.\n" + name + " ___"` for Anna, Mike, Lucy, Tom, Harry, `tu-luan`, 1 pt, all with `image: { path: FIG, width: 600, height: 400 }`.

```ts
it("suggests the three bài of the reference set", () => {
  const { questions, groups } = suggestGroups(lifeInTheWild)
  expect(groups.map((g) => [g.title, g.from, g.to])).toEqual([["Bài 1", 1, 9], ["Part 3", 11, 20], ["Part 4", 21, 25]])
  expect(questions[0].prompt).toBe("Pandas are usually **kind and soft** animals.")
  expect(questions[9].group).toBeUndefined()
  expect(questions[10].group).toMatchObject({ label: "Part 3", prompt: "Complete the sentences with the correct subject or object pronoun." })
  expect(questions[20].group?.image?.path).toBe(FIG)
  expect(questions[20].image).toBeUndefined()
  expect(questions[20].prompt).toBe("Write the sentences about Anna using the table in the picture.\nAnna ___")
  expect(checkGroups(questions)).toBeNull()
})
it("ungroup after suggest restores prompts and figures (label token aside)", () => {
  const { questions } = suggestGroups(lifeInTheWild)
  const back = ungroup(ungroup(ungroup(questions, questions[0].group!.id), questions[10].group!.id), questions[20].group!.id)
  expect(back[0].prompt).toBe(lifeInTheWild[0].prompt)
  expect(back[10].prompt).toBe(lifeInTheWild[10].prompt.replace(/^Part 3\. /, ""))
  expect(back[20].image?.path).toBe(FIG)
})
it("returns no groups when nothing shares a first line", () => { expect(suggestGroups([q("a"), q("b")]).groups).toEqual([]) })
it("applyDrop keeps a câu moved to the last slot of its own bài", …)   // group [b,c,d], move b after d, next neighbour standalone ⇒ b keeps group
it("applyDrop joins a bài when dropped between two of its câu", …)
it("applyDrop releases a câu dragged away from its bài, losslessly", …)
it("joinGroup with a standalone neighbour forms a new bài with empty prompt", …)
it("releaseQuestion refuses a middle câu (canRelease false) and releases the last", …)
it("setGroupPoints splits exactly", () => { /* 1 pt over 3 ⇒ each 1/3, sum === 1 */ })
it("deleteGroup removes the bài and its câu", …)
```

- [ ] **Step 2: Run** `pnpm test src/lib/question-groups-edit.test.ts` — FAIL.
- [ ] **Step 3: Implement** per the rules above.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: pure editing helpers for bài`.

---

### Task 5: Library editor UI

**Files:**
- Modify: `src/components/exercise-detail/QuestionList.tsx` (render blocks, `applyDrop` on drag end, a11y numbers)
- Modify: `src/components/exercise-detail/QuestionCard.tsx` (overflow menu with câu con / standalone actions)
- Create: `src/components/exercise-detail/GroupCard.tsx` (bài card: title, "N câu · X điểm", shared prompt + figure, actions "Sửa bài", "Bỏ bài", "Xoá bài", children slot)
- Create: `src/components/exercise-detail/GroupEditorSheet.tsx` (label, shared prompt textarea, `FigureField`, "Điểm cả bài")
- Create: `src/components/exercise-detail/SuggestGroupsSheet.tsx` (preview list from `suggestGroups(...).groups`, "Áp dụng"/"Huỷ", empty text "Không tìm thấy câu nào có chung đề.")
- Modify: `src/components/exercise-detail/question-draft.ts` (`fromDraft` keeps `previous?.group`) + `question-draft.test.ts`
- Modify: `src/components/pages/ExerciseSetDetail.tsx` (wire helpers, "Tự chia bài" button next to "Giải đáp án", hidden for flashcard sets; solve merge keeps `group` incl. `imageUrl`; delete-bài undo)

**Interfaces:**
- Consumes: Task 1 `groupBlocks`, `groupTitle`; Task 4 helpers; `QuestionPicture` with `q.group`.
- Produces: no new exports beyond the components.

- [ ] **Step 1: Failing test** in `question-draft.test.ts`: `fromDraft(toDraft(q), q.id, q)` where `q.group = { id: "x", label: "Part 3", prompt: "P" }` returns `group` equal to `q.group`.
- [ ] **Step 2: Run** `pnpm test src/components/exercise-detail/question-draft.test.ts` — FAIL.
- [ ] **Step 3: Implement** `fromDraft` (`...(previous?.group ? { group: previous.group } : {})`), then the components. Points shown: `formatScoreValue`, prefixed "≈" when `Math.abs(round2(x) - x) > 1e-9`. "Giải đáp án" merge: `{ ...answered, imageUrl: q.imageUrl, solutionImageUrl: q.solutionImageUrl, ...(q.group ? { group: q.group } : {}) }`. "Tách khỏi bài" disabled with title "Kéo câu ra khỏi bài trước" when `!canRelease`. "Tạo bài từ câu này" and new bài from `joinGroup` open `GroupEditorSheet`. Before `persist`, `checkGroups(questions)` ⇒ `toast.error`.
- [ ] **Step 4: Run** `pnpm test`, `pnpm typecheck`, `pnpm lint` — PASS. Manually (`pnpm dev`, seeded DB): create a set with 3 câu sharing a first line, "Tự chia bài" → "Áp dụng" → save → reload shows the bài.
- [ ] **Step 5: Commit** `feat: bài in the library editor`.

---

### Task 6: Take screen and print

**Files:**
- Create: `src/components/take/SharedPromptBox.tsx` (`{ group: QuestionGroup; title: string }` — scroll container, `max-h-[40vh]` on md+, `max-h-[30vh]` below; mounted with `key={group.id}` outside the per-question `motion.div` so its scroll survives câu changes within the bài)
- Modify: `src/components/take/TakeAssignment.tsx` (render box above the question when `q.group`; title via `groupBlocks(questions)`; `QuestionGrid` shows small bài titles above each bài's cells)
- Modify: `src/components/schedule/PrintableExercise.tsx` (render blocks: title + shared prompt/figure once)
- Test: `src/lib/views/student.test.ts` (`toTakeQuestion` keeps `group`)

**Interfaces:**
- Consumes: `groupBlocks`, `groupTitle` (Task 1).

- [ ] **Step 1: Failing test**: `toTakeQuestion({ ...shortAnswer, group: { id: "x", prompt: "P" } })` has `group` `{ id: "x", prompt: "P" }` (passes through; if it already passes, keep it as a regression test).
- [ ] **Step 2: Run** `pnpm test src/lib/views/student.test.ts`.
- [ ] **Step 3: Implement** the box, grid titles and print blocks. The box is not inside `AnimatePresence`'s keyed `motion.div` (key = `q.id`), so it doesn't remount per câu.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 5: Commit** `feat: shared bài prompt on the take screen and print`.

---

### Task 7: Grading and result screens

**Files:**
- Modify: `src/components/grading/GradeAttempt.tsx` (~415: render `groupBlocks(d.answers.map(a => ({ ...a, group: a.question.group })))`; bài header "Part 3 · 8/10" from live marks; câu card unchanged with its number)
- Create: `src/components/question/GroupHeader.tsx` (shared by grading and result: title, `awarded/total` via `formatScoreValue`, shared prompt with `RichText`, figure with `QuestionPicture`)
- Modify: `src/lib/views/student.ts` (`ReviewItem.group?: QuestionGroup`, set in both builders ~103–123, ~393–413; add `number: number` = set position so filtered lists keep numbers) + `student.test.ts`
- Modify: `src/components/results/ResultDetail.tsx` (~218: blocks over the visible review items with `numberOf = item.number`; header shown when ≥ 1 member visible; bài score = sum of members' awarded over their points)

**Interfaces:**
- Consumes: `groupBlocks` with `numberOf` (Task 1). ReviewItem gains `group`, `number`, and `pointsAwarded`/`points` if not already present (add them if the header needs them).

- [ ] **Step 1: Failing test** in `student.test.ts`: the result builder for an attempt whose snapshot questions carry `group` yields review items with that `group` and `number` 1…N in set order.
- [ ] **Step 2: Run** `pnpm test src/lib/views/student.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 5: Commit** `feat: bài headers on grading and result screens`.

---

### Task 8: AI requests include the shared prompt and figure

**Files:**
- Modify: `src/lib/ai/solve.ts` (`solveRequestText`: `Question: ${fullPrompt(q)}`)
- Modify: `src/lib/ai/grading.ts` (`essayQuestionText`, `paperQuestionText`: `Đề bài: ${fullPrompt(q)}`)
- Modify: `src/lib/ai/hints.ts` (`hintsPrompt` uses `fullPrompt`; `leaksAnswer`/`mathValueLeaks` compare against `fullPrompt(q)`)
- Modify: `src/server/actions/ai-solve.ts` (~37), `ai-grading.ts` (`figureBlocks` ~39), `ai-hints.ts` (~38): attach `questionFigures(q)` (keep the `figureOwner === setId` check per figure in ai-solve)
- Test: `src/lib/ai/solve.test.ts`, `grading.test.ts`, `hints.test.ts`

**Interfaces:**
- Consumes: `fullPrompt`, `questionFigures` (Task 1).

- [ ] **Step 1: Failing tests:** each builder's text contains `"Part 3\nComplete the sentences"` for a câu with `group: { id: "x", label: "Part 3", prompt: "Complete the sentences…" }`; `leaksAnswer("The word is gentle", q)` is `false` when `q.answer === "gentle"` and the group prompt contains "gentle".
- [ ] **Step 2: Run** `pnpm test src/lib/ai` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test src/lib/ai && pnpm typecheck`.
- [ ] **Step 5: Commit** `feat: AI sees the shared bài prompt and figure`.

---

### Task 9: E2E

**Files:**
- Create: `e2e/grouped-questions.spec.ts`
- Modify: `e2e/db.ts` only if `createSet` can't take a `group` already (it inserts raw content, so it should).

- [ ] **Step 1: Write specs:**
  - Parent: `createSet` with 3 `dien-cho-trong` câu sharing the first line `"Part 3. Complete the sentences."` + 1 standalone; open `/parent/library/{id}`, click "Tự chia bài", see "Part 3" and "câu 1–3" in the preview, "Áp dụng", "Lưu nháp", reload, see the bài card titled "Part 3" with 3 câu.
  - Child: assign a grouped set (via `createSet` with `group` on 3 câu + `assign`); open the take screen; on Câu 1, 2 and 3 the shared box with "Part 3" is visible; on Câu 4 (standalone) it is not; submit.
  - Parent grading: the attempt shows a "Part 3" header with a score like `/3`; the result screen shows "Part 3".
- [ ] **Step 2: Run** `pnpm test:e2e e2e/grouped-questions.spec.ts` — PASS on ipad and iphone.
- [ ] **Step 3: Full check:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` — all PASS.
- [ ] **Step 4: Commit** `test: e2e for grouped questions`; update `CLAUDE.md` "Domain rules" with one bullet on `group` (stored per câu con, `groupBlocks` numbering, `figurePaths`/`fullPrompt` must include it) and mark the backlog item's phase 1 as done in `docs/backlog.md`.
