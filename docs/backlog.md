# Backlog

Ý tưởng đã thống nhất nhưng để làm sau. Khi bắt đầu một mục, chuyển nó thành spec trong `docs/superpowers/specs/`.

## Viết tay — AI hỗ trợ

Phụ thuộc: bài viết tay lưu dạng nét bút (`EssayValue.ink`, `lib/ink.ts`); ảnh PNG cho AI render bằng resvg trong `server/ai/ink-image.ts`.

- **Chuyển chữ viết tay thành văn bản.** Nút trên màn chấm bài để AI đọc ảnh bài viết thành text. Dùng để chấm dễ hơn, tìm lỗi chính tả, đếm số từ trên Reports. Đi qua `ask()` trong `src/server/ai/llm.ts`, prompt + schema thuần trong `src/lib/ai/`.
- **Nhận xét chính tả và trình bày ngay trên bài.** AI trả về các lỗi kèm vị trí (khung 0–1000 như `figure-crop`) và loại lỗi ("viết hoa đầu câu", "thiếu dấu thanh"…), vẽ đè lên bài viết (`HandwritingView`). Mở rộng `ai-grading`; AI chỉ gợi ý, phụ huynh xác nhận bằng `gradeAttempt` như hiện tại.

## Bài có nhiều câu hỏi con (kèm bài đọc)

> **Đợt 1 đã xong (2026-10-20):** chia bài trên bộ đề có sẵn (Tự chia bài, gộp/tách tay, đề chung + hình chung, điểm bài chia đều chính xác), hiển thị bài ở làm bài / chấm / kết quả / bản in, AI nhận đề chung. Spec `docs/superpowers/specs/2026-10-20-grouped-questions-design.md`. 
> **Đợt 2 đã xong (2026-10-20):** tách chỗ trống của đoạn văn thành câu con (Tách / Gộp chỗ trống, Tự chia bài tách đoạn có từ 3 chỗ trống), đoạn văn tô chỗ đang làm, kết quả và màn chấm báo đúng/sai từng ô (cả câu nhiều chỗ trống không tách). Spec `docs/superpowers/specs/2026-10-20-split-blanks-design.md`. Còn lại bên dưới: AI quét tự gom bài và nối qua trang, bài đọc (hội thoại, loa, "Đã đọc"), Reports theo bài.

**Vấn đề.** Đề thật hay có dạng "Bài 3. Đọc đoạn văn sau và trả lời: …" hoặc "Bài 2. Tính: a) … b) …". Hiện mỗi câu là một `Question` phẳng; khi quét, `lib/ai/scan.ts` tách từng ý thành câu riêng và **chép lại đoạn văn / đề chung vào prompt của từng câu**. Kết quả: đoạn văn lặp nhiều lần khi làm bài, con không thấy các ý thuộc cùng một bài, điểm và kết quả không gom theo bài.

