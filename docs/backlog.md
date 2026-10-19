# Backlog

Ý tưởng đã thống nhất nhưng để làm sau. Khi bắt đầu một mục, chuyển nó thành spec trong `docs/superpowers/specs/`.

## Viết tay — AI hỗ trợ

Phụ thuộc: bài viết tay lưu dạng nét bút (`EssayValue.ink`, `lib/ink.ts`); ảnh PNG cho AI render bằng resvg trong `server/ai/ink-image.ts`.

- **Chuyển chữ viết tay thành văn bản.** Nút trên màn chấm bài để AI đọc ảnh bài viết thành text. Dùng để chấm dễ hơn, tìm lỗi chính tả, đếm số từ trên Reports. Đi qua `ask()` trong `src/server/ai/llm.ts`, prompt + schema thuần trong `src/lib/ai/`.
- **Nhận xét chính tả và trình bày ngay trên bài.** AI trả về các lỗi kèm vị trí (khung 0–1000 như `figure-crop`) và loại lỗi ("viết hoa đầu câu", "thiếu dấu thanh"…), vẽ đè lên bài viết (`HandwritingView`). Mở rộng `ai-grading`; AI chỉ gợi ý, phụ huynh xác nhận bằng `gradeAttempt` như hiện tại.

## Bài có nhiều câu hỏi con

**Vấn đề.** Đề thật hay có dạng "Bài 3. Đọc đoạn văn sau và trả lời: a) … b) … c) …" hoặc "Bài 2. Tính: a) … b) …". Hiện mỗi câu là một `Question` phẳng; khi quét, `lib/ai/scan.ts` tách từng ý thành câu riêng và **chép lại đoạn văn / đề chung vào prompt của từng câu**. Kết quả: đoạn văn lặp nhiều lần khi làm bài, con không thấy các ý thuộc cùng một bài, điểm và kết quả không gom theo bài.

**Mong muốn.**
- Một **bài** gồm phần đề chung (lời dẫn, đoạn văn/hội thoại/bài thơ, hình) và nhiều **câu con** (a, b, c…), mỗi câu con có dạng riêng (trắc nghiệm, điền, trả lời ngắn, tự luận…), được trộn dạng trong cùng bài.
- Khi quét: nếu nhiều chỗ cần trả lời dùng chung một đề/đoạn văn thì gộp vào một bài, đề chung chỉ xuất hiện một lần, câu con chỉ chứa phần riêng. Bước review cho phụ huynh gộp/tách bài, kéo câu vào/ra bài.
- Điểm của bài = tổng điểm các câu con (không nhập điểm bài riêng). Thang 10 của cả đề không đổi.
- Chấm từng câu con: tự chấm câu khách quan như hiện tại, phụ huynh chấm câu tự luận; sai câu nào thì đánh dấu, gợi ý AI (`answers.hint`) và đáp án ở câu đó.
- Màn làm bài: đề chung hiện ở đầu bài (đoạn văn dài thì cuộn được/ghim khi trả lời các câu con), câu con đánh "a, b, c". Màn chấm và kết quả: tiêu đề bài kèm điểm tổng "Bài 3 · 2,5/3", bên dưới là từng câu con.

**Hướng làm (đề xuất).** Giữ mỗi câu con là một dòng `questions` như hiện tại, để chấm (`lib/grading.ts`), `answers` theo từng câu, snapshot, analytics theo kỹ năng, sao, lượt làm lại và gói offline gần như không phải sửa. Bài chỉ là lớp nhóm:
- Thêm `group?: { id, label?, prompt, image? }` vào câu hỏi (hoặc cột `groups jsonb` trên `exercise_sets` + `groupId` trên câu); các câu cùng `group.id` phải liền nhau theo `position`.
- Snapshot `answers.question` phải giữ cả đề chung, để kết quả cũ vẫn đúng khi bộ đề bị sửa.
- Quét/sinh đề: `aiQuestionSchema` thêm khoá nhóm + đề chung, bỏ quy tắc "chép lại ngữ cảnh"; `toQuestion()` gom nhóm; `toTakeQuestion` giữ đề chung (không lộ đáp án).
- Chỉ giao diện gom theo bài: take, review/editor, grading, result, Reports (điểm theo bài khi cần).
- Không áp dụng cho bộ flashcard.

**Cần chốt khi viết spec.**
- Đánh số: "Bài 1, 2…" cho bài và câu lẻ, "a, b, c" cho câu con? Câu không thuộc bài nào vẫn đứng riêng như bây giờ.
- Phụ huynh nhập điểm từng câu con, hay nhập điểm bài rồi chia đều (thang 0,25 có thể không chia hết, ví dụ 1 điểm cho 3 câu)?
- Câu `dien-cho-trong` nhiều chỗ trống đã cho điểm theo từng chỗ: một đoạn văn điền nhiều từ vẫn là một câu, hay mỗi chỗ trống thành câu con để báo đúng/sai từng chỗ?
- Bài làm trên giấy (paper): chấm theo bài hay theo câu con?
- Đoạn văn rất dài trên iPhone: ghim đề trên đầu, hay nút "Xem đoạn văn"? (gần với mục "Bài đọc" bên dưới).

## Gợi ý tính năng khác (chưa chốt)

- Ôn lại câu sai (lặp lại ngắt quãng, lấy từ `answers.question`).
- Giao bài định kỳ (`assignment_templates` + cron).
- Tạo đề theo kỹ năng yếu từ Reports (dùng `ai-generate`).
- Thông báo cho phụ huynh (Web Push hoặc Telegram).
- Chế độ luyện nhanh (không giao bài, làm ngay).
- Tiếng Anh nghe/nói (TTS, ghi âm); Tiếng Việt chính tả nghe-viết (có thể dùng lại `lib/speech.ts` và khung viết tay dải của flashcard).
- Bài đọc (Tiếng Anh + Tiếng Việt): trình bày đoạn văn hoặc đoạn hội thoại, cuộn dài; đọc từng đoạn bằng nút loa.
- Gắn bộ đề với bài học SGK; xuất PDF đề và báo cáo; hỏi AI về bài làm của con.

## Đã xong

- Toán và hình vẽ (LaTeX, MathLive, cắt hình): `specs/2026-10-13-math-and-figures-design.md`.
- Viết tay nhiều trang: `specs/2026-10-15-handwriting-pages-design.md`.
- Sao, chuỗi ngày, huy hiệu, phần thưởng: `specs/2026-10-15-stars-badges-rewards-design.md`.
- Nhiều học sinh, năm học, lên lớp, khoá tài khoản: `specs/2026-10-15-students-school-years-design.md`.
- Bài có giờ: `specs/2026-10-15-timed-assignments-design.md`.
- PWA + làm bài offline: `specs/2026-10-17-pwa-offline-design.md`.
- Flashcard từ vựng: `specs/2026-10-19-vocab-flashcard-design.md`.
