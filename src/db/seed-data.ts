/**
 * Demo library for a Grade 3 student: the 19 sets from the Figma prototype,
 * each with real questions. Used by `pnpm db:seed`.
 */
import type { Difficulty, ExerciseKind, ExerciseSetStatus, ExerciseSource, QuestionContent, SubjectId } from "@/lib/types"

type Q = QuestionContent
type Skills = string[]

const mc = (prompt: string, options: string[], correctIndex: number, skills: Skills, points = 1): Q => ({ type: "trac-nghiem", prompt, options, correctIndex, skills, points })
const tf = (prompt: string, answer: boolean, skills: Skills, points = 1): Q => ({ type: "dung-sai", prompt, answer, skills, points })
const fb = (prompt: string, answers: string[], skills: Skills, points = 1): Q => ({ type: "dien-cho-trong", prompt, answers, skills, points })
const sa = (prompt: string, answer: string, skills: Skills, points = 1): Q => ({ type: "tra-loi-ngan", prompt, answer, skills, points })
const match = (prompt: string, pairs: { left: string; right: string; picture?: string }[], skills: Skills, points = 1.5): Q => ({ type: "noi", prompt, pairs, skills, points })
const essay = (prompt: string, rubric: string, skills: Skills, points = 2): Q => ({ type: "tu-luan", prompt, rubric, skills, points })

/** Ordering question; the shown order rotates the tokens so it never starts solved. */
function ord(prompt: string, tokens: string[], skills: Skills, points = 1.5): Q {
  const shuffled = tokens.map((_, i) => (i * 3 + 2) % tokens.length)
  const unique = new Set(shuffled).size === tokens.length && shuffled.some((v, i) => v !== i)
  return { type: "sap-xep", prompt, tokens, skills, points, shuffled: unique ? shuffled : [...tokens.keys()].reverse() }
}

export interface SeedSet {
  key: string
  title: string
  subject: SubjectId
  grade: number
  topic: string
  description: string
  kind: ExerciseKind
  source: ExerciseSource
  status: ExerciseSetStatus
  estimatedMinutes: number
  difficulty: Difficulty
  /** Days before "now" the set was added to the library. */
  ageDays: number
  questions: Q[]
}

