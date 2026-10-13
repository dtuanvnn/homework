import { useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, TextCursorInput } from 'lucide-react'
import AnswerStatusBadge from '@/components/question/AnswerStatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatScoreValue } from '@/lib/format'
import { BLANK, QUESTION_TYPES, QUESTION_TYPE_LIST, uid } from '@/lib/questions'
import type { Question, QuestionType } from '@/lib/types'
import FigureField, { type FigureSource } from './FigureField'
import FormulaPreview from './FormulaPreview'
import QuestionTypeFields from './QuestionTypeFields'
import SkillTagInput from './SkillTagInput'
import { changeDraftType, emptyDraft, fromDraft, parsePoints, patchDraft, toDraft, validateDraft, type QuestionDraft } from './question-draft'

/** Quick picks; exams often give more, typed into "Điểm khác". */
const POINT_OPTIONS = [0.5, 1, 1.5, 2, 3]

const pointsLabel = (p: number) => p.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

const FORMULA_SNIPPETS = [
  { label: 'Phân số', snippet: '$\\frac{}{}$', caretBack: 4 },
  { label: 'Hỗn số', snippet: '$1\\frac{}{}$', caretBack: 4 },
  { label: '×', snippet: '$\\times$', caretBack: 0 },
  { label: '÷', snippet: '$\\div$', caretBack: 0 },
]

const PROMPT_LABELS: Partial<Record<QuestionType, { label: string; placeholder: string }>> = {
  'trac-nghiem': { label: 'Câu hỏi', placeholder: 'VD: 7 × 8 = ?' },
  'dung-sai': { label: 'Nhận định', placeholder: 'VD: Số 450 đọc là: Bốn trăm năm mươi.' },
  'dien-cho-trong': { label: 'Câu có chỗ trống', placeholder: `VD: Mùa thu, trời trong xanh và ${BLANK} .` },
  'tra-loi-ngan': { label: 'Câu hỏi', placeholder: 'VD: Một cửa hàng có 96 kg gạo…' },
  noi: { label: 'Yêu cầu', placeholder: 'VD: Nối từ tiếng Anh với nghĩa đúng.' },
  'sap-xep': { label: 'Yêu cầu', placeholder: 'VD: Sắp xếp các từ sau thành câu đúng.' },
  'tu-luan': { label: 'Đề bài', placeholder: 'VD: Viết đoạn văn ngắn (4–5 câu) kể về một người bạn của em.' },
}

interface QuestionEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Question being edited; null/undefined when adding a new one. */
  editing?: Question | null
  onSubmit: (question: Question) => void
  skillSuggestions: string[]
  setId?: string
  sources?: FigureSource[]
}

const keepOpenForMathKeyboard = (event: Event) => {
  if (event.target instanceof Element && event.target.closest('.ML__keyboard')) event.preventDefault()
}

