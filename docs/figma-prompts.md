# Prompt Figma Make — Homework Hub

Cách dùng:
1. Mở **Figma Make** → tạo file mới → dán **Prompt 0** (nền tảng + khung app). Đợi nó tạo xong.
2. Dán lần lượt **Prompt 1 → 15** vào **cùng file đó** (từng prompt một, xem kết quả, sửa nếu cần rồi mới dán prompt tiếp).
3. Muốn sửa thì gõ thêm câu ngắn, ví dụ: `Make the subject cards larger on iPad`, `Use the orange subject color for Tiếng Việt everywhere`.
4. Xong thì đưa code lên GitHub (xem mục **Đưa lên GitHub** ở cuối), clone về `C:\Sources\homework` và báo Claude làm tiếp Giai đoạn 1.

> Prompt viết bằng tiếng Anh để Figma Make hiểu chính xác; **toàn bộ chữ hiển thị trên giao diện là tiếng Việt** (riêng nội dung môn Tiếng Anh thì để tiếng Anh).

---

## Prompt 0 — Nền tảng, design system & khung app

```
Build a mobile-first web app called "Homework Hub" — a home learning manager a parent uses to assign, grade and track homework for ONE primary-school child (currently Grade 3, will grow to Grade 4–7). There is NO login. The app has two modes switched by a toggle: "Phụ huynh" (Parent) and "Học sinh" (Student).

TECH: React + TypeScript + Tailwind CSS + shadcn/ui components + lucide-react icons + Recharts for charts. Use shadcn/ui primitives (Card, Button, Badge, Tabs, Dialog, Sheet, Select, Calendar, Progress, Table, Textarea, Toggle Group, Sonner toast). Keep components small and reusable in a components/ folder. Use realistic mock data in a separate mock-data file, typed with TypeScript interfaces.

LANGUAGE: All UI text is Vietnamese. Dates in Vietnamese format, e.g. "Thứ Hai, 12/10/2026". Scores shown on a 10-point scale ("8,5/10") plus percentage.

DESIGN SYSTEM:
- Friendly for a child but clean and uncluttered for the parent. Rounded corners (radius 16px on cards, 12px on buttons), soft shadows, generous white space.
- Font: "Be Vietnam Pro" (Google Fonts) — supports Vietnamese diacritics well. Base size 16px; student mode uses larger text (18px base, 28px+ headings).
- Neutral base: white / slate-50 background, slate-900 text. Primary brand color: indigo-600.
- Subject colors, used consistently on badges, card accents, chart series and icons:
  - Toán (Math) = blue-500, icon "Calculator"
  - Tiếng Việt = orange-500, icon "BookOpen"
  - Tiếng Anh = green-500, icon "Languages"
- Status colors: Chưa làm (not started) = slate, Đang làm (in progress) = amber, Chờ chấm (awaiting grading) = violet, Đã chấm (graded) = emerald, Trễ hạn (overdue) = red.
- Minimum touch target 44×44px. Support light mode only for now.

RESPONSIVE LAYOUT (design for these frames):
- Phone 390px: bottom tab bar navigation with 5 icon+label tabs, top app bar with page title and the mode toggle.
- iPad portrait 820px and iPad landscape 1180px: collapsible left sidebar navigation, content in a max-width container with 2–3 column card grids.

NAVIGATION:
- Parent mode tabs: Tổng quan (Dashboard), Kho bài tập (Library), Lịch giao bài (Schedule), Chấm bài (Grading), Báo cáo (Reports).
- Student mode tabs: Hôm nay (Today), Bài của em (My assignments), Kết quả (Results).
- Mode toggle "Phụ huynh / Học sinh" in the app bar (phone) or sidebar footer (iPad). Student mode should feel more playful: bigger cards, a friendly greeting "Chào Minh An! 👋", star/sticker rewards.

MOCK DATA: Student name "Minh An", Grade 3. Subjects Toán, Tiếng Việt, Tiếng Anh. Create ~15 exercise sets, ~10 assignments across the current week, and ~20 graded attempts over the last 6 weeks with realistic scores (mostly 6–10).

For now, build the app shell (navigation for both modes, responsive layout, mode toggle) with an empty placeholder page for each tab. I will describe each screen in follow-up prompts.
```

