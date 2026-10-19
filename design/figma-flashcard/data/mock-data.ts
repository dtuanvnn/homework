import { addDays, startOfWeek } from '@/lib/dates'
import { UNIT_3_SAMPLE_WORDS, generateChildFriendlyDefinition } from '@/lib/flashcards'
import type { Assignment, AssignmentStatus, Attachment, Attempt, ExerciseSet, FlashcardItem, Question, SkillInsight, Student } from '@/lib/types'

function atTime(d: Date, hours: number, minutes = 0): Date {
  const copy = new Date(d)
  copy.setHours(hours, minutes, 0, 0)
  return copy
}

/**
 * Mock data is anchored to a fixed demo day (Thursday) so the week always has
 * history behind it and the dashboard figures stay consistent.
 */
export const TODAY = new Date(2026, 9, 15)
/** Monday of the current week. */
export const WEEK_START = startOfWeek(TODAY)

/** Date in week `weekOffset` (0 = this week, -1 = last week…) on `day` (0 = Monday). */
function weekDay(weekOffset: number, day: number): Date {
  return addDays(WEEK_START, weekOffset * 7 + day)
}

/* ---------- Student ---------- */

export const student: Student = {
  id: 'hs-01',
  name: 'Minh An',
  grade: 3,
  avatarEmoji: '🦊',
  totalStars: 0, // filled in below from attempts
}

/* ---------- Exercise library (19 sets) ---------- */

