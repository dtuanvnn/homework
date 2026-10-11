import { useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, TextCursorInput } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatScoreValue } from '@/lib/format'
import { BLANK, QUESTION_TYPES, QUESTION_TYPE_LIST, uid } from '@/lib/questions'
import type { Question, QuestionType } from '@/lib/types'
import QuestionTypeFields from './QuestionTypeFields'
import SkillTagInput from './SkillTagInput'
import { changeDraftType, emptyDraft, fromDraft, toDraft, validateDraft, type QuestionDraft } from './question-draft'

const POINT_OPTIONS = [0.5, 1, 1.5, 2, 3]

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
}

export default function QuestionEditorSheet({ open, onOpenChange, editing, onSubmit, skillSuggestions }: QuestionEditorSheetProps) {
  const [draft, setDraft] = useState<QuestionDraft | null>(() => (open && editing ? toDraft(editing) : null))
  const [showErrors, setShowErrors] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Reset the form whenever the sheet opens or switches question.
  const [shownFor, setShownFor] = useState({ open, editing })
  if (shownFor.open !== open || shownFor.editing !== editing) {
    setShownFor({ open, editing })
    if (open) {
      setDraft(editing ? toDraft(editing) : null)
      setShowErrors(false)
    }
  }

  const patch = (p: Partial<QuestionDraft>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const issues = draft ? validateDraft(draft) : []
  const typeInfo = draft ? QUESTION_TYPES[draft.type] : null
  const promptCopy = draft ? PROMPT_LABELS[draft.type] : undefined

  const insertBlank = () => {
    if (!draft) return
    const el = promptRef.current
    const start = el?.selectionStart ?? draft.prompt.length
    const end = el?.selectionEnd ?? draft.prompt.length
    const before = draft.prompt.slice(0, start)
    const insert = `${before && !before.endsWith(' ') ? ' ' : ''}${BLANK} `
    patch({ prompt: before + insert + draft.prompt.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + insert.length, start + insert.length)
    })
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
      <SheetContent aria-describedby={undefined}>
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
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="q-prompt">{promptCopy?.label ?? 'Câu hỏi'}</Label>
                  {draft.type === 'dien-cho-trong' && (
                    <Button variant="outline" size="sm" className="h-9" onClick={insertBlank}>
                      <TextCursorInput />
                      Chèn chỗ trống
                    </Button>
                  )}
                </div>
                <Textarea
                  id="q-prompt"
                  ref={promptRef}
                  rows={draft.prompt.includes('\n') || draft.prompt.length > 160 ? 8 : 3}
                  value={draft.prompt}
                  onChange={(e) => patch({ prompt: e.target.value })}
                  placeholder={promptCopy?.placeholder}
                />
              </div>

              <QuestionTypeFields draft={draft} onChange={patch} />

              <div className="flex flex-col gap-2">
                <Label>Điểm</Label>
                <ToggleGroup
                  type="single"
                  value={String(draft.points)}
                  onValueChange={(v) => v && patch({ points: Number(v) })}
                  className="w-full"
                  aria-label="Điểm"
                >
                  {POINT_OPTIONS.map((p) => (
                    <ToggleGroupItem key={p} value={String(p)} className="min-h-10 tabular-nums">
                      {formatScoreValue(p)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
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