export const SEED_SETS: SeedSet[] = [
  {
    key: "bt-01", title: "Bảng nhân 6, 7", subject: "toan", grade: 3, topic: "Bảng nhân",
    description: "Ôn luyện bảng nhân 6 và 7 qua bài tập tính nhẩm và điền số.",
    kind: "luyen-tap", source: "thu-cong", status: "san-sang", estimatedMinutes: 15, difficulty: 1, ageDays: 56,
    questions: [
      mc("7 × 8 = ?", ["54", "56", "63", "48"], 1, ["Bảng nhân 7"]),
      mc("6 × 9 = ?", ["54", "56", "45", "63"], 0, ["Bảng nhân 6"]),
      fb("6 × ___ = 42", ["7"], ["Bảng nhân 6"]),
      fb("7 × 6 = ___ ; 7 × 9 = ___", ["42", "63"], ["Bảng nhân 7"]),
      tf("6 × 8 = 7 × 7", false, ["Bảng nhân 6", "Bảng nhân 7"]),
      sa("Mỗi tuần có 7 ngày. Hỏi 6 tuần có bao nhiêu ngày?", "42 ngày", ["Bảng nhân 7", "Toán có lời văn"], 2),
    ],
  },
  {
    key: "bt-02", title: "Phép chia có dư", subject: "toan", grade: 3, topic: "Phép chia có dư",
    description: "Thực hiện phép chia có dư, xác định thương và số dư.",
    kind: "chu-de", source: "tai-len", status: "san-sang", estimatedMinutes: 20, difficulty: 3, ageDays: 51,
    questions: [
      fb("17 : 5 = ___ (dư ___)", ["3", "2"], ["Phép chia có dư"]),
      fb("29 : 4 = ___ (dư ___)", ["7", "1"], ["Phép chia có dư"]),
      mc("Trong phép chia cho 6, số dư lớn nhất có thể là:", ["6", "5", "4", "7"], 1, ["Phép chia có dư"]),
      tf("38 : 7 = 5 (dư 3)", true, ["Phép chia có dư"]),
      sa("Có 31 quả cam xếp đều vào 4 đĩa. Hỏi mỗi đĩa có mấy quả và còn thừa mấy quả?", "7 quả, thừa 3 quả", ["Phép chia có dư", "Toán có lời văn"], 2),
    ],
  },
  {
    key: "bt-03", title: "Chu vi hình chữ nhật, hình vuông", subject: "toan", grade: 3, topic: "Hình học",
    description: "Tính chu vi qua hình vẽ và bài toán có lời văn.",
    kind: "chu-de", source: "tai-len", status: "san-sang", estimatedMinutes: 25, difficulty: 3, ageDays: 43,
    questions: [
      mc("Hình vuông có cạnh 5 cm. Chu vi hình vuông là:", ["10 cm", "20 cm", "25 cm", "15 cm"], 1, ["Chu vi"]),
      sa("Hình chữ nhật có chiều dài 8 cm, chiều rộng 3 cm. Tính chu vi.", "22 cm", ["Chu vi"]),
      tf("Muốn tính chu vi hình chữ nhật ta lấy chiều dài cộng chiều rộng rồi nhân với 2.", true, ["Chu vi"]),
      fb("Một hình vuông có chu vi 36 cm thì cạnh dài ___ cm.", ["9"], ["Chu vi", "Bảng chia"]),
      sa("Mảnh vườn hình chữ nhật dài 12 m, rộng 7 m. Bố rào xung quanh vườn. Hỏi hàng rào dài bao nhiêu mét?", "38 m", ["Chu vi", "Toán có lời văn"], 2),
    ],
  },
  {
    key: "bt-04", title: "Bài toán có lời văn (hai phép tính)", subject: "toan", grade: 3, topic: "Giải toán",
    description: "Đọc đề, tóm tắt và giải bài toán hai bước tính.",
    kind: "luyen-tap", source: "ai", status: "san-sang", estimatedMinutes: 30, difficulty: 4, ageDays: 35,
    questions: [
      sa("Lan có 24 nhãn vở, Hoa có nhiều hơn Lan 8 nhãn vở. Hỏi cả hai bạn có bao nhiêu nhãn vở?", "56 nhãn vở", ["Toán có lời văn"], 2),
      sa("Một cửa hàng có 96 kg gạo, đã bán 1/4 số gạo. Hỏi cửa hàng còn lại bao nhiêu ki-lô-gam gạo?", "72 kg", ["Toán có lời văn", "Một phần mấy"], 2),
      mc("Mỗi hộp có 6 cái bánh. Mẹ mua 4 hộp và đã cho bé 5 cái. Còn lại bao nhiêu cái bánh?", ["19", "24", "29", "15"], 0, ["Toán có lời văn"]),
      essay("Viết tóm tắt và lời giải: Thùng thứ nhất có 45 lít dầu, thùng thứ hai có ít hơn thùng thứ nhất 9 lít. Hỏi cả hai thùng có bao nhiêu lít dầu?", "Tóm tắt đúng; tính thùng hai 45 − 9 = 36 (lít); cả hai 45 + 36 = 81 (lít); có câu trả lời và đơn vị.", ["Toán có lời văn", "Trình bày bài giải"], 3),
    ],
  },
  {
    key: "bt-05", title: "Xem đồng hồ và tính thời gian", subject: "toan", grade: 3, topic: "Đo lường",
    description: "Đọc giờ trên đồng hồ kim, tính khoảng thời gian.",
    kind: "luyen-tap", source: "tai-len", status: "san-sang", estimatedMinutes: 15, difficulty: 2, ageDays: 30,
    questions: [
      mc("Kim ngắn chỉ số 3, kim dài chỉ số 6. Đồng hồ chỉ:", ["3 giờ 6 phút", "6 giờ 15 phút", "3 giờ 30 phút", "3 giờ 15 phút"], 2, ["Xem đồng hồ"]),
      fb("1 giờ = ___ phút", ["60"], ["Đơn vị thời gian"]),
      tf("8 giờ 45 phút còn gọi là 9 giờ kém 15 phút.", true, ["Xem đồng hồ"]),
      sa("Em bắt đầu làm bài lúc 7 giờ 10 phút và làm xong lúc 7 giờ 35 phút. Em làm bài trong bao nhiêu phút?", "25 phút", ["Tính khoảng thời gian"], 2),
    ],
  },
  {
    key: "bt-06", title: "Phép nhân trong phạm vi 1000", subject: "toan", grade: 3, topic: "Phép nhân",
    description: "Nhân số có ba chữ số với số có một chữ số, đặt tính rồi tính.",
    kind: "chu-de", source: "thu-cong", status: "san-sang", estimatedMinutes: 20, difficulty: 3, ageDays: 10,
    questions: [
      mc("125 × 4 = ?", ["400", "500", "450", "520"], 1, ["Nhân số có ba chữ số"]),
      fb("234 × 2 = ___ ; 312 × 3 = ___", ["468", "936"], ["Nhân số có ba chữ số"]),
      sa("207 × 4 = ?", "828", ["Nhân số có ba chữ số", "Nhân có nhớ"]),
      tf("152 × 3 = 456", true, ["Nhân có nhớ"]),
      sa("Mỗi hộp có 108 cái bút. Hỏi 5 hộp có bao nhiêu cái bút?", "540 cái bút", ["Toán có lời văn", "Nhân có nhớ"], 2),
      essay("Giải thích cách em đặt tính và tính 163 × 5.", "Đặt thẳng hàng; nhân từ phải sang trái; nhớ đúng sang hàng chục và hàng trăm; kết quả 815.", ["Nhân có nhớ", "Trình bày bài giải"], 2),
    ],
  },
  {
    key: "bt-07", title: "Chính tả: phân biệt l/n", subject: "tieng-viet", grade: 3, topic: "Chính tả",
    description: "Điền l hoặc n vào chỗ trống, viết lại câu cho đúng.",
    kind: "luyen-tap", source: "thu-cong", status: "san-sang", estimatedMinutes: 15, difficulty: 2, ageDays: 55,
    questions: [
      mc("Từ nào viết đúng chính tả?", ["lo lắng", "no lắng", "lo nắng", "no nắng"], 0, ["Chính tả l/n"]),
      fb("Điền l hoặc n: ___ăm học mới, em ___ên lớp 3.", ["n", "l"], ["Chính tả l/n"]),
      tf("\"Quả na\" viết đúng chính tả.", true, ["Chính tả l/n"]),
      mc("Chọn từ đúng: Trời ___ắng chang chang.", ["n", "l"], 0, ["Chính tả l/n"]),
      fb("Điền l hoặc n: hoa ___an, ___ặng nề", ["l", "n"], ["Chính tả l/n"]),
    ],
  },
  {
    key: "bt-08", title: "Đọc hiểu: Cậu bé thông minh", subject: "tieng-viet", grade: 3, topic: "Đọc hiểu",
    description: "Đọc truyện và trả lời câu hỏi về nội dung, nhân vật.",
    kind: "chu-de", source: "tai-len", status: "san-sang", estimatedMinutes: 25, difficulty: 3, ageDays: 48,
    questions: [
      mc("Nhà vua ra lệnh cho mỗi làng nộp con vật gì?", ["Gà mái đẻ trứng", "Gà trống biết đẻ trứng", "Trâu đực", "Vịt trời"], 1, ["Đọc hiểu nội dung"]),
      tf("Cậu bé đã khóc vì sợ bị vua phạt.", false, ["Đọc hiểu nội dung"]),
      mc("Cậu bé nói với vua bố cậu vừa làm gì?", ["Đi chợ", "Đẻ em bé", "Đi cày", "Ốm nặng"], 1, ["Đọc hiểu nội dung"]),
      sa("Nhà vua giao cho cậu bé việc gì ở lần thử tài thứ hai? (rèn ... thành ... )", "rèn kim thành dao", ["Đọc hiểu nội dung"]),
      essay("Vì sao cậu bé được vua khen là thông minh?", "Nêu được: cậu bé dùng chính lời nói vô lí của mình để vua thấy lệnh của vua cũng vô lí.", ["Đọc hiểu suy luận", "Viết câu trả lời"], 2),
    ],
  },
  {
    key: "bt-09", title: "Chính tả: dấu hỏi, dấu ngã", subject: "tieng-viet", grade: 3, topic: "Chính tả",
    description: "Chọn dấu hỏi hoặc dấu ngã cho các từ in đậm.",
    kind: "luyen-tap", source: "ai", status: "san-sang", estimatedMinutes: 15, difficulty: 3, ageDays: 40,
    questions: [
      mc("Từ nào viết đúng?", ["sữa chữa", "sửa chữa", "sửa chửa", "sữa chửa"], 1, ["Dấu hỏi/ngã"]),
      mc("Từ nào viết đúng?", ["vẻ tranh", "vẽ tranh"], 1, ["Dấu hỏi/ngã"]),
      fb("Điền từ đúng (nghỉ/nghĩ): Em ___ hè ở quê. Em ___ ra một cách hay.", ["nghỉ", "nghĩ"], ["Dấu hỏi/ngã"]),
      tf("\"Suy nghỉ\" viết đúng chính tả.", false, ["Dấu hỏi/ngã"]),
      fb("Điền từ đúng (mãi/mải): Em ___ chơi nên quên giờ. Bạn ấy ___ là bạn thân của em.", ["mải", "mãi"], ["Dấu hỏi/ngã"]),
    ],
  },
  {
    key: "bt-10", title: "Viết đoạn văn kể về gia đình", subject: "tieng-viet", grade: 3, topic: "Tập làm văn",
    description: "Viết đoạn văn 5–7 câu giới thiệu về gia đình em.",
    kind: "chu-de", source: "thu-cong", status: "san-sang", estimatedMinutes: 30, difficulty: 4, ageDays: 27,
    questions: [
      essay("Viết đoạn văn 5–7 câu giới thiệu về gia đình em.", "Giới thiệu được các thành viên; mỗi người có 1–2 chi tiết; nêu tình cảm của em; câu đúng ngữ pháp, có dấu chấm câu.", ["Viết đoạn văn", "Dùng dấu câu"], 10),
    ],
  },
  {
    key: "bt-11", title: "Chính tả: Mùa thu của em", subject: "tieng-viet", grade: 3, topic: "Chính tả",
    description: "Nghe – viết bài thơ Mùa thu của em và làm bài tập chính tả.",
    kind: "chu-de", source: "tai-len", status: "san-sang", estimatedMinutes: 20, difficulty: 2, ageDays: 9,
    questions: [
      fb("Mùa thu, trời trong xanh và ___ .", ["cao vời vợi"], ["Từ ngữ mùa thu", "Chính tả"]),
      mc("Chọn từ viết đúng:", ["lá vàng rơi", "lá dàng rơi", "lá vàng dơi"], 0, ["Chính tả"]),
      tf("\"Cốm\" là thức quà đặc trưng của mùa thu Hà Nội.", true, ["Từ ngữ mùa thu"]),
      ord("Sắp xếp thành câu đúng.", ["Mùa thu", "em", "cùng bạn", "rước đèn"], ["Sắp xếp câu"]),
      essay("Viết 2–3 câu tả cảnh mùa thu nơi em ở.", "Có hình ảnh mùa thu (trời, lá, gió, hoa…); câu trọn ý, viết đúng chính tả.", ["Viết câu", "Chính tả"], 2),
    ],
  },
  {
    key: "bt-12", title: "Unit 3: At school – Vocabulary", subject: "tieng-anh", grade: 3, topic: "Từ vựng",
    description: "Từ vựng về đồ dùng và hoạt động ở trường, nối từ với tranh.",
    kind: "chu-de", source: "thu-cong", status: "san-sang", estimatedMinutes: 15, difficulty: 1, ageDays: 54,
    questions: [
      match("Nối từ với nghĩa đúng.", [
        { left: "pencil", right: "bút chì", picture: "✏️" },
        { left: "ruler", right: "thước kẻ", picture: "📏" },
        { left: "eraser", right: "cục tẩy", picture: "🧽" },
      ], ["Vocabulary: School"]),
      mc("This is my ___ . (cặp sách)", ["school bag", "book", "pen", "desk"], 0, ["Vocabulary: School"]),
      fb("I write with a ___ . (bút mực)", ["pen"], ["Vocabulary: School"]),
      tf("\"Book\" nghĩa là quyển vở.", false, ["Vocabulary: School"]),
      ord("Sắp xếp thành câu đúng.", ["This", "is", "my", "classroom"], ["Grammar: this is"]),
    ],
  },
  {
    key: "bt-13", title: "Colours and numbers 1–20", subject: "tieng-anh", grade: 3, topic: "Từ vựng",
    description: "Nối từ với hình, nghe và chọn màu sắc, con số đúng.",
    kind: "luyen-tap", source: "ai", status: "san-sang", estimatedMinutes: 15, difficulty: 2, ageDays: 45,
    questions: [
      match("Nối màu với tên tiếng Anh.", [
        { left: "red", right: "màu đỏ", picture: "🟥" },
        { left: "blue", right: "màu xanh dương", picture: "🟦" },
        { left: "yellow", right: "màu vàng", picture: "🟨" },
      ], ["Vocabulary: Colours"]),
      mc("Số 13 trong tiếng Anh là:", ["thirty", "thirteen", "three", "third"], 1, ["Số đếm 11–20"]),
      mc("Số 19 trong tiếng Anh là:", ["nineteen", "ninety", "nine", "ninth"], 0, ["Số đếm 11–20"]),
      fb("twelve + three = ___ (viết bằng chữ)", ["fifteen"], ["Số đếm 11–20"]),
      tf("\"Green\" nghĩa là màu xanh lá.", true, ["Vocabulary: Colours"]),
    ],
  },
  {
    key: "bt-14", title: "This is / That is", subject: "tieng-anh", grade: 3, topic: "Ngữ pháp",
    description: "Phân biệt this/that, hoàn thành câu theo tranh.",
    kind: "luyen-tap", source: "tai-len", status: "san-sang", estimatedMinutes: 20, difficulty: 3, ageDays: 38,
    questions: [
      mc("___ is my pen. (cái bút ở gần em)", ["This", "That"], 0, ["Grammar: this/that"]),
      mc("___ is a bird. (con chim ở xa)", ["This", "That"], 1, ["Grammar: this/that"]),
      fb("Is ___ your book? – Yes, it is. (ở gần)", ["this"], ["Grammar: this/that"]),
      tf("\"That is a apple.\" là câu đúng.", false, ["Grammar: to be", "Grammar: a/an"]),
      ord("Sắp xếp thành câu đúng.", ["That", "is", "my", "school"], ["Grammar: this/that"]),
    ],
  },
  {
    key: "bt-15", title: "Unit 5: My family", subject: "tieng-anh", grade: 3, topic: "Từ vựng",
    description: "Từ vựng về các thành viên trong gia đình, nghe và nối tranh.",
    kind: "chu-de", source: "thu-cong", status: "san-sang", estimatedMinutes: 20, difficulty: 2, ageDays: 8,
    questions: [
      match("Nối từ tiếng Anh với nghĩa đúng.", [
        { left: "father", right: "bố", picture: "👨" },
        { left: "mother", right: "mẹ", picture: "👩" },
        { left: "sister", right: "chị/em gái", picture: "👧" },
      ], ["Vocabulary: Family"]),
      mc("Ông trong tiếng Anh là:", ["grandmother", "grandfather", "brother", "uncle"], 1, ["Vocabulary: Family"]),
      fb("This is my ___ . (anh/em trai)", ["brother"], ["Vocabulary: Family"]),
      tf("\"Who's that?\" dùng để hỏi \"Đó là ai?\".", true, ["Grammar: Who's that"]),
      ord("Sắp xếp thành câu đúng.", ["She", "is", "my", "mother"], ["Grammar: to be"]),
      essay("Write 2–3 sentences about your family. (Viết 2–3 câu về gia đình em bằng tiếng Anh.)", "Dùng được This is my… / He is… / She is…; từ vựng gia đình đúng.", ["Writing: Family"], 2),
    ],
  },
  {
    key: "bt-16", title: "Đề kiểm tra giữa kỳ I – Toán 3", subject: "toan", grade: 3, topic: "Kiểm tra",
    description: "Đề 40 phút gồm trắc nghiệm và tự luận, bám sát chương trình học kỳ I.",
    kind: "de-thi", source: "tai-len", status: "san-sang", estimatedMinutes: 40, difficulty: 4, ageDays: 5,
    questions: [
      mc("Số liền sau của 499 là:", ["498", "500", "490", "509"], 1, ["Đọc, viết số"]),
      mc("8 × 6 = ?", ["42", "48", "54", "56"], 1, ["Bảng nhân 8"]),
      tf("Số 450 đọc là: Bốn trăm năm mươi.", true, ["Đọc, viết số"]),
      fb("56 : 7 = ___ ; 45 : 5 = ___", ["8", "9"], ["Bảng chia"]),
      sa("1/3 của 27 kg là bao nhiêu ki-lô-gam?", "9 kg", ["Một phần mấy"]),
      sa("Hình vuông cạnh 6 cm có chu vi bao nhiêu xăng-ti-mét?", "24 cm", ["Chu vi"]),
      essay("Một đoàn xe có 4 xe, mỗi xe chở 125 bao gạo. Đoàn xe đã chuyển xong 286 bao. Hỏi còn bao nhiêu bao gạo chưa chuyển? (Trình bày bài giải)", "4 × 125 = 500 (bao); 500 − 286 = 214 (bao); có lời giải và đáp số.", ["Toán có lời văn", "Trình bày bài giải"], 3),
    ],
  },
  {
    key: "bt-17", title: "Luyện từ và câu: Từ chỉ sự vật", subject: "tieng-viet", grade: 3, topic: "Luyện từ và câu",
    description: "Tìm và phân loại từ chỉ sự vật, đặt câu với từ cho sẵn.",
    kind: "chu-de", source: "ai", status: "nhap", estimatedMinutes: 20, difficulty: 2, ageDays: 2,
    questions: [
      mc("Từ nào là từ chỉ sự vật?", ["chạy", "cái bàn", "xinh đẹp", "nhanh"], 1, ["Từ chỉ sự vật"]),
      tf("\"Học sinh\" là từ chỉ sự vật (chỉ người).", true, ["Từ chỉ sự vật"]),
      fb("Tìm từ chỉ sự vật trong câu: Chú mèo nằm trên ___ . (ghế/ngồi)", ["ghế"], ["Từ chỉ sự vật"]),
      essay("Đặt một câu có từ chỉ sự vật \"cây bàng\".", "Câu trọn ý, có chủ ngữ – vị ngữ, dùng đúng từ \"cây bàng\".", ["Đặt câu"], 2),
    ],
  },
  {
    key: "bt-18", title: "Phân số và hình vẽ", subject: "toan", grade: 3, topic: "Phân số",
    description: "Cộng phân số đơn giản và đọc hình vẽ.",
    kind: "luyen-tap", source: "thu-cong", status: "san-sang", estimatedMinutes: 10, difficulty: 2, ageDays: 1,
    questions: [
      { ...sa("Tính: $\\frac{1}{2} + \\frac{1}{4} = ?$", "\\frac{3}{4}", ["Phân số"]), math: true } as Q,
      mc("Hình bên có mấy hình vuông?", ["3", "4", "5", "6"], 1, ["Hình học"]),
    ],
  },
  {
    key: "bt-19", title: "Ôn tập: Số có năm chữ số", subject: "toan", grade: 4, topic: "Số học",
    description: "Chuẩn bị lên lớp 4: đọc, viết và so sánh số có năm chữ số.",
    kind: "chu-de", source: "thu-cong", status: "nhap", estimatedMinutes: 25, difficulty: 3, ageDays: 1,
    questions: [
      mc("Số 45 302 đọc là:", ["Bốn lăm nghìn ba trăm linh hai", "Bốn mươi lăm nghìn ba trăm linh hai", "Bốn mươi lăm nghìn ba mươi hai"], 1, ["Đọc, viết số"]),
      fb("Số gồm 3 chục nghìn, 2 nghìn, 5 trăm viết là ___ .", ["32500"], ["Cấu tạo số"]),
      tf("67 890 > 67 980", false, ["So sánh số"]),
      sa("Số lớn nhất có năm chữ số là số nào?", "99999", ["Cấu tạo số"]),
    ],
  },
]

/** Demo files shown on uploaded sets (external images, no Storage object). */
export const DEMO_WORKSHEET_URL =
  "https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=480&h=640"