---

## Prompt 1 — Phụ huynh: Tổng quan (Dashboard)

```
Build the Parent "Tổng quan" (Dashboard) page.

Top: greeting "Chào buổi sáng!" and today's date. Then a row of 4 KPI stat cards (2×2 grid on phone, 4 in a row on iPad landscape):
- "Bài tuần này" — 8 assigned, small progress ring 5/8 done
- "Chờ chấm" — 2, violet, tap goes to Grading
- "Điểm TB tuần" — 8,4/10 with a ▲ +0,6 vs last week trend chip
- "Trễ hạn" — 1, red

Section "Hôm nay của Minh An": list of today's assignments as compact rows — subject color dot + icon, title (e.g. "Phép nhân trong phạm vi 1000", "Chính tả: Mùa thu của em", "Unit 5: My family"), due time, status badge.

Section "Điểm theo môn" — a Recharts line chart of average score per week for the last 6 weeks, one line per subject in the subject colors, with legend and tooltips.

Section "Cần chú ý" — 3 small insight cards highlighting weak skills, e.g. "Toán · Bài toán có lời văn — 58% đúng", "Tiếng Việt · Dấu hỏi/ngã — 65% đúng", each with a button "Giao bài luyện tập".

Bottom: quick actions row — "+ Thêm bài tập", "Giao bài", "Xem báo cáo".
```

## Prompt 2 — Phụ huynh: Kho bài tập (danh sách)

```
Build the Parent "Kho bài tập" (Exercise Library) page.

Header with title, a search input "Tìm bài tập…" and a primary button "+ Thêm bài tập" that opens a menu with 3 options: "Soạn thủ công", "Tải lên ảnh / PDF", "Tạo bằng AI" (with a sparkle icon).

Filter bar (horizontally scrollable chips on phone, a row of Selects on iPad):
- Môn: Tất cả / Toán / Tiếng Việt / Tiếng Anh
- Lớp: 3, 4, 5, 6, 7
- Loại: Đề thi / Bài học theo chủ đề / Luyện tập
- Nguồn: Thủ công / Tải lên / AI
- Trạng thái: Nháp / Sẵn sàng

Results as a card grid (1 column phone, 2 iPad portrait, 3 iPad landscape). Each card: subject color accent bar + icon, title (e.g. "Đề kiểm tra giữa kỳ I – Toán 3", "Bảng nhân 6, 7", "Luyện từ và câu: Từ chỉ sự vật", "Unit 3: At school – Vocabulary"), badges for Lớp 3 / type / source, number of questions ("12 câu"), difficulty as 1–5 dots, "Đã giao 2 lần", and a small kebab menu (Sửa, Giao bài, Nhân bản, Xóa). A "Nháp" badge on drafts.

Include an empty state illustration with text "Chưa có bài tập nào" and the add button.
```

## Prompt 3 — Phụ huynh: Chi tiết / soạn bộ bài tập