**Đã chốt.**
- **Cấu trúc.** Một **bài** gồm phần đề chung (lời dẫn, đoạn văn/hội thoại/bài thơ, hình) và nhiều **câu con**, mỗi câu con có dạng riêng (trắc nghiệm, điền, trả lời ngắn, tự luận…), trộn dạng trong cùng bài. Câu không thuộc bài nào vẫn đứng riêng như bây giờ.
- **Đánh số.** Bài đánh "Bài 1, 2…"; câu con đánh số liên tục qua cả đề: Bài 1 có câu 1, 2; Bài 2 có câu 3, 4, 5.
- **Điểm.** Phụ huynh nhập điểm của bài; điểm chia đều chính xác cho các câu con, không làm tròn từng câu (1 điểm cho 3 câu = 1/3 mỗi câu). Chỉ làm tròn tổng: điểm đề quy về thang 10 rồi làm tròn 0,25 như hiện tại; điểm bài hiển thị làm tròn ("Bài 3 · 0,75/1"). `points` và `answers.points_awarded` đã là số thực nên không cần đổi schema; chỉ cần bỏ làm tròn 0,01 trong `proportional()` / ô chấm tay của phụ huynh đối với câu con, để tổng không lệch.
- **Chấm.** Chấm từng câu con, kể cả bài làm trên giấy: tự chấm câu khách quan như hiện tại, phụ huynh chấm câu tự luận/giấy; sai câu nào thì đánh dấu, gợi ý AI (`answers.hint`) và đáp án ở câu đó. Màn chấm và kết quả: tiêu đề bài kèm điểm tổng "Bài 3 · 2,5/3", bên dưới là từng câu con.
- **Điền chỗ trống trong đoạn văn.** Mỗi chỗ trống là một câu con (báo đúng/sai từng chỗ). Đoạn văn nằm ở đề chung, chỗ trống đánh số theo câu ("(3) ___"), câu con chỉ chứa ô trả lời cho chỗ đó.
- **Hiển thị đề chung.** Đề chung ở đầu bài, trong một khung cuộn riêng có chiều cao tối đa (đoạn văn dài cuộn bên trong khung, không đẩy vỡ form câu con), trên cả iPad và iPhone.
- **Quét đề.** Nhiều chỗ cần trả lời dùng chung một đề/đoạn văn thì gộp vào một bài; đề chung chỉ xuất hiện một lần, câu con chỉ chứa phần riêng. Bước review cho phụ huynh gộp/tách bài, kéo câu vào/ra bài.
- **Bài bị cắt qua hai trang.** Mỗi trang đang được quét riêng và song song (`SCAN_BATCH_FILES = 1`), nên trang sau không thấy đề chung của trang trước. AI đánh dấu các câu con ở đầu trang không có đề (`continues: true`, kèm nhãn bài nếu thấy, ví dụ "Bài 3"); sau khi các batch xong, một hàm thuần trong `lib/ai/` nối các câu đó vào bài cuối của trang trước (cùng nhãn, hoặc bài cuối nếu không có nhãn). Đoạn văn bị cắt giữa hai trang thì nối phần đề chung lại. Review vẫn cho sửa tay khi AI nối sai.
- **Bài đọc (làm cùng đợt).** Đề chung trình bày được dạng đoạn văn hoặc hội thoại (mỗi lượt lời một dòng, giữ tên/gạch đầu dòng người nói), Tiếng Anh và Tiếng Việt. Mỗi đoạn/lượt lời có nút loa đọc đoạn đó, dùng `lib/speech.ts` (hiện chỉ chọn giọng tiếng Anh: cần thêm giọng `vi-VN` theo môn và thông báo khi thiết bị không có giọng). Bài đọc không có câu con (chỉ để đọc/nghe) được phép và tính vào hoàn thành bài: con bấm "Đã đọc" thì xong, không có điểm. Vì bài là lớp nhóm trên các dòng `questions`, bài đọc trơn cần một dòng riêng (ví dụ dạng `doc`, 0 điểm, `isCorrect` không áp dụng); cách chấm cả đề khi chỉ có bài đọc (không có điểm) chốt trong spec.

**Hướng làm (đề xuất).** Giữ mỗi câu con là một dòng `questions` như hiện tại, để chấm (`lib/grading.ts`), `answers` theo từng câu, snapshot, analytics theo kỹ năng, sao, lượt làm lại và gói offline gần như không phải sửa. Bài chỉ là lớp nhóm:
- Thêm `group?: { id, label?, prompt, image?, layout?: "doan-van" | "hoi-thoai" }` vào câu hỏi (hoặc cột `groups jsonb` trên `exercise_sets` + `groupId` trên câu); các câu cùng `group.id` phải liền nhau theo `position`.
- Snapshot `answers.question` phải giữ cả đề chung, để kết quả cũ vẫn đúng khi bộ đề bị sửa.
- Quét/sinh đề: `aiQuestionSchema` thêm khoá nhóm + đề chung + `continues`, bỏ quy tắc "chép lại ngữ cảnh"; `toQuestion()` gom nhóm; `toTakeQuestion` giữ đề chung (không lộ đáp án).
- Chỉ giao diện gom theo bài: take, review/editor, grading, result, Reports (điểm theo bài khi cần).
- Không áp dụng cho bộ flashcard.

**Edge case (rà code 2026-10-19).** Mỗi dòng: tình huống → cách xử lý đề xuất.

