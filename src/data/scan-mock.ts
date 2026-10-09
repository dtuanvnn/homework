import type { Attachment, Question, SubjectId } from '@/lib/types'

/** One question as returned by the (mock) AI scanner. */
export interface ScannedQuestion {
  question: Question
  /** 0–1 */
  confidence: number
  /** 1-based page index across all uploaded files. */
  page: number
  note?: string
}

export const SAMPLE_UPLOADS: Attachment[] = [
  {
    id: 'mau-anh',
    name: 'phieu-bai-tap-trang-1.jpg',
    kind: 'image',
    sizeKb: 842,
    url: 'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=1200&h=1600',
  },
  { id: 'mau-pdf', name: 'de-on-tap-tuan-6.pdf', kind: 'pdf', sizeKb: 1260, pages: 2 },
]

const SCANS: Record<SubjectId, ScannedQuestion[]> = {
  toan: [
    { page: 1, confidence: 0.97, question: { id: '', type: 'trac-nghiem', prompt: '8 × 6 = ?', points: 1, skills: ['Bảng nhân'], options: ['42', '48', '54', '56'], correctIndex: 1 } },
    { page: 1, confidence: 0.93, question: { id: '', type: 'dung-sai', prompt: 'Số 705 đọc là: Bảy trăm linh năm.', points: 1, skills: ['Đọc, viết số'], answer: true } },
    { page: 1, confidence: 0.88, question: { id: '', type: 'tra-loi-ngan', prompt: 'Tính: 456 + 237 = ?', points: 1, skills: ['Cộng có nhớ'], answer: '693' } },
    {
      page: 2,
      confidence: 0.54,
      note: 'Có thể là phần đầu của câu bên dưới',
      question: { id: '', type: 'tra-loi-ngan', prompt: 'Một cửa hàng có 96 kg gạo, đã bán 1/4 số gạo.', points: 1, skills: ['Toán có lời văn'], answer: '' },
    },
    { page: 2, confidence: 0.81, question: { id: '', type: 'tra-loi-ngan', prompt: 'Hỏi đã bán bao nhiêu ki-lô-gam?', points: 1, skills: ['Một phần mấy'], answer: '24 kg' } },
    {
      page: 2,
      confidence: 0.66,
      note: 'Chữ viết tay khó đọc ở đáp án',
      question: { id: '', type: 'dien-cho-trong', prompt: 'Chu vi hình vuông có cạnh 5 cm là ___ cm.', points: 1, skills: ['Hình học'], answers: ['20'] },
    },
    { page: 3, confidence: 0.91, question: { id: '', type: 'trac-nghiem', prompt: 'Phép chia 29 : 4 có số dư là:', points: 1, skills: ['Phép chia có dư'], options: ['1', '2', '3', '4'], correctIndex: 0 } },
    { page: 3, confidence: 0.86, question: { id: '', type: 'tra-loi-ngan', prompt: 'Lớp 3A có 32 học sinh xếp đều thành 4 hàng. Hỏi mỗi hàng có bao nhiêu học sinh?', points: 2, skills: ['Toán có lời văn'], answer: '8 học sinh' } },
  ],
  'tieng-viet': [
    { page: 1, confidence: 0.95, question: { id: '', type: 'trac-nghiem', prompt: 'Từ nào viết đúng chính tả?', points: 1, skills: ['Chính tả'], options: ['lo lắng', 'no lắng', 'lo nắng', 'no nắng'], correctIndex: 0 } },
    { page: 1, confidence: 0.69, note: 'Dấu thanh mờ – có thể là “nghỉ”, đối chiếu bản gốc', question: { id: '', type: 'dien-cho-trong', prompt: 'Chủ nhật, cả nhà em được ___ ngơi.', points: 1, skills: ['Dấu hỏi/ngã'], answers: ['nghĩ'] } },
    { page: 2, confidence: 0.9, question: { id: '', type: 'dien-cho-trong', prompt: 'Mùa thu, trời trong xanh và ___ .', points: 1, skills: ['Từ ngữ mùa thu'], answers: ['cao vời vợi'] } },
    { page: 2, confidence: 0.84, question: { id: '', type: 'sap-xep', prompt: 'Sắp xếp các từ sau thành câu đúng.', points: 1.5, skills: ['Sắp xếp câu'], tokens: ['Hôm nay', 'em', 'đến', 'trường', 'sớm'], shuffled: [1, 2, 3, 0, 4] } },
    { page: 3, confidence: 0.58, note: 'Không chắc đây là câu tự luận', question: { id: '', type: 'tu-luan', prompt: 'Viết đoạn văn ngắn (4–5 câu) kể về một người bạn của em.', points: 2, skills: ['Viết đoạn văn'], rubric: '' } },
  ],
  'tieng-anh': [
    { page: 1, confidence: 0.96, question: { id: '', type: 'noi', prompt: 'Match the words with the pictures.', points: 1.5, skills: ['Từ vựng gia đình'], pairs: [{ left: 'father', right: 'bố', picture: '👨' }, { left: 'mother', right: 'mẹ', picture: '👩' }, { left: 'sister', right: 'chị/em gái', picture: '👧' }] } },
    { page: 1, confidence: 0.89, question: { id: '', type: 'trac-nghiem', prompt: 'This ___ my pen.', points: 1, skills: ['Ngữ pháp'], options: ['is', 'are', 'am', 'be'], correctIndex: 0 } },
    { page: 2, confidence: 0.63, note: 'Có thể thiếu một phương án', question: { id: '', type: 'trac-nghiem', prompt: 'How many books? – There are ___ books.', points: 1, skills: ['Số đếm 11–20'], options: ['twelve', 'twenty'], correctIndex: 0 } },
    { page: 2, confidence: 0.92, question: { id: '', type: 'dung-sai', prompt: '"Ruler" nghĩa là "thước kẻ".', points: 1, skills: ['Từ vựng'], answer: true } },
    { page: 3, confidence: 0.87, question: { id: '', type: 'sap-xep', prompt: 'Reorder the words.', points: 1.5, skills: ['Sắp xếp câu'], tokens: ['This', 'is', 'my', 'school'], shuffled: [2, 3, 0, 1] } },
  ],
}

/** Returns fresh copies of the mock scan for a subject, with pages clamped to the uploaded page count. */
export function mockScan(subject: SubjectId, pageCount: number): ScannedQuestion[] {
  return SCANS[subject].map((s, i) => ({
    ...s,
    page: Math.min(s.page, Math.max(1, pageCount)),
    question: { ...s.question, id: `quet-${Date.now().toString(36)}-${i}` } as Question,
  }))
}