```
Build the "Chi tiết bộ bài tập" page (view + edit an exercise set).

Top section: editable metadata form — Tên bộ bài, Môn (Select), Lớp (Select), Loại (Đề thi / Bài học theo chủ đề / Luyện tập), Chủ đề (text, e.g. "Phép chia có dư"), Độ khó (1–5 stars), and attached source files shown as thumbnails (an image of a scanned worksheet, a PDF icon).

Question list: numbered cards, each showing the question type badge, points ("1 điểm"), skill tags (e.g. "Bảng nhân", "Toán có lời văn"), the question content, and the correct answer highlighted in green. Drag handle to reorder, edit and delete icons.

Show one example of EACH question type:
1. Trắc nghiệm (multiple choice): "7 × 8 = ?" options A. 54  B. 56  C. 63  D. 48
2. Đúng / Sai: "Số 450 đọc là: Bốn trăm năm mươi."
3. Điền vào chỗ trống: "Mùa thu, trời trong xanh và ____ ." (answer: cao vời vợi)
4. Trả lời ngắn: "Một cửa hàng có 96 kg gạo, đã bán 1/4 số gạo. Hỏi đã bán bao nhiêu ki-lô-gam?" (answer: 24 kg)
5. Nối (matching): English words ↔ pictures/meanings: father–bố, mother–mẹ, sister–chị/em gái
6. Sắp xếp (ordering): arrange words into a sentence: "em / đến / trường / Hôm nay / sớm"
7. Tự luận (essay): "Viết đoạn văn ngắn (4–5 câu) kể về một người bạn của em."

Bottom: "+ Thêm câu hỏi" button opening a Sheet where you pick the question type, then a form adapting to that type. Sticky footer on phone with "Lưu nháp" and "Lưu & sẵn sàng" buttons, and a secondary "Giao bài này".
```

## Prompt 4 — Phụ huynh: Tải lên & duyệt kết quả quét

```
Build the "Tải lên tài liệu" flow (upload image/PDF → AI scan → review).

Step 1 — Upload: large dashed dropzone "Kéo thả ảnh hoặc PDF vào đây" plus buttons "Chụp ảnh" (camera, for iPad/phone) and "Chọn tệp". Show uploaded files as thumbnails with remove buttons. Fields to pre-fill: Môn, Lớp, Loại. Button "Quét bằng AI".

Step 2 — Processing: progress state with friendly text "Đang đọc tài liệu… (trang 2/3)" and a skeleton list.

Step 3 — Review: split view. On iPad: left pane shows the original scanned page image (zoomable), right pane shows the extracted questions as editable cards (same card style as the exercise set editor). On phone: tabs "Bản gốc" / "Câu hỏi đã quét". Each extracted question has a confidence indicator; low-confidence ones are highlighted amber with the note "Cần kiểm tra". Buttons per question: Sửa, Xóa, and "Gộp với câu trên". Footer: "Hủy" and "Lưu vào kho bài tập".
```

## Prompt 5 — Phụ huynh: Tạo đề bằng AI

```
Build the "Tạo bằng AI" (AI generate) dialog/page.

Form: Môn, Lớp, Loại (Đề thi / Luyện tập), Chủ đề (multi-select chips from existing topics, e.g. "Bảng nhân 6–9", "Đo độ dài", "Từ chỉ hoạt động", "Unit 4: My body"), Số câu (slider 5–30), Độ khó (1–5), mix of question types (checkbox chips), and "Dựa trên bài trong kho" — pick 1–3 existing exercise sets as reference (cards with checkboxes). Optional note textarea "Yêu cầu thêm" (e.g. "Tập trung vào bài toán có lời văn").

Primary button with sparkle icon "Tạo đề". Result shown as a preview of the generated set (same question cards) with buttons "Tạo lại", "Sửa", "Lưu vào kho (nháp)".
```

## Prompt 6 — Phụ huynh: Lịch giao bài

```
Build the Parent "Lịch giao bài" (Schedule) page.

Toggle between "Tuần" and "Ngày" views, with previous/next arrows and a "Hôm nay" button.

Week view (iPad): 7 columns Thứ Hai → Chủ Nhật, each column lists assignment chips colored by subject with title and status. Week view (phone): vertical list grouped by day with sticky day headers.

Day view: timeline list of that day's assignments with available-from time, due time, mode icon (💻 Làm trên web / 📄 Làm trên giấy) and status.

Floating "+ Giao bài" button opens a Sheet "Giao bài mới":
- Chọn bộ bài tập (searchable list from the library, filtered by subject)
- Hình thức: Làm trên web / In ra giấy
- Lịch: "Một ngày" (date picker + due time) OR "Cả tuần" (pick days of week as toggle chips T2–CN, auto-creates one assignment per selected day) OR "Lên lịch" (start date-time when it becomes visible)
- Số lần làm tối đa: 1 or 2 (default 2)
- Ghi chú cho con (textarea)
- Button "Giao bài"

Show a printable action "In đề" on paper-mode assignments.
```

