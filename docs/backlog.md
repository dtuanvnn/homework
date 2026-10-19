# Backlog

Ý tưởng đã thống nhất nhưng để làm sau. Khi bắt đầu một mục, chuyển nó thành spec trong `docs/superpowers/specs/`.

## Viết tay — AI hỗ trợ

Phụ thuộc: bài viết tay lưu dạng nét bút (`EssayValue.ink`, `lib/ink.ts`); ảnh PNG cho AI render bằng resvg trong `server/ai/ink-image.ts`.

- **Chuyển chữ viết tay thành văn bản.** Nút trên màn chấm bài để AI đọc ảnh bài viết thành text. Dùng để chấm dễ hơn, tìm lỗi chính tả, đếm số từ trên Reports. Đi qua `ask()` trong `src/server/ai/llm.ts`, prompt + schema thuần trong `src/lib/ai/`.
- **Nhận xét chính tả và trình bày ngay trên bài.** AI trả về các lỗi kèm vị trí (khung 0–1000 như `figure-crop`) và loại lỗi ("viết hoa đầu câu", "thiếu dấu thanh"…), vẽ đè lên bài viết (`HandwritingView`). Mở rộng `ai-grading`; AI chỉ gợi ý, phụ huynh xác nhận bằng `gradeAttempt` như hiện tại.

## Bài có nhiều câu hỏi con (kèm bài đọc)

**Vấn đề.** Đề thật hay có dạng "Bài 3. Đọc đoạn văn sau và trả lời: …" hoặc "Bài 2. Tính: a) … b) …". Hiện mỗi câu là một `Question` phẳng; khi quét, `lib/ai/scan.ts` tách từng ý thành câu riêng và **chép lại đoạn văn / đề chung vào prompt của từng câu**. Kết quả: đoạn văn lặp nhiều lần khi làm bài, con không thấy các ý thuộc cùng một bài, điểm và kết quả không gom theo bài.

**Đã chốt.**
- **Cấu trúc.** Một **bài** gồm phần đề chung (lời dẫn, đoạn văn/hội thoại/bài thơ, hình) và nhiều **câu con**, mỗi câu con có dạng riêng (trắc nghiệm, điền, trả lời ngắn, tự luận…), trộn dạng trong cùng bài. Câu không thuộc bài nào vẫn đứng riêng như bây giờ.
- **Đánh số.** Bài đánh "Bài 1, 2…"; câu con đánh số liên tục qua cả đề: Bài 1 có câu 1, 2; Bài 2 có câu 3, 4, 5.
- **Điểm.** Phụ huynh nhập điểm của bài; điểm chia đều cho các câu con. Thang 10 của cả đề không đổi.
- **Chấm.** Chấm từng câu con, kể cả bài làm trên giấy: tự chấm câu khách quan như hiện tại, phụ huynh chấm câu tự luận/giấy; sai câu nào thì đánh dấu, gợi ý AI (`answers.hint`) và đáp án ở câu đó. Màn chấm và kết quả: tiêu đề bài kèm điểm tổng "Bài 3 · 2,5/3", bên dưới là từng câu con.
- **Điền chỗ trống trong đoạn văn.** Mỗi chỗ trống là một câu con (báo đúng/sai từng chỗ). Đoạn văn nằm ở đề chung, chỗ trống đánh số theo câu ("(3) ___"), câu con chỉ chứa ô trả lời cho chỗ đó.
- **Hiển thị đề chung.** Đề chung ở đầu bài, trong một khung cuộn riêng có chiều cao tối đa (đoạn văn dài cuộn bên trong khung, không đẩy vỡ form câu con), trên cả iPad và iPhone.
- **Quét đề.** Nhiều chỗ cần trả lời dùng chung một đề/đoạn văn thì gộp vào một bài; đề chung chỉ xuất hiện một lần, câu con chỉ chứa phần riêng. Bước review cho phụ huynh gộp/tách bài, kéo câu vào/ra bài.
- **Bài bị cắt qua hai trang.** Mỗi trang đang được quét riêng và song song (`SCAN_BATCH_FILES = 1`), nên trang sau không thấy đề chung của trang trước. AI đánh dấu các câu con ở đầu trang không có đề (`continues: true`, kèm nhãn bài nếu thấy, ví dụ "Bài 3"); sau khi các batch xong, một hàm thuần trong `lib/ai/` nối các câu đó vào bài cuối của trang trước (cùng nhãn, hoặc bài cuối nếu không có nhãn). Đoạn văn bị cắt giữa hai trang thì nối phần đề chung lại. Review vẫn cho sửa tay khi AI nối sai.
- **Bài đọc (làm cùng đợt).** Đề chung trình bày được dạng đoạn văn hoặc hội thoại (mỗi lượt lời một dòng, giữ tên/gạch đầu dòng người nói), Tiếng Anh và Tiếng Việt. Mỗi đoạn/lượt lời có nút loa đọc đoạn đó, dùng `lib/speech.ts` (hiện chỉ chọn giọng tiếng Anh: cần thêm giọng `vi-VN` theo môn và thông báo khi thiết bị không có giọng).