export const exerciseSets: ExerciseSet[] = [
  {
    id: 'bt-fc-01',
    title: 'Unit 3: Where Do Animals Live? – Từ mới',
    subject: 'tieng-anh',
    grade: 3,
    topic: 'Where Do Animals Live?',
    description: 'Oxford Discovery 2 · Unit 3 · Bộ thẻ từ vựng về môi trường sống của các loài động vật.',
    kind: 'chu-de',
    source: 'ai',
    status: 'san-sang',
    questionCount: 12,
    estimatedMinutes: 10,
    difficulty: 2,
    timesAssigned: 2,
    createdAt: '2026-10-14',
    format: 'flashcard',
    book: 'Oxford Discovery 2',
    unit: 3,
  },
  { id: 'bt-01', title: 'Bảng nhân 6, 7', subject: 'toan', grade: 3, topic: 'Bảng nhân', description: 'Ôn luyện bảng nhân 6 và 7 qua bài tập tính nhẩm và điền số.', kind: 'luyen-tap', source: 'thu-cong', status: 'san-sang', questionCount: 20, estimatedMinutes: 15, difficulty: 1, timesAssigned: 3, createdAt: '2026-08-20' },
  { id: 'bt-02', title: 'Phép chia có dư', subject: 'toan', grade: 3, topic: 'Phép chia có dư', description: 'Thực hiện phép chia có dư, xác định thương và số dư.', kind: 'chu-de', source: 'tai-len', status: 'san-sang', questionCount: 12, estimatedMinutes: 20, difficulty: 3, timesAssigned: 2, createdAt: '2026-08-25' },
  { id: 'bt-03', title: 'Chu vi hình chữ nhật, hình vuông', subject: 'toan', grade: 3, topic: 'Hình học', description: 'Tính chu vi qua hình vẽ và bài toán có lời văn.', kind: 'chu-de', source: 'tai-len', status: 'san-sang', questionCount: 10, estimatedMinutes: 25, difficulty: 3, timesAssigned: 2, createdAt: '2026-09-02' },
  { id: 'bt-04', title: 'Bài toán có lời văn (hai phép tính)', subject: 'toan', grade: 3, topic: 'Giải toán', description: 'Đọc đề, tóm tắt và giải bài toán hai bước tính.', kind: 'luyen-tap', source: 'ai', status: 'san-sang', questionCount: 6, estimatedMinutes: 30, difficulty: 4, timesAssigned: 1, createdAt: '2026-09-10' },
  { id: 'bt-05', title: 'Xem đồng hồ và tính thời gian', subject: 'toan', grade: 3, topic: 'Đo lường', description: 'Đọc giờ trên đồng hồ kim, tính khoảng thời gian.', kind: 'luyen-tap', source: 'tai-len', status: 'san-sang', questionCount: 15, estimatedMinutes: 15, difficulty: 2, timesAssigned: 2, createdAt: '2026-09-15' },
  { id: 'bt-06', title: 'Phép nhân trong phạm vi 1000', subject: 'toan', grade: 3, topic: 'Phép nhân', description: 'Nhân số có ba chữ số với số có một chữ số, đặt tính rồi tính.', kind: 'chu-de', source: 'thu-cong', status: 'san-sang', questionCount: 16, estimatedMinutes: 20, difficulty: 3, timesAssigned: 1, createdAt: '2026-10-05' },
  { id: 'bt-07', title: 'Chính tả: phân biệt l/n', subject: 'tieng-viet', grade: 3, topic: 'Chính tả', description: 'Điền l hoặc n vào chỗ trống, viết lại câu cho đúng.', kind: 'luyen-tap', source: 'thu-cong', status: 'san-sang', questionCount: 15, estimatedMinutes: 15, difficulty: 2, timesAssigned: 3, createdAt: '2026-08-21' },
  { id: 'bt-08', title: 'Đọc hiểu: Cậu bé thông minh', subject: 'tieng-viet', grade: 3, topic: 'Đọc hiểu', description: 'Đọc truyện và trả lời câu hỏi về nội dung, nhân vật.', kind: 'chu-de', source: 'tai-len', status: 'san-sang', questionCount: 8, estimatedMinutes: 25, difficulty: 3, timesAssigned: 2, createdAt: '2026-08-28' },
  { id: 'bt-09', title: 'Chính tả: dấu hỏi, dấu ngã', subject: 'tieng-viet', grade: 3, topic: 'Chính tả', description: 'Chọn dấu hỏi hoặc dấu ngã cho các từ in đậm.', kind: 'luyen-tap', source: 'ai', status: 'san-sang', questionCount: 16, estimatedMinutes: 15, difficulty: 3, timesAssigned: 1, createdAt: '2026-09-05' },
  { id: 'bt-10', title: 'Viết đoạn văn kể về gia đình', subject: 'tieng-viet', grade: 3, topic: 'Tập làm văn', description: 'Viết đoạn văn 5–7 câu giới thiệu về gia đình em.', kind: 'chu-de', source: 'thu-cong', status: 'san-sang', questionCount: 1, estimatedMinutes: 30, difficulty: 4, timesAssigned: 1, createdAt: '2026-09-18' },
  { id: 'bt-11', title: 'Chính tả: Mùa thu của em', subject: 'tieng-viet', grade: 3, topic: 'Chính tả', description: 'Nghe – viết bài thơ Mùa thu của em và làm bài tập chính tả.', kind: 'chu-de', source: 'tai-len', status: 'san-sang', questionCount: 10, estimatedMinutes: 20, difficulty: 2, timesAssigned: 1, createdAt: '2026-10-06' },
  { id: 'bt-12', title: 'Unit 3: At school – Vocabulary', subject: 'tieng-anh', grade: 3, topic: 'Từ vựng', description: 'Từ vựng về đồ dùng và hoạt động ở trường, nối từ với tranh.', kind: 'chu-de', source: 'thu-cong', status: 'san-sang', questionCount: 14, estimatedMinutes: 15, difficulty: 1, timesAssigned: 3, createdAt: '2026-08-22' },
  { id: 'bt-13', title: 'Colours and numbers 1–20', subject: 'tieng-anh', grade: 3, topic: 'Từ vựng', description: 'Nối từ với hình, nghe và chọn màu sắc, con số đúng.', kind: 'luyen-tap', source: 'ai', status: 'san-sang', questionCount: 20, estimatedMinutes: 15, difficulty: 2, timesAssigned: 2, createdAt: '2026-09-01' },
  { id: 'bt-14', title: 'This is / That is', subject: 'tieng-anh', grade: 3, topic: 'Ngữ pháp', description: 'Phân biệt this/that, hoàn thành câu theo tranh.', kind: 'luyen-tap', source: 'tai-len', status: 'san-sang', questionCount: 12, estimatedMinutes: 20, difficulty: 3, timesAssigned: 2, createdAt: '2026-09-08' },
  { id: 'bt-15', title: 'Unit 5: My family', subject: 'tieng-anh', grade: 3, topic: 'Từ vựng', description: 'Từ vựng về các thành viên trong gia đình, nghe và nối tranh.', kind: 'chu-de', source: 'thu-cong', status: 'san-sang', questionCount: 15, estimatedMinutes: 20, difficulty: 2, timesAssigned: 1, createdAt: '2026-10-07' },
  { id: 'bt-16', title: 'Đề kiểm tra giữa kỳ I – Toán 3', subject: 'toan', grade: 3, topic: 'Kiểm tra', description: 'Đề 40 phút gồm trắc nghiệm và tự luận, bám sát chương trình học kỳ I.', kind: 'de-thi', source: 'tai-len', status: 'san-sang', questionCount: 12, estimatedMinutes: 40, difficulty: 4, timesAssigned: 0, createdAt: '2026-10-10' },
  { id: 'bt-17', title: 'Luyện từ và câu: Từ chỉ sự vật', subject: 'tieng-viet', grade: 3, topic: 'Luyện từ và câu', description: 'Tìm và phân loại từ chỉ sự vật, đặt câu với từ cho sẵn.', kind: 'chu-de', source: 'ai', status: 'nhap', questionCount: 12, estimatedMinutes: 20, difficulty: 2, timesAssigned: 0, createdAt: '2026-10-13' },
  { id: 'bt-18', title: 'Đề kiểm tra giữa kỳ I – Tiếng Anh 3', subject: 'tieng-anh', grade: 3, topic: 'Kiểm tra', description: 'Đề 35 phút: nghe, đọc hiểu và từ vựng Unit 1–5.', kind: 'de-thi', source: 'ai', status: 'nhap', questionCount: 20, estimatedMinutes: 35, difficulty: 3, timesAssigned: 0, createdAt: '2026-10-14' },
  { id: 'bt-19', title: 'Ôn tập: Số có năm chữ số', subject: 'toan', grade: 4, topic: 'Số học', description: 'Chuẩn bị lên lớp 4: đọc, viết và so sánh số có năm chữ số.', kind: 'chu-de', source: 'thu-cong', status: 'nhap', questionCount: 14, estimatedMinutes: 25, difficulty: 3, timesAssigned: 0, createdAt: '2026-10-14' },
]