## Prompt 7 — Phụ huynh: Hàng đợi chấm bài

```
Build the Parent "Chấm bài" (Grading queue) page.

Tabs: "Chờ chấm (2)", "Đã chấm", "Tất cả".

Each item card: subject icon/color, assignment title, "Lần 1" or "Lần 2" badge, submitted time ("Nộp lúc 19:42, hôm qua"), mode (Web / Giấy scan with a small thumbnail of the scanned page), auto-graded partial score (e.g. "Tự chấm: 7/9 câu · còn 1 câu tự luận"), and a "Chấm ngay" button.

Graded items show the final score large ("8,5/10") with a colored badge and whether a second attempt is pending.
```

## Prompt 8 — Phụ huynh: Màn chấm bài

```
Build the "Chấm bài" detail screen for one attempt.

iPad layout: left pane = the student's work. For a paper submission show the scanned page images (swipe between pages, pinch-zoom, ability to draw red pen marks/ticks on top). For a web submission show the student's answers per question. Right pane = grading panel per question: question text, correct answer, student's answer, auto-grade result (✓ green / ✗ red) that the parent can override, points input (stepper, e.g. 0 / 0,5 / 1), and a short comment field with quick-comment chips ("Rất tốt!", "Cẩn thận hơn nhé", "Xem lại bảng nhân 7", "Sai chính tả").
Phone layout: one question at a time with a swipe/next button, the student's work collapsible above.

An "AI gợi ý" button (sparkle) on essay questions fills a suggested score and comment the parent can accept or edit.

Footer: total score computed live ("Tổng: 8,5/10"), a "Nhận xét chung" textarea, a toggle "Cho phép làm lại lần 2", and the primary button "Hoàn tất chấm bài".
```

## Prompt 9 — Phụ huynh: Báo cáo phân tích

```
Build the Parent "Báo cáo" (Reports & analytics) page with modern, clean Recharts charts using the subject colors.

Filters at top: time range (4 tuần / 3 tháng / Học kỳ / Tùy chọn) and subject chips.

Sections (cards in a responsive grid):
1. KPI row: Bài đã hoàn thành (42), Điểm trung bình (8,2), Tỷ lệ đúng hạn (90%), Cải thiện lần 2 (+1,4 điểm).
2. "Xu hướng điểm" — area/line chart of score per week per subject.
3. "Điểm theo môn" — radial bar or bar chart comparing average per subject.
4. "Kỹ năng" — horizontal bar chart of accuracy per skill tag, sorted weakest first, bars colored red (<60%), amber (60–80%), green (>80%). Examples: "Bảng nhân 7, 8", "Toán có lời văn", "Đo độ dài", "Dấu hỏi/ngã", "Từ chỉ đặc điểm", "Vocabulary: Family", "Grammar: to be".
5. "Lần 1 → Lần 2" — dumbbell/slope chart showing score improvement between first and second attempts for recent assignments.
6. "Thói quen làm bài" — heatmap calendar of days with completed work (like GitHub contributions) and average time spent per assignment.
7. "Nhận xét của AI" card — a short weekly summary paragraph in Vietnamese with 3 suggested next steps, each with "Giao bài" button.
```

## Prompt 10 — Học sinh: Hôm nay

```
Build the Student "Hôm nay" (Today) page. Student mode is playful and simple, large touch-friendly cards, large text.

Header: "Chào Minh An! 👋", date, and a star counter "⭐ 46 sao" with a small streak badge "🔥 5 ngày liên tiếp".

Big assignment cards for today, each in its subject color with icon: title, number of questions and estimated time ("10 câu · khoảng 15 phút"), parent's note in a speech bubble ("Con làm cẩn thận nhé!"), status, and one big button:
- "Bắt đầu" (not started), "Làm tiếp" (in progress, with progress bar), "Đã nộp – chờ bố mẹ chấm" (disabled, violet), "Xem kết quả" (graded), "Làm lại lần 2" (if allowed).
- For paper assignments: "Nộp bài giấy" button with a camera icon.

Below: "Sắp tới" — small cards for the next days. When everything is done show a celebration state "Hoàn thành hết rồi! 🎉".
```

