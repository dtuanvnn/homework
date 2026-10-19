# Backlog

Ý tưởng đã thống nhất nhưng để làm sau. Khi bắt đầu một mục, chuyển nó thành spec trong `docs/superpowers/specs/`.

## Viết tay — AI hỗ trợ

Phụ thuộc: bài viết tay lưu dạng nét bút (`EssayValue.ink`, `lib/ink.ts`); ảnh PNG cho AI render bằng resvg trong `server/ai/ink-image.ts`.

- **Chuyển chữ viết tay thành văn bản.** Nút trên màn chấm bài để AI đọc ảnh bài viết thành text. Dùng để chấm dễ hơn, tìm lỗi chính tả, đếm số từ trên Reports. Đi qua `ask()` trong `src/server/ai/llm.ts`, prompt + schema thuần trong `src/lib/ai/`.
- **Nhận xét chính tả và trình bày ngay trên bài.** AI trả về các lỗi kèm vị trí (khung 0–1000 như `figure-crop`) và loại lỗi ("viết hoa đầu câu", "thiếu dấu thanh"…), vẽ đè lên bài viết (`HandwritingView`). Mở rộng `ai-grading`; AI chỉ gợi ý, phụ huynh xác nhận bằng `gradeAttempt` như hiện tại.

## Gợi ý tính năng khác (chưa chốt)

- Ôn lại câu sai (lặp lại ngắt quãng, lấy từ `answers.question`).
- Giao bài định kỳ (`assignment_templates` + cron).
- Tạo đề theo kỹ năng yếu từ Reports (dùng `ai-generate`).
- Thông báo cho phụ huynh (Web Push hoặc Telegram).
- Chế độ luyện nhanh (không giao bài, làm ngay).
- Tiếng Anh nghe/nói (TTS, ghi âm); Tiếng Việt chính tả nghe-viết (có thể dùng lại `lib/speech.ts` và khung viết tay dải của flashcard).
- Bài đọc (Tiếng Anh + Tiếng Việt): trình bày đoạn văn hoặc đoạn hội thoại, cuộn dài; đọc từng đoạn bằng nút loa.
- Gắn bộ đề với bài học SGK; xuất PDF đề và báo cáo; hỏi AI về bài làm của con.

- Format bài đọc (tiếng anh + tiếng việt) với scroll, trình bày đoạn văn, hoặc đoạn hội thoại. Có thể hỗ trợ đọc từng đoạn, với button loa.

- Toán và hình vẽ (LaTeX, MathLive, cắt hình): `specs/2026-10-13-math-and-figures-design.md`.
- Viết tay nhiều trang: `specs/2026-10-15-handwriting-pages-design.md`.
- Sao, chuỗi ngày, huy hiệu, phần thưởng: `specs/2026-10-15-stars-badges-rewards-design.md`.
- Nhiều học sinh, năm học, lên lớp, khoá tài khoản: `specs/2026-10-15-students-school-years-design.md`.
- Bài có giờ: `specs/2026-10-15-timed-assignments-design.md`.
- PWA + làm bài offline: `specs/2026-10-17-pwa-offline-design.md`.
- Flashcard từ vựng: `specs/2026-10-19-vocab-flashcard-design.md`.