export function getExerciseSet(id: string): ExerciseSet {
  const set = exerciseSets.find((s) => s.id === id)
  if (!set) throw new Error(`Unknown exercise set ${id}`)
  return set
}

/* ---------- Questions (one example of every type) ---------- */

/**
 * Prototype content: every exercise set opens with this showcase list until it
 * has been saved with its own questions.
 */
export const sampleQuestions: Question[] = [
  { id: 'ch-01', type: 'trac-nghiem', prompt: '7 × 8 = ?', points: 1, skills: ['Bảng nhân'], options: ['54', '56', '63', '48'], correctIndex: 1 },
  { id: 'ch-02', type: 'dung-sai', prompt: 'Số 450 đọc là: Bốn trăm năm mươi.', points: 1, skills: ['Đọc, viết số'], answer: true },
  { id: 'ch-03', type: 'dien-cho-trong', prompt: 'Mùa thu, trời trong xanh và ___ .', points: 1, skills: ['Từ ngữ mùa thu', 'Chính tả'], answers: ['cao vời vợi'] },
  { id: 'ch-04', type: 'tra-loi-ngan', prompt: 'Một cửa hàng có 96 kg gạo, đã bán 1/4 số gạo. Hỏi đã bán bao nhiêu ki-lô-gam?', points: 2, skills: ['Toán có lời văn', 'Một phần mấy'], answer: '24 kg' },
  {
    id: 'ch-05', type: 'noi', prompt: 'Nối từ tiếng Anh với nghĩa đúng.', points: 1.5, skills: ['Từ vựng gia đình'],
    pairs: [
      { left: 'father', right: 'bố', picture: '👨' },
      { left: 'mother', right: 'mẹ', picture: '👩' },
      { left: 'sister', right: 'chị/em gái', picture: '👧' },
    ],
  },
  { id: 'ch-06', type: 'sap-xep', prompt: 'Sắp xếp các từ sau thành câu đúng.', points: 1.5, skills: ['Sắp xếp câu'], tokens: ['Hôm nay', 'em', 'đến', 'trường', 'sớm'], shuffled: [1, 2, 3, 0, 4] },
  { id: 'ch-07', type: 'tu-luan', prompt: 'Viết đoạn văn ngắn (4–5 câu) kể về một người bạn của em.', points: 2, skills: ['Viết đoạn văn'], rubric: 'Giới thiệu được tên bạn (0,5đ) · Tả ngoại hình hoặc tính tình (0,5đ) · Kể một kỷ niệm (0,5đ) · Câu văn đúng chính tả, có dấu câu (0,5đ)' },
]

export const sampleFlashcards: FlashcardItem[] = UNIT_3_SAMPLE_WORDS.map((word, index) => ({
  id: `fc-u3-${String(index + 1).padStart(2, '0')}`,
  word,
  definition: generateChildFriendlyDefinition(word, 0, 'Where Do Animals Live?'),
}))

export const flashcardsBySet: Record<string, FlashcardItem[]> = {
  'bt-fc-01': sampleFlashcards,
}

const worksheetPhoto =
  'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=480&h=640'