## Prompt 11 — Học sinh: Bài của em

```
Build the Student "Bài của em" (My assignments) page — the full list of everything assigned to the child, beyond just today. Same playful student style: large text, big touch-friendly cards, subject colors.

Header: title "Bài của em" and a small summary line "Tuần này: 5/8 bài đã xong" with a progress bar.

Status tabs (segmented control, scrollable on phone) with counts:
- "Cần làm (3)" — not started + in progress, sorted by due date, soonest first
- "Chờ chấm (2)" — submitted, waiting for the parent
- "Làm lại (1)" — graded with a second attempt allowed and not yet used
- "Đã xong (12)" — graded and closed

Subject filter chips under the tabs: Tất cả / Toán / Tiếng Việt / Tiếng Anh (each chip in its subject color with icon).

List grouped by due date with friendly sticky headers: "Trễ hạn" (red, at the top if any), "Hôm nay", "Ngày mai", "Thứ Năm, 15/10", "Tuần sau".

Each assignment card (1 column on phone, 2 columns on iPad): subject color accent + icon, title (e.g. "Bảng nhân 8", "Tập làm văn: Tả con vật em yêu", "Unit 6: My school – Listening"), mode icon (💻 Làm trên web / 📄 Làm trên giấy), "10 câu · khoảng 15 phút", due label ("Hạn: 20:00 hôm nay"; red "Trễ 1 ngày" if overdue), attempt badge "Lần 1" / "Lần 2", progress bar if in progress, the score badge if graded ("8,5/10" + stars), and one big action button matching the status: "Bắt đầu", "Làm tiếp", "Nộp bài giấy", "Đang chờ bố mẹ chấm" (disabled), "Làm lại lần 2", "Xem kết quả".

Empty states per tab with a cute illustration, e.g. "Không còn bài nào cần làm. Giỏi quá! 🎉" and "Chưa có bài nào chờ chấm".

Tapping a card opens the take-assignment screen, the paper-submission screen, or the result screen depending on its status.
```

## Prompt 12 — Học sinh: Màn làm bài

```
Build the Student "Làm bài" (take assignment) screen — full-screen focus mode, no navigation bar.

Top: close (X) with confirm dialog "Lưu và thoát?", assignment title, progress bar "Câu 3/10", optional elapsed timer.

One question per screen, very large readable text, big tappable answer areas. Implement an interactive UI for each question type:
- Trắc nghiệm: 4 large option buttons (A/B/C/D), selected = filled subject color.
- Đúng / Sai: two big buttons "Đúng ✓" and "Sai ✗".
- Điền vào chỗ trống: sentence with inline input boxes.
- Trả lời ngắn: one large input with a numeric keypad hint for math.
- Nối: two columns; tap left item then right item to draw a connecting line (also support drag).
- Sắp xếp: draggable word chips to arrange into a sentence.
- Tự luận: large textarea with character count, plus an option "Viết tay" that opens a drawing canvas for Apple Pencil.

Bottom: "Câu trước" / "Câu tiếp" buttons and a question-number grid (opens in a Sheet) showing answered/unanswered. Auto-save indicator "Đã lưu". Last screen: review summary ("Còn 1 câu chưa làm") and big "Nộp bài" button with a confirm dialog.
```

## Prompt 13 — Học sinh: Kết quả