*Lưu và dữ liệu*
- `question-schema.ts` dùng zod object thường, **tự bỏ key lạ** → `group` bị xoá khi `saveExerciseSet` và khi "Giải đáp án" (`ai-solve.ts:33` trả câu đã parse, client thay cả câu). Phải thêm `group` vào schema trước tiên, và client giải đáp án chỉ ghép trường đáp án/lời giải, giữ nguyên `group`.
- Hình của đề chung (`group.image`): kiểm tra đã upload, dọn hình mồ côi (`library.ts`, `figures.ts` chỉ xem `image`/`solutionImage`), ký URL (`question-images.ts`), gói offline (chỉ tải blob theo đường dẫn hình câu) đều bỏ sót → hình bị **xoá nhầm** khi lưu. Gom việc liệt kê đường dẫn hình vào một hàm dùng chung.
- Nhóm không liền nhau / mồ côi: xoá, kéo, "Gộp với câu trên" trong editor/review có thể tách bài làm hai khúc, hoặc để bài chỉ còn một câu con. Kiểm tra khi lưu: câu cùng `group.id` phải liền nhau; bài còn 1 câu con vẫn hợp lệ; bài 0 câu con chỉ hợp lệ khi là bài đọc.
- Đề chung lặp lại trên mọi câu con (nếu lưu `group` trong từng câu): sửa đề chung ở một câu phải ghi cho cả bài; snapshot từng câu chép đề chung (dữ liệu to hơn, chấp nhận được). Nếu chọn cột `groups` trên `exercise_sets` thì snapshot cần chép riêng.
- Sửa bộ đề sau khi đã giao: `withLaterAnswerKey` khớp theo id câu nên vẫn đúng; nhưng chia/gộp lại bài sau khi con đã làm thì kết quả cũ hiển thị theo nhóm lúc nộp (từ snapshot), không theo nhóm mới.
- Offline: đổi nhóm/đề chung cũng phải bump `exercise_sets.updatedAt` (hiện chỉ `saveExerciseSet` làm) để `offline_set_changed` đúng.

*Điểm*
- Chia 1/3: `proportional()` và chấm tay (`actions/grading.ts:73`) làm tròn 0,01 → 3 câu đúng = 0,99/1; bước điểm chấm tay 0,25/0,5 (`views/grading.ts:156`) không bấm được 1/3. Câu con dùng điểm chính xác: đúng hết = đúng `points`, chấm tay chọn theo phần của câu (0, ½, đủ) hoặc nhập số; thanh tổng làm tròn 0,25 như hiện tại.
- Huy hiệu 10 điểm (`badges.ts:36`, `score === 10`) và `starsFor`: sai số làm tròn không được làm mất điểm 10 → tính tổng bằng phân số hoặc làm tròn trước khi so.
- Điểm bài không chia đều được kiểu thập phân (2 điểm / 3 câu) → hiển thị "≈0,67", tooltip/ghi chú ở editor.
- Đề chỉ có bài đọc: tổng điểm 0 → `scoreOutOf10` trả 0 (con bị 0/10, không sao, không tính chuỗi ngày đúng hạn?). Cần trạng thái "Đã hoàn thành, không chấm điểm": không hiện điểm, không có sao điểm, vẫn tính chuỗi ngày, không cần phụ huynh chấm. `question-schema` đang bắt `points > 0`.
- Đề có cả bài đọc lẫn câu hỏi: bài đọc 0 điểm không ảnh hưởng tổng; "Đã đọc" chưa bấm có chặn nộp không? Đề xuất: không chặn, chỉ nhắc như câu chưa trả lời.
- Thêm/bớt câu con sau khi nhập điểm bài → chia lại tự động; câu con đã chỉnh điểm tay (nếu cho phép) thì giữ?