export default function QuestionEditorSheet({ open, onOpenChange, editing, onSubmit, skillSuggestions, setId, sources }: QuestionEditorSheetProps) {
  const [draft, setDraft] = useState<QuestionDraft | null>(() => (open && editing ? toDraft(editing) : null))
  const [showErrors, setShowErrors] = useState(false)
  /** What the parent is typing into "Điểm khác"; null shows the draft's points. */
  const [pointsText, setPointsText] = useState<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Reset the form whenever the sheet opens or switches question.
  const [shownFor, setShownFor] = useState({ open, editing })
  if (shownFor.open !== open || shownFor.editing !== editing) {
    setShownFor({ open, editing })
    if (open) {
      setDraft(editing ? toDraft(editing) : null)
      setShowErrors(false)
      setPointsText(null)
    }
  }

  const patch = (p: Partial<QuestionDraft>) => setDraft((d) => (d ? patchDraft(d, p) : d))
  const pointsInvalid = pointsText !== null && pointsText.trim() !== '' && parsePoints(pointsText) === null
  const issues = draft ? [...validateDraft(draft), ...(pointsInvalid ? ['Điểm từ 0,25 đến 100'] : [])] : []
  const typeInfo = draft ? QUESTION_TYPES[draft.type] : null
  const promptCopy = draft ? PROMPT_LABELS[draft.type] : undefined

  const insertAtCursor = (snippet: string, caretBack = 0) => {
    if (!draft) return
    const el = promptRef.current
    const start = el?.selectionStart ?? draft.prompt.length
    const end = el?.selectionEnd ?? draft.prompt.length
    patch({ prompt: draft.prompt.slice(0, start) + snippet + draft.prompt.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + snippet.length - caretBack, start + snippet.length - caretBack)
    })
  }

  const insertBlank = () => {
    if (!draft) return
    const el = promptRef.current
    const start = el?.selectionStart ?? draft.prompt.length
    const before = draft.prompt.slice(0, start)
    const insert = `${before && !before.endsWith(' ') ? ' ' : ''}${BLANK} `
    insertAtCursor(insert, 0)
  }

  const submit = () => {
    if (!draft) return
    if (issues.length) {
      setShowErrors(true)
      return
    }
    onSubmit(fromDraft(draft, editing?.id ?? uid('ch'), editing ?? undefined))
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        MathLive's virtual keyboard (math answers) mounts on <body>, outside this modal sheet: without this a
        keycap tap counts as an outside interaction and closes the sheet.
      */}
      <SheetContent aria-describedby={undefined} onInteractOutside={keepOpenForMathKeyboard}>
        {!draft ? (
          <>
            <SheetHeader>
              <SheetTitle>Thêm câu hỏi</SheetTitle>
              <SheetDescription>Chọn loại câu hỏi bạn muốn thêm.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))] md:px-6">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUESTION_TYPE_LIST.map(({ type, label, hint, icon: Icon }) => (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => setDraft(emptyDraft(type))}
                      className="group flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-colors outline-none hover:border-indigo-300 hover:bg-indigo-50/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-white">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{label}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                      <ChevronRight className="size-4 text-slate-300 group-hover:text-indigo-500" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="flex-row items-center gap-2">
              {!editing && (
                <Button variant="ghost" size="icon" className="-ml-2 shrink-0" onClick={() => setDraft(null)} aria-label="Chọn loại khác">
                  <ArrowLeft className="size-5" />
                </Button>
              )}
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2">
                  {typeInfo && <typeInfo.icon className="size-5 text-indigo-600" aria-hidden />}
                  {editing ? 'Sửa câu hỏi' : typeInfo?.label}
                </SheetTitle>
                <p className="text-sm text-slate-500">{editing ? typeInfo?.label : typeInfo?.hint}</p>
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 md:px-6">
              {editing && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="q-type">Dạng câu</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft((d) => (d ? changeDraftType(d, v as QuestionType) : d))}>
                    <SelectTrigger id="q-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPE_LIST.map(({ type, label }) => (
                        <SelectItem key={type} value={type}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {draft.type !== editing.type && (
                    <p className="text-xs text-slate-500">
                      {draft.type === 'tu-luan'
                        ? 'Học sinh sẽ viết bài giải vào ô nhiều dòng; câu tự luận do phụ huynh chấm.'
                        : 'Kiểm tra lại đáp án bên dưới cho dạng câu mới.'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="q-prompt">{promptCopy?.label ?? 'Câu hỏi'}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {draft.type === 'dien-cho-trong' && (
                      <Button variant="outline" size="sm" className="h-9" onClick={insertBlank}>
                        <TextCursorInput />
                        Chèn chỗ trống
                      </Button>
                    )}
                    {FORMULA_SNIPPETS.map((f) => (
                      <Button key={f.label} type="button" variant="outline" size="sm" className="h-9" aria-label={`Chèn ${f.label}`} onClick={() => insertAtCursor(f.snippet, f.caretBack)}>
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  id="q-prompt"
                  ref={promptRef}
                  rows={draft.prompt.includes('\n') || draft.prompt.length > 160 ? 8 : 3}
                  value={draft.prompt}
                  onChange={(e) => patch({ prompt: e.target.value })}
                  placeholder={promptCopy?.placeholder}
                />
                <FormulaPreview text={draft.prompt} />
              </div>

              {draft.answerStatus && (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <AnswerStatusBadge status={draft.answerStatus} />
                  {draft.answerStatus === 'missing' ? (
                    <p>Nhập đáp án bên dưới, hoặc để trống: khi con làm, câu này do bố mẹ chấm tay.</p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>Đáp án do AI giải. Sửa đáp án, hoặc xác nhận nếu đã đúng.</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => d && { ...d, answerStatus: undefined })}>
                        <Check />
                        Xác nhận đáp án đúng
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <QuestionTypeFields draft={draft} onChange={patch} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="q-solution">Lời giải (không bắt buộc)</Label>
                <Textarea
                  id="q-solution"
                  rows={draft.solution.includes('\n') || draft.solution.length > 160 ? 6 : 3}
                  value={draft.solution}
                  onChange={(e) => patch({ solution: e.target.value })}
                  placeholder="Các bước giải và đáp số. Con xem được khi đã hết lượt làm."
                />
                <FormulaPreview text={draft.solution} />
              </div>

              {setId && (
                <FigureField setId={setId} sources={sources ?? []} image={draft.image} imageUrl={draft.imageUrl} onChange={(image, imageUrl) => patch({ image, imageUrl })} />
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="q-points">Điểm</Label>
                <div className="flex gap-2">
                  <ToggleGroup
                    type="single"
                    value={String(draft.points)}
                    onValueChange={(v) => {
                      if (!v) return
                      patch({ points: Number(v) })
                      setPointsText(null)
                    }}
                    className="flex-1"
                    aria-label="Điểm"
                  >
                    {POINT_OPTIONS.map((p) => (
                      <ToggleGroupItem key={p} value={String(p)} className="min-h-10 tabular-nums">
                        {formatScoreValue(p)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Input
                    id="q-points"
                    inputMode="decimal"
                    aria-label="Điểm khác"
                    placeholder="Khác"
                    aria-invalid={pointsInvalid || undefined}
                    className="h-10 w-20 text-center tabular-nums"
                    value={pointsText ?? (POINT_OPTIONS.includes(draft.points) ? '' : pointsLabel(draft.points))}
                    onChange={(e) => {
                      setPointsText(e.target.value)
                      const points = parsePoints(e.target.value)
                      if (points !== null) patch({ points })
                    }}
                    onBlur={() => !pointsInvalid && setPointsText(null)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="q-skills">Kỹ năng</Label>
                <SkillTagInput id="q-skills" value={draft.skills} onChange={(skills) => patch({ skills })} suggestions={skillSuggestions} />
              </div>
            </div>

            <SheetFooter className="flex-col">
              {showErrors && issues.length > 0 && (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {issues.join(' · ')}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Hủy
                </Button>
                <Button className="flex-[2]" onClick={submit}>
                  {editing ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