```
Build the Student "Kết quả" (Result) screen after grading.

Hero: big score "8,5/10" with stars earned (e.g. ⭐⭐⭐ +3 sao) and a friendly message ("Giỏi lắm! Con đã tiến bộ hơn lần trước 🎉"). If it's attempt 2, show "Lần 1: 6,5 → Lần 2: 8,5" with an up arrow.

Parent's overall comment in a speech bubble with avatar "Bố mẹ".

Question-by-question review list: each row shows ✓/✗, the question, the child's answer, the correct answer (only for wrong ones), and the parent's comment. Filter chips "Tất cả / Câu sai".

Bottom buttons: "Làm lại lần 2" (primary, only if allowed and not yet used) and "Về trang chính".

Also build the "Kết quả" tab list page: list of past graded assignments with subject color, title, date, score badge, and attempt info.
```

## Prompt 14 — Học sinh: Nộp bài giấy

```
Build the "Nộp bài giấy" (submit paper work) screen.

Instructions with a simple illustration: "Chụp rõ từng trang bài làm, đủ ánh sáng, không bị nghiêng."
Big "Chụp ảnh" button (opens camera) and "Chọn ảnh có sẵn". Captured pages appear as a reorderable thumbnail strip labeled "Trang 1", "Trang 2" with retake/delete per page and a preview with auto-crop frame overlay.
Primary button "Nộp bài" → success screen "Đã nộp! Bố mẹ sẽ chấm sớm nhé 📮".
```

## Prompt 15 — Học sinh: Animation & âm thanh

> Dán sau khi đã có đủ các màn học sinh (Prompt 10–14). Nếu Figma Make làm quá nhiều thứ một lúc, tách thành 2 lần: phần **ANIMATION** trước, phần **SOUND** sau.

```
Add delightful animations and sound effects to ALL Student-mode screens (Hôm nay, Bài của em, Làm bài, Kết quả, Nộp bài giấy) so they feel lively and rewarding for an 8-year-old. Parent mode stays calm: keep only subtle transitions there, and no sound.

LIBRARIES: use "motion" (Framer Motion, import from "motion/react") for UI animation and "canvas-confetti" for celebrations. Put all animation variants in one file (lib/animations.ts) and all sound logic in one hook (hooks/useSound.ts) so they are reused everywhere.

ANIMATION:
- Page transitions: student pages slide + fade in (200–300ms, spring). Card lists animate in with a stagger (each card 40ms after the previous one).
- Cards and big buttons: gentle scale to 0.96 on press and a soft spring back; a hover lift on iPad with a trackpad/mouse.
- Hôm nay: the greeting waves 👋 once on load; the star counter "⭐ 46 sao" counts up when it changes; the streak flame 🔥 flickers softly; the "Hoàn thành hết rồi! 🎉" state plays confetti and a bouncing mascot.
- Bài của em: the tab indicator slides between tabs (layout animation); cards reorder/filter with smooth layout animation; overdue cards get one gentle red pulse on load (not looping).
- Làm bài:
  - Questions slide horizontally (next = slide left, previous = slide right).
  - The progress bar fills smoothly; a small star pops on the progress bar each time a question is answered.
  - Selecting an option: a bounce + subject-color fill. Matching: the connecting line draws itself (SVG path length animation). Ordering: word chips spring into place while dragging.
  - Auto-save indicator "Đã lưu" fades in with a check mark, then fades out.
  - "Nộp bài": the button morphs into a paper plane ✈️ that flies off the screen, then shows "Đã nộp!".
- Kết quả:
  - The score counts up from 0 to the final value (e.g. 0 → 8,5) in about 1.2s.
  - Stars pop in one by one with a scale + rotate spring; then a confetti burst if the score ≥ 8, and a smaller burst for ≥ 6. Below 6: a kind encouraging animation (a mascot giving a thumbs up), never anything that feels like punishment.
  - Attempt 2: animate the arrow "Lần 1: 6,5 → Lần 2: 8,5" growing, with a "Tiến bộ!" badge popping in.
  - Review list: ✓ draws itself in green; ✗ does a short gentle shake.
- Nộp bài giấy: a camera shutter flash when a photo is taken; thumbnails fly into the page strip; success screen shows an envelope 📮 sliding into a mailbox.
- Accessibility: respect prefers-reduced-motion — when it's on, replace motion with simple fades and turn off confetti. Keep every animation short (≤ 600ms except the celebration) so it never slows the child down.

SOUND:
- Generate all sounds in code with the Web Audio API (short synthesized tones, no audio files needed), in hooks/useSound.ts with a clear API, e.g. play("tap"). Structure it so real audio files in /public/sounds/*.mp3 can replace the synthesized tones later without changing callers.
- Sound set (all short, soft, cheerful; volume about 0.4):
  - "tap" — very soft click on button / option press
  - "select" — light pop when an answer is chosen
  - "next" — soft whoosh when changing question
  - "correct" — bright two-note chime (used on the result review for correct answers)
  - "wrong" — soft low "boop", gentle and not scary
  - "star" — sparkle "ting" for each star that pops in (pitch rising for each next star)
  - "submit" — whoosh for the paper plane
  - "celebrate" — short happy fanfare with the confetti
  - "shutter" — camera click on the paper-submission screen
- Do NOT reveal right/wrong while the child is still doing the assignment — only play "correct"/"wrong" on the Kết quả screen.
- iPad/iPhone: create/resume the AudioContext on the first user tap (Safari blocks audio until a gesture). Sounds must not overlap into noise — throttle repeated taps.
- Add a sound toggle (🔊 / 🔇) in the student app bar, plus a "Âm thanh" switch and volume slider on a small settings sheet. Remember the choice in localStorage. Sound is ON by default in student mode, OFF in parent mode.
```