**Hướng làm (đề xuất).** Giữ mỗi câu con là một dòng `questions` như hiện tại, để chấm (`lib/grading.ts`), `answers` theo từng câu, snapshot, analytics theo kỹ năng, sao, lượt làm lại và gói offline gần như không phải sửa. Bài chỉ là lớp nhóm:
- Thêm `group?: { id, label?, prompt, image?, layout?: "doan-van" | "hoi-thoai" }` vào câu hỏi (hoặc cột `groups jsonb` trên `exercise_sets` + `groupId` trên câu); các câu cùng `group.id` phải liền nhau theo `position`.
- Snapshot `answers.question` phải giữ cả đề chung, để kết quả cũ vẫn đúng khi bộ đề bị sửa.
- Quét/sinh đề: `aiQuestionSchema` thêm khoá nhóm + đề chung + `continues`, bỏ quy tắc "chép lại ngữ cảnh"; `toQuestion()` gom nhóm; `toTakeQuestion` giữ đề chung (không lộ đáp án).
- Chỉ giao diện gom theo bài: take, review/editor, grading, result, Reports (điểm theo bài khi cần).
- Không áp dụng cho bộ flashcard.

**Còn mở khi viết spec.**
- Chia đều trên thang 0,25 có thể không chia hết (1 điểm cho 3 câu). Đề xuất: chia theo bước 0,25, phần dư dồn cho các câu đầu (0,5 / 0,25 / 0,25), editor hiện điểm từng câu; hay cho phép điểm lẻ (0,33) miễn tổng bài đúng?
- Bài đọc không có câu con (chỉ để đọc/nghe) có được không, và có tính là hoàn thành bài không?

## Gợi ý tính năng khác (chưa chốt)

- Ôn lại câu sai (lặp lại ngắt quãng, lấy từ `answers.question`).
- Giao bài định kỳ (`assignment_templates` + cron).
- Tạo đề theo kỹ năng yếu từ Reports (dùng `ai-generate`).
- Thông báo cho phụ huynh (Web Push hoặc Telegram).
- Chế độ luyện nhanh (không giao bài, làm ngay).
- Tiếng Anh nghe/nói (TTS, ghi âm); Tiếng Việt chính tả nghe-viết (có thể dùng lại `lib/speech.ts` và khung viết tay dải của flashcard).
- Gắn bộ đề với bài học SGK; xuất PDF đề và báo cáo; hỏi AI về bài làm của con.

## Đã xong

- Toán và hình vẽ (LaTeX, MathLive, cắt hình): `specs/2026-10-13-math-and-figures-design.md`.
- Viết tay nhiều trang: `specs/2026-10-15-handwriting-pages-design.md`.
- Sao, chuỗi ngày, huy hiệu, phần thưởng: `specs/2026-10-15-stars-badges-rewards-design.md`.
- Nhiều học sinh, năm học, lên lớp, khoá tài khoản: `specs/2026-10-15-students-school-years-design.md`.
- Bài có giờ: `specs/2026-10-15-timed-assignments-design.md`.
- PWA + làm bài offline: `specs/2026-10-17-pwa-offline-design.md`.
- Flashcard từ vựng: `specs/2026-10-19-vocab-flashcard-design.md`.
