import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Plus, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ExerciseMetaForm from '@/components/exercise-detail/ExerciseMetaForm'
import QuestionEditorSheet from '@/components/exercise-detail/QuestionEditorSheet'
import QuestionList from '@/components/exercise-detail/QuestionList'
import SectionHeader from '@/components/shared/SectionHeader'
import SubjectIcon from '@/components/shared/SubjectIcon'
import { TODAY, student } from '@/data/mock-data'
import { addDays } from '@/lib/dates'
import { formatScoreValue, formatVietnameseDate } from '@/lib/format'
import { totalPoints } from '@/lib/questions'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/state/library-store'
import type { Attachment, ExerciseSet, ExerciseSetStatus, Question } from '@/lib/types'

/** Called by the shell before navigating away; `next` runs once leaving is confirmed. */
import type { LeaveGuard } from "@/components/layout/AppFrame"

interface ExerciseSetDetailProps {
  setId: string
  onClose: () => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

function snapshot(set: ExerciseSet | undefined, questions: Question[], attachments: Attachment[]) {
  if (!set) return ''
  const { status: _status, timesAssigned: _t, questionCount: _q, ...meta } = set
  return JSON.stringify([meta, questions, attachments.map((a) => a.id)])
}

export default function ExerciseSetDetail({ setId, onClose, registerLeaveGuard }: ExerciseSetDetailProps) {
  const library = useLibrary()
  const stored = library.getSet(setId)

  const [draft, setDraft] = useState<ExerciseSet | undefined>(stored)
  const [questions, setQuestions] = useState<Question[]>(() => library.getQuestions(setId))
  const [attachments, setAttachments] = useState<Attachment[]>(() => library.getAttachments(setId))
  const [baseline, setBaseline] = useState(() => snapshot(stored, questions, attachments))
  const [titleError, setTitleError] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  const dirty = snapshot(draft, questions, attachments) !== baseline
  const points = totalPoints(questions)
  const timesAssigned = stored?.timesAssigned ?? 0

  const skillSuggestions = useMemo(() => {
    const all = new Set<string>()
    if (draft?.topic) all.add(draft.topic)
    questions.forEach((q) => q.skills.forEach((s) => all.add(s)))
    return [...all]
  }, [draft?.topic, questions])

  useEffect(() => {
    registerLeaveGuard((next) => (dirty ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [dirty, registerLeaveGuard])

  if (!draft) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-semibold text-slate-900">Không tìm thấy bộ bài tập này.</p>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft />
          Về Kho bài tập
        </Button>
      </div>
    )
  }

  const persist = (status: ExerciseSetStatus): boolean => {
    if (!draft.title.trim()) {
      setTitleError(true)
      document.getElementById('set-title')?.focus()
      toast.error('Bộ bài cần có tên')
      return false
    }
    if (status === 'san-sang' && questions.length === 0) {
      toast.error('Cần ít nhất 1 câu hỏi', { description: 'Thêm câu hỏi trước khi đánh dấu sẵn sàng.' })
      return false
    }
    const next = { ...draft, title: draft.title.trim(), status }
    library.saveSet(next, questions, attachments)
    setDraft(next)
    setBaseline(snapshot(next, questions, attachments))
    return true
  }

  const handleSaveDraft = () => {
    if (persist('nhap')) toast.success('Đã lưu nháp')
  }

  const handleSaveReady = () => {
    if (persist('san-sang')) toast.success('Đã lưu · Bộ bài sẵn sàng để giao')
  }

  const handleAssign = () => {
    if (!persist('san-sang')) return
    library.markAssigned(draft.id)
    toast.success(`Đã giao bài cho ${student.name}`, {
      description: `“${draft.title.trim()}” · Hạn ${formatVietnameseDate(addDays(TODAY, 1))}`,
    })
  }

  const patchDraft = (patch: Partial<ExerciseSet>) => {
    if (patch.title !== undefined && patch.title.trim()) setTitleError(false)
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  const openAdd = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  const openEdit = (q: Question) => {
    setEditing(q)
    setSheetOpen(true)
  }

  const handleSubmitQuestion = (q: Question) => {
    setQuestions((prev) => (prev.some((x) => x.id === q.id) ? prev.map((x) => (x.id === q.id ? q : x)) : [...prev, q]))
    toast.success(editing ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi')
  }

  const handleDeleteQuestion = (q: Question) => {
    const index = questions.findIndex((x) => x.id === q.id)
    setQuestions((prev) => prev.filter((x) => x.id !== q.id))
    toast(`Đã xóa câu ${index + 1}`, {
      action: {
        label: 'Hoàn tác',
        onClick: () => setQuestions((prev) => (prev.some((x) => x.id === q.id) ? prev : [...prev.slice(0, index), q, ...prev.slice(index)])),
      },
    })
  }

  const isDraft = draft.status === 'nhap'
  const statusBadge = (
    <Badge
      variant="outline"
      className={cn(
        isDraft ? 'border-dashed border-slate-300 bg-slate-50 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      )}
    >
      {isDraft ? 'Nháp' : (
        <>
          <CheckCircle2 />
          Sẵn sàng
        </>
      )}
    </Badge>
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-10 w-fit -translate-x-3 text-slate-500 md:inline-flex"
          onClick={() => (dirty ? setPendingLeave(() => onClose) : onClose())}
        >
          <ArrowLeft />
          Kho bài tập
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <SubjectIcon subject={draft.subject} className="mt-0.5 hidden md:flex" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge}
                {dirty && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                    Chưa lưu
                  </span>
                )}
              </div>
              <h1 className="mt-1.5 text-xl leading-tight font-bold tracking-tight text-slate-900 md:text-3xl">
                {draft.title.trim() || 'Bộ bài chưa đặt tên'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {questions.length} câu · {formatScoreValue(points)} điểm ·{' '}
                {timesAssigned ? `Đã giao ${timesAssigned} lần` : 'Chưa giao'}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Button variant="outline" onClick={handleAssign}>
              <Send />
              Giao bài này
            </Button>
            <Button variant="secondary" onClick={handleSaveDraft}>
              <Save />
              Lưu nháp
            </Button>
            <Button onClick={handleSaveReady}>
              <CheckCircle2 />
              Lưu & sẵn sàng
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="meta-heading">
        <h2 id="meta-heading" className="sr-only">
          Thông tin bộ bài
        </h2>
        <ExerciseMetaForm
          value={draft}
          onChange={patchDraft}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          titleError={titleError}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Câu hỏi"
          description={
            questions.length ? `${questions.length} câu · ${formatScoreValue(points)} điểm · giữ tay nắm để kéo sắp xếp` : undefined
          }
          action={
            <Button variant="outline" className="hidden md:inline-flex" onClick={openAdd}>
              <Plus />
              Thêm câu hỏi
            </Button>
          }
        />

        {questions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
            <p className="font-semibold text-slate-900">Chưa có câu hỏi nào</p>
            <p className="mt-1 text-sm text-slate-500">Thêm câu trắc nghiệm, điền chỗ trống, nối, tự luận…</p>
          </div>
        ) : (
          <QuestionList questions={questions} onReorder={setQuestions} onEdit={openEdit} onDelete={handleDeleteQuestion} />
        )}

        <button
          type="button"
          onClick={openAdd}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 text-sm font-semibold text-indigo-700 transition-colors outline-none hover:border-indigo-300 hover:bg-indigo-50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus className="size-5" />
          Thêm câu hỏi
        </button>
      </section>

      {/* Leaves room for the fixed phone action bar. */}
      <div className="h-28 md:hidden" aria-hidden />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-4 pt-1.5 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-xs font-medium', dirty ? 'text-amber-700' : 'text-slate-400')}>
            {dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu mọi thay đổi'}
          </span>
          <Button variant="ghost" size="sm" className="-mr-2 h-11 text-indigo-700 hover:bg-indigo-50" onClick={handleAssign}>
            <Send />
            Giao bài này
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleSaveDraft}>
            Lưu nháp
          </Button>
          <Button className="flex-[1.4]" onClick={handleSaveReady}>
            Lưu & sẵn sàng
          </Button>
        </div>
      </div>

      <QuestionEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        onSubmit={handleSubmitQuestion}
        skillSuggestions={skillSuggestions}
      />

      <Dialog open={pendingLeave !== null} onOpenChange={(open) => !open && setPendingLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bạn có thay đổi chưa lưu</DialogTitle>
            <DialogDescription>Lưu nháp để giữ lại, hoặc bỏ các thay đổi vừa làm.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                const next = pendingLeave
                setPendingLeave(null)
                next?.()
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button
              onClick={() => {
                const next = pendingLeave
                if (!persist(draft.status)) {
                  setPendingLeave(null)
                  return
                }
                toast.success(isDraft ? 'Đã lưu nháp' : 'Đã lưu')
                setPendingLeave(null)
                next?.()
              }}
            >
              {isDraft ? 'Lưu nháp & thoát' : 'Lưu & thoát'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