---

## Prompt 16 — Phụ huynh: Tạo bộ từ vựng (Flashcard)

> Prompt 16–18 viết sau khi app đã chuyển sang Next.js. Bản export nằm ở `design/figma-flashcard/`, thiết kế ở `docs/superpowers/specs/2026-10-19-vocab-flashcard-design.md`. Khi code, bước "Viết từ" **ẩn hẳn từ** (khác bản export).

```
Add a NEW exercise format "Từ vựng (Flashcard)" for English vocabulary, separate from the normal question-based exercise sets. It is used for the word lists of each unit in the textbook "Oxford Discovery 2". Subject is always Tiếng Anh (green-500, icon "Languages"); add a second icon "Layers" to mark flashcard sets.

1) In the Library "+ Thêm bài tập" menu add a 4th option "Từ vựng (Flashcard)" with the Layers icon. In the library grid, flashcard sets show a "Flashcard" badge and "12 từ" instead of "12 câu", e.g. "Unit 3: Where Do Animals Live? – Từ mới".

2) Build the "Tạo bộ từ vựng" page:
- Fields: Tên bộ (e.g. "Unit 3 – Từ mới"), Sách (default "Oxford Discovery 2"), Unit (number), Chủ đề (text, e.g. "Where Do Animals Live?"), Lớp.
- A large Textarea "Dán danh sách từ (mỗi dòng một từ)" with placeholder lines: "habitat / desert / rainforest / burrow / nest / ocean". Under it a live counter "Đã nhận 12 từ" and a note that duplicates and blank lines are removed.
- Primary button with sparkle icon "AI viết giải thích".

3) Review step (same page, below or as step 2): a list of word cards, one per word:
- The word in large text (English), a small speaker button to preview pronunciation.
- An editable field "Giải thích (tiếng Anh)" with a short, child-friendly English definition written by AI, e.g. habitat — "The natural home of an animal or plant.", burrow — "A hole in the ground that an animal digs to live in."
- Buttons per card: "Viết lại" (regenerate with AI, sparkle), delete, drag handle to reorder.
- A loading skeleton state while AI is writing ("AI đang viết giải thích… 5/12").
- NO Vietnamese translation anywhere, NO pictures.
- Sticky footer: "Lưu nháp", "Lưu & sẵn sàng", secondary "Giao bài này" (opens the existing Assign sheet).
```

## Prompt 17 — Học sinh: Học & viết từ (Flashcard)