*Làm bài*
- Màn làm bài một câu mỗi trang ("Câu i/N", lưới 5 cột): đề chung phải hiện lại trên từng câu con của bài (khung cuộn), vị trí cuộn đoạn văn nên giữ khi chuyển câu trong cùng bài.
- Điền chỗ trống: màn hiện ẩn prompt và hiện tiêu đề cố định cho `dien-cho-trong`; khi mỗi chỗ trống là một câu con, đoạn văn (đề chung) phải hiện với chỗ trống đang làm được tô sáng, các chỗ đã điền hiện giá trị.
- Lưới tiến độ và "câu chưa làm" đếm theo câu con; bài đọc chưa bấm "Đã đọc" hiện là chưa xong. `isAnswered` coi dạng lạ là đã trả lời → phải thêm dạng `doc`.
- Làm lại (lượt 2) làm lại toàn bộ câu, không chỉ câu sai → với bài đọc, có bắt bấm "Đã đọc" lại không? Đề xuất: giữ như lượt 1.
- Đáp án chỉ lộ khi hết lượt (`answersRevealed`): đề chung không chứa đáp án nên luôn hiện; nhưng đoạn văn điền chỗ trống trong kết quả phải hiện đáp án đúng vào chỗ trống chỉ khi đã lộ.
- Nút loa: đọc đề chung tiếng Việt nhưng thiết bị không có giọng `vi-VN` → ẩn nút, hiện thông báo; đang đọc thì chuyển câu/rời trang phải `stopSpeaking()`; offline vẫn chạy (Web Speech nội bộ).
- Bài có giờ: không ảnh hưởng (nộp theo câu như cũ).

*Chấm, kết quả, báo cáo*
- Chấm tay, chấm AI và `mapPaperGrades` đánh số "Câu n" theo vị trí → phải dùng cùng cách đánh số liên tục với màn làm bài, kèm nhãn bài, để phụ huynh và AI không lệch số.
- Bài làm giấy: AI chấm giấy cần biết bài nào gồm câu nào và đề chung; trang ảnh bài làm có thể chỉ ghi "Bài 3: a… b…" chứ không ghi số câu liên tục → prompt gửi cả nhãn bài + chữ cái gốc.
- "Sai x/y câu" trong Reports (`analytics.ts:212`) và số câu trên thẻ bài tập (`ExerciseCard.tsx:112`, `OfflineApp.tsx:169`) đếm theo câu con → con số tăng so với đề giấy (10 bài thành 25 câu). Hiện "5 bài · 25 câu"?
- Bài đọc không có kỹ năng/điểm: loại khỏi analytics độ chính xác.

*AI*
- Giải đáp án (`lib/ai/solve.ts:55`), chấm tự luận/giấy (`lib/ai/grading.ts:120,131`), gợi ý câu sai (`hints.ts:47`) chỉ gửi `q.prompt` + hình câu → **mất đoạn văn** nếu nó chỉ nằm trong `group`. Mọi prompt phải ghép đề chung (+ hình đề chung) trước câu con.
- `leaksAnswer` chỉ so với `q.prompt`: đáp án có sẵn trong đoạn văn (câu hỏi đọc hiểu) sẽ bị coi là lộ và gợi ý bị lọc → nên so cả đề chung (từ có trong đoạn văn thì không tính là lộ).
- Sinh đề (`ai-generate`) có thể sinh bài đọc + câu con: cần cùng schema nhóm, hoặc tạm thời chỉ sinh câu lẻ.

*Quét đề*
- Ghép bài qua trang: `mergeScanResults` chỉ nối theo thứ tự file, metadata lấy từ batch đầu; trang 2 có thể bắt đầu bằng câu con không có đề (`continues`), hoặc bằng phần cuối đoạn văn chưa có câu hỏi, hoặc AI không nhận ra là tiếp → review phải có "Gộp vào bài trên" / "Tách thành bài riêng".
- Trang tiếp theo lặp lại nhãn bài ("Bài 3 (tiếp)") hoặc đề đánh số lại từ 1 (đề nhiều phần): ghép theo nhãn phải xét thứ tự, không ghép bài ở trang xa.
- Batch quét lỗi một trang ở giữa → không ghép xuyên qua trang thiếu.
- "Gộp với câu trên" hiện ghép prompt và giữ dạng của một câu → khác với "đưa vào bài"; cần cả hai.
- Cắt hình đang gom theo box trùng nhau (`UploadFlow.tsx:110`); các câu con chung hình nên chuyển thành hình của đề chung thay vì lặp lại.
- Đáp án/lời giải ở cuối tài liệu ("Tài liệu có sẵn lời giải") ghi theo "Bài 3: a) … b) …" → khớp theo nhãn bài + chữ cái, không theo số câu liên tục.

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