/** Source files for uploaded sets. */
export const attachmentsBySet: Record<string, Attachment[]> = Object.fromEntries(
  exerciseSets
    .filter((s) => s.source === 'tai-len')
    .map((s) => [
      s.id,
      [
        { id: `${s.id}-f1`, name: 'phieu-bai-tap-trang-1.jpg', kind: 'image', sizeKb: 842, url: worksheetPhoto },
        { id: `${s.id}-f2`, name: 'de-on-tap.pdf', kind: 'pdf', sizeKb: 1260, pages: 3 },
      ] satisfies Attachment[],
    ]),
)

/* ---------- Assignments for the current week (8) ---------- */

interface AssignmentSeed {
  exerciseSetId: string
  /** Day assigned within the current week: 0 = Monday. */
  day: number
  dueDay: number
  dueHour: number
  status: AssignmentStatus
  parentNote?: string
}

const assignmentSeeds: AssignmentSeed[] = [
  { exerciseSetId: 'bt-01', day: 0, dueDay: 0, dueHour: 20, status: 'da-cham' },
  { exerciseSetId: 'bt-07', day: 0, dueDay: 1, dueHour: 20, status: 'da-cham' },
  { exerciseSetId: 'bt-12', day: 1, dueDay: 1, dueHour: 20, status: 'da-cham' },
  { exerciseSetId: 'bt-02', day: 1, dueDay: 2, dueHour: 20, status: 'tre-han', parentNote: 'Con nhớ kiểm tra lại số dư nhé!' },
  { exerciseSetId: 'bt-08', day: 2, dueDay: 2, dueHour: 20, status: 'cho-cham' },
  { exerciseSetId: 'bt-06', day: 3, dueDay: 3, dueHour: 17, status: 'cho-cham' },
  { exerciseSetId: 'bt-11', day: 3, dueDay: 3, dueHour: 19, status: 'dang-lam', parentNote: 'Viết cẩn thận, chú ý dấu thanh.' },
  { exerciseSetId: 'bt-15', day: 3, dueDay: 3, dueHour: 20, status: 'chua-lam' },
]

export const assignments: Assignment[] = assignmentSeeds.map((seed, i) => ({
  id: `gb-${String(i + 1).padStart(2, '0')}`,
  exerciseSetId: seed.exerciseSetId,
  assignedDate: weekDay(0, seed.day).toISOString(),
  dueDate: atTime(weekDay(0, seed.dueDay), seed.dueHour).toISOString(),
  status: seed.status,
  parentNote: seed.parentNote,
}))

/* ---------- Graded attempts over the last 6 weeks (20) ---------- */

interface AttemptSeed {
  exerciseSetId: string
  weekOffset: number
  day: number
  score: number
  durationMinutes: number
  feedback: string
  assignmentId?: string
}