```
Build the Student screens for a "Từ vựng (Flashcard)" assignment. Full-screen focus mode like the "Làm bài" screen, playful student style, large text, big touch targets (iPad + Apple Pencil first, phone also works). Top bar: close (X) with "Lưu và thoát?", title "Unit 3 – Từ mới", and a segmented switch between two phases: "1. Học từ" and "2. Viết từ".

PHASE 1 — "Học từ" (study):
- One big flashcard in the center (green accent). Front: the English word huge (e.g. "rainforest"). Tap the card to flip (3D flip animation) → back: the English definition "A thick forest with tall trees where it rains a lot."
- Under the card, 3 pronunciation buttons that read the word aloud with the device's voice at different speeds: "🐇 Nhanh", "🐢 Chậm", "🐌 Rất chậm". The active button pulses while speaking.
- Swipe left/right or "Từ trước" / "Từ tiếp" buttons, counter "Từ 4/12", a progress dot row.
- At the end: "Con đã xem hết 12 từ! Sẵn sàng viết chưa?" with big button "Bắt đầu viết từ".

PHASE 2 — "Viết từ" (handwriting test):
- The word is HIDDEN. Show the English definition in a speech bubble, plus the same 3 speaker buttons (🐇 / 🐢 / 🐌) so the child can listen to the word.
- Below: a wide handwriting area on lined paper (like a school notebook line, 2–3 lines high) for the child to write the word with Apple Pencil or finger. Small toolbar: pen, eraser, undo, "Xóa hết".
- "Câu trước" / "Câu tiếp", counter "Từ 4/12", and a word-number grid in a Sheet showing written/not-written.
- No right/wrong feedback while writing (the parent grades later).
- Last screen: summary "Đã viết 11/12 từ – còn 1 từ chưa viết" and big "Nộp bài" button with confirm dialog → success "Đã nộp! Bố mẹ sẽ chấm sớm nhé 📮".
- Must also look fine with no internet (show the small existing offline banner).
```

## Prompt 18 — Phụ huynh: Chấm bài viết từ

```
Build the Parent grading screen for a submitted "Từ vựng (Flashcard)" attempt (opened from the "Chấm bài" queue, where it shows "Unit 3 – Từ mới · 12 từ viết tay · chờ chấm").

- A grid of rows (1 column on phone, 2 on iPad): each row shows the correct word in green ("rainforest"), its definition in small grey text, and next to it the child's HANDWRITING image (lined paper snippet, tap to zoom). Two big toggle buttons per row: "✓ Đúng" / "✗ Sai". Optional quick comment chips: "Sai chính tả", "Thiếu chữ", "Viết chưa rõ".
- Rows the child left blank are marked "Chưa viết" and default to Sai.
- Top: a button "Đánh dấu tất cả đúng" and a filter "Tất cả / Chưa chấm / Sai".
- Footer: live score "Đúng 10/12 từ · 8,3/10", "Nhận xét chung" textarea, toggle "Cho phép làm lại lần 2", primary "Hoàn tất chấm bài".
- On the Student "Kết quả" screen for this assignment, list the wrong words with the correct spelling and a speaker button so the child can practise them again.
```

---

## Đưa lên GitHub

1. Trong Figma Make, nếu có tính năng kết nối **GitHub** (tùy gói Figma): kết nối tài khoản → tạo repo mới, ví dụ `homework-hub` → push.
2. Nếu không có: dùng **Download / Export code** để tải file zip, giải nén vào một thư mục trống, rồi:
   ```bash
   git init
   git add .
   git commit -m "Figma Make export"
   git branch -M main
   git remote add origin https://github.com/<tài-khoản>/homework-hub.git
   git push -u origin main
   ```
3. Clone về máy làm việc:
   ```bash
   git clone https://github.com/<tài-khoản>/homework-hub.git C:/Sources/homework/app
   ```
   (hoặc clone thẳng vào `C:\Sources\homework` nếu thư mục đó trống)
4. Báo Claude: **"đã có code Figma, làm tiếp Giai đoạn 1"**. Claude sẽ dựa trên components/styles đó để dựng app Next.js + Supabase theo plan.
