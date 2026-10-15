# Backlog

Ý tưởng đã thống nhất nhưng để làm sau. Khi bắt đầu một mục, chuyển nó thành spec trong `docs/superpowers/specs/`.

## Viết tay — AI hỗ trợ (sau đợt nâng cấp khung viết tay)

Phụ thuộc: bài viết tay đã lưu dạng nét bút + ảnh PNG trên Storage (đợt "viết tay cho đoạn văn").

- **Chuyển chữ viết tay thành văn bản.** Nút trên màn chấm bài để AI đọc ảnh bài viết thành text. Dùng để chấm dễ hơn, tìm lỗi chính tả, đếm số từ trên Reports. Đi qua `ask()` trong `src/server/ai/llm.ts`, prompt + schema thuần trong `src/lib/ai/`.
- **Nhận xét chính tả và trình bày ngay trên bài.** AI trả về các lỗi kèm vị trí (khung 0–1000 như `figure-crop`) và loại lỗi ("viết hoa đầu câu", "thiếu dấu thanh"…), vẽ đè lên ảnh bài viết. Mở rộng `ai-grading`; AI chỉ gợi ý, phụ huynh xác nhận bằng `gradeAttempt` như hiện tại.

## Gợi ý tính năng khác (chưa chốt)

- Ôn lại câu sai (lặp lại ngắt quãng, lấy từ `answers.question`).
- Giao bài định kỳ (`assignment_templates` + cron).
- Tạo đề theo kỹ năng yếu từ Reports (dùng `ai-generate`).
- Thông báo cho phụ huynh (Web Push hoặc Telegram).
- Chuỗi ngày, huy hiệu, phần thưởng do phụ huynh đặt; chế độ luyện nhanh có giờ.
- Tiếng Anh nghe/nói (TTS, ghi âm); Tiếng Việt chính tả nghe-viết; flashcard từ vựng.
- Gắn bộ đề với bài học SGK; xuất PDF đề và báo cáo; hỏi AI về bài làm của con.
- PWA + làm bài offline; nhiều học sinh; tách năm học khi lên lớp.