const attemptSeeds: AttemptSeed[] = [
  // 5 weeks ago
  { exerciseSetId: 'bt-01', weekOffset: -5, day: 0, score: 7, durationMinutes: 16, feedback: 'Tính nhẩm khá nhanh, còn nhầm 7 × 8.' },
  { exerciseSetId: 'bt-07', weekOffset: -5, day: 2, score: 6.5, durationMinutes: 17, feedback: 'Còn lẫn l/n ở một số từ, đọc to khi viết nhé.' },
  { exerciseSetId: 'bt-13', weekOffset: -5, day: 3, score: 7.5, durationMinutes: 14, feedback: 'Thuộc màu sắc, cần ôn thêm số 13–19.' },
  // 4 weeks ago
  { exerciseSetId: 'bt-04', weekOffset: -4, day: 1, score: 6.5, durationMinutes: 34, feedback: 'Con cần đọc kỹ đề và tóm tắt trước khi giải.' },
  { exerciseSetId: 'bt-08', weekOffset: -4, day: 2, score: 7, durationMinutes: 26, feedback: 'Trả lời đúng ý, nên viết câu trả lời đầy đủ hơn.' },
  { exerciseSetId: 'bt-12', weekOffset: -4, day: 4, score: 8, durationMinutes: 15, feedback: 'Nhớ từ vựng tốt, luyện phát âm thêm nhé.' },
  // 3 weeks ago
  { exerciseSetId: 'bt-02', weekOffset: -3, day: 0, score: 7.5, durationMinutes: 22, feedback: 'Nhớ: số dư luôn bé hơn số chia.' },
  { exerciseSetId: 'bt-09', weekOffset: -3, day: 2, score: 6.5, durationMinutes: 18, feedback: 'Dấu hỏi/ngã còn nhầm nhiều, mẹ con mình cùng ôn nhé.' },
  { exerciseSetId: 'bt-14', weekOffset: -3, day: 3, score: 8.5, durationMinutes: 18, feedback: 'Phân biệt this/that tốt.' },
  // 2 weeks ago
  { exerciseSetId: 'bt-03', weekOffset: -2, day: 1, score: 8, durationMinutes: 23, feedback: 'Áp dụng công thức đúng, nhớ ghi đơn vị.' },
  { exerciseSetId: 'bt-07', weekOffset: -2, day: 2, score: 7.5, durationMinutes: 14, feedback: 'Đã tiến bộ ở phần l/n.' },
  { exerciseSetId: 'bt-13', weekOffset: -2, day: 3, score: 7.5, durationMinutes: 13, feedback: 'Nghe số còn chậm, cố gắng thêm nhé.' },
  { exerciseSetId: 'bt-14', weekOffset: -2, day: 4, score: 9, durationMinutes: 16, feedback: 'Rất tốt! Gần như đúng hết.' },
  // Last week
  { exerciseSetId: 'bt-05', weekOffset: -1, day: 0, score: 8, durationMinutes: 13, feedback: 'Đọc giờ chính xác, tính khoảng thời gian cần cẩn thận.' },
  { exerciseSetId: 'bt-10', weekOffset: -1, day: 1, score: 7, durationMinutes: 29, feedback: 'Đoạn văn có cảm xúc, chú ý dấu chấm câu.' },
  { exerciseSetId: 'bt-12', weekOffset: -1, day: 2, score: 8.5, durationMinutes: 14, feedback: 'Tiến bộ rõ so với lần trước!' },
  { exerciseSetId: 'bt-03', weekOffset: -1, day: 4, score: 7.75, durationMinutes: 24, feedback: 'Bài có lời văn còn thiếu câu trả lời.' },
  // This week
  { exerciseSetId: 'bt-01', weekOffset: 0, day: 0, score: 8.5, durationMinutes: 12, feedback: 'Bảng nhân 7 đã thuộc rồi, giỏi lắm!', assignmentId: 'gb-01' },
  { exerciseSetId: 'bt-07', weekOffset: 0, day: 1, score: 8, durationMinutes: 13, feedback: 'Viết đẹp và ít lỗi hơn hẳn.', assignmentId: 'gb-02' },
  { exerciseSetId: 'bt-12', weekOffset: 0, day: 1, score: 8.75, durationMinutes: 14, feedback: 'Giới thiệu bạn rất tự nhiên.', assignmentId: 'gb-03' },
]

function starsFor(score: number): Attempt['stars'] {
  if (score >= 9) return 3
  if (score >= 7) return 2
  if (score >= 5) return 1
  return 0
}

export const attempts: Attempt[] = attemptSeeds.map((seed, i) => {
  const set = getExerciseSet(seed.exerciseSetId)
  const submitted = atTime(weekDay(seed.weekOffset, seed.day), 19, 10 + (i % 4) * 10)
  return {
    id: `lb-${String(i + 1).padStart(2, '0')}`,
    assignmentId: seed.assignmentId,
    exerciseSetId: set.id,
    subject: set.subject,
    submittedAt: submitted.toISOString(),
    gradedAt: atTime(submitted, 21).toISOString(),
    score: seed.score,
    correctCount: Math.round((seed.score / 10) * set.questionCount),
    totalCount: set.questionCount,
    durationMinutes: seed.durationMinutes,
    stars: starsFor(seed.score),
    feedback: seed.feedback,
  }
})

student.totalStars = attempts.reduce((sum, a) => sum + a.stars, 0)

/* ---------- Skill insights ("Cần chú ý") ---------- */

export const skillInsights: SkillInsight[] = [
  { id: 'kn-01', subject: 'toan', skill: 'Bài toán có lời văn', accuracy: 58, wrongCount: 5, totalCount: 12, recentAttempts: 3, practiceSetId: 'bt-04' },
  { id: 'kn-02', subject: 'tieng-viet', skill: 'Dấu hỏi/ngã', accuracy: 65, wrongCount: 7, totalCount: 20, recentAttempts: 2, practiceSetId: 'bt-09' },
  { id: 'kn-03', subject: 'tieng-anh', skill: 'Số đếm 11–20', accuracy: 72, wrongCount: 5, totalCount: 18, recentAttempts: 2, practiceSetId: 'bt-13' },
]

/* ---------- Derived counts used by the shell ---------- */

export const awaitingGradingCount = assignments.filter((a) => a.status === 'cho-cham').length

export const openAssignmentsCount = assignments.filter(
  (a) => a.status === 'chua-lam' || a.status === 'dang-lam' || a.status === 'tre-han',
).length
