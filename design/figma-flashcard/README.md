# Figma Make export — Flashcard từ vựng (tham chiếu thiết kế)

Bản export Figma Make (Vite) cho Prompt 16–18 trong `docs/figma-prompts.md`. **Chỉ dùng để tham khảo giao diện**, không import vào app; đã loại khỏi `tsconfig.json` và ESLint.

Màn hình mới:
- `components/pages/FlashcardBuilder.tsx` — phụ huynh tạo bộ từ vựng
- `components/take/TakeFlashcardAssignment.tsx` — học sinh học & viết từ
- `components/grading/FlashcardGrading.tsx` — phụ huynh chấm bài viết từ
- `lib/flashcards.ts` — kiểu dữ liệu & dữ liệu mẫu
