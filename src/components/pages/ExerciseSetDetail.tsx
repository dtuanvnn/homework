import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Layers, Loader2, Plus, Save, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ExerciseMetaForm from '@/components/exercise-detail/ExerciseMetaForm'
import GroupEditorSheet, { type GroupEdit } from '@/components/exercise-detail/GroupEditorSheet'
import QuestionEditorSheet from '@/components/exercise-detail/QuestionEditorSheet'
import QuestionList from '@/components/exercise-detail/QuestionList'
import SuggestGroupsSheet from '@/components/exercise-detail/SuggestGroupsSheet'
import SectionHeader from '@/components/shared/SectionHeader'
import SubjectIcon from '@/components/shared/SubjectIcon'
import { unwrap } from '@/lib/action-result'
import { formatScoreValue, formatVietnameseDate } from '@/lib/format'
import { checkGroups, groupBlocks } from '@/lib/question-groups'
import { deleteGroup, setGroupPoints, suggestGroups, updateGroup } from '@/lib/question-groups-edit'
import { totalPoints } from '@/lib/questions'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/state/library-store'
import { solveQuestion } from '@/server/actions/ai-solve'
import { mergeSolution } from '@/lib/ai/solve'
import type { Attachment, ExerciseSet, ExerciseSetStatus, Question } from '@/lib/types'

import { useRequiredStudent, type LeaveGuard } from '@/components/layout/AppFrame'

interface ExerciseSetDetailProps {
  initialSet: ExerciseSet
  initialQuestions: Question[]
  initialAttachments: Attachment[]
  onClose: () => void
  /** Called by the shell before navigating away; `next` runs once leaving is confirmed. */
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

type SaveAction = 'nhap' | 'san-sang' | 'assign' | 'leave' | 'solve'

/** AI solves this many questions at once (each is its own request). */
const SOLVE_CONCURRENCY = 3

/** A save that uploads new files, kept until the store returns the stored list. */
interface InFlightSave {
  set: ExerciseSet
  questions: Question[]
  attachments: Attachment[]
  /** `filesKey` of the stored list when the save started. */
  storedKey: string
}

const filesKey = (attachments: Attachment[]) => attachments.map((a) => a.id).join('|')

function snapshot(set: ExerciseSet, questions: Question[], attachments: Attachment[]) {
  const { status: _status, timesAssigned: _t, questionCount: _q, ...meta } = set
  return JSON.stringify([meta, questions, attachments.map((a) => a.id)])
}

export default function ExerciseSetDetail({
  initialSet,
  initialQuestions,
  initialAttachments,
  onClose,
  registerLeaveGuard,
}: ExerciseSetDetailProps) {
  const library = useLibrary()
  const student = useRequiredStudent()
  const setId = initialSet.id

  const [draft, setDraft] = useState<ExerciseSet>(initialSet)
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments)
  const [baseline, setBaseline] = useState(() => snapshot(initialSet, initialQuestions, initialAttachments))
  const [saving, setSaving] = useState<SaveAction | null>(null)
  const [inFlight, setInFlight] = useState<InFlightSave | null>(null)
  const [titleError, setTitleError] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  /** Bài open in "Sửa bài". */
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestGroups> | null>(null)

  const dirty = snapshot(draft, questions, attachments) !== baseline
  const points = totalPoints(questions)
  const timesAssigned = library.getSet(setId)?.timesAssigned ?? initialSet.timesAssigned

  // Newly picked files are uploaded on save. Once the store holds the saved
  // list (stored rows with real URLs), swap it in for the local previews.
  const storedAttachments = library.getAttachments(setId)
  if (inFlight && filesKey(storedAttachments) !== inFlight.storedKey) {
    setInFlight(null)
    setAttachments([...storedAttachments, ...attachments.filter((a) => !inFlight.attachments.includes(a))])
    setBaseline(snapshot(inFlight.set, inFlight.questions, storedAttachments))
  }

  const skillSuggestions = useMemo(() => {
    const all = new Set<string>()
    if (draft.topic) all.add(draft.topic)
    questions.forEach((q) => q.skills.forEach((s) => all.add(s)))
    return [...all]
  }, [draft.topic, questions])

  useEffect(() => {
    registerLeaveGuard((next) => (dirty ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [dirty, registerLeaveGuard])

  /** Saves the set; `list` replaces the questions in state (a save right after AI solving, before state catches up). */
  const persist = async (status: ExerciseSetStatus, action: SaveAction, list: Question[] = questions): Promise<boolean> => {
    if (saving) return false
    const questions = list
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
    const groupError = checkGroups(questions)
    if (groupError) {
      toast.error(groupError)
      return false
    }
    const next = { ...draft, title: draft.title.trim(), status }
    const uploads = attachments.some((a) => a.file)
    setSaving(action)
    if (uploads) setInFlight({ set: next, questions, attachments, storedKey: filesKey(storedAttachments) })
    try {
      const ok = await library.saveSet(next, questions, attachments)
      if (!ok) {
        setInFlight(null)
        return false
      }
      // With uploads, the baseline moves once the stored files arrive (see above).
      if (!uploads) setBaseline(snapshot(next, questions, attachments))
      setDraft((d) => ({ ...d, title: d.title.trim(), status }))
      return true
    } finally {
      setSaving(null)
    }
  }

  const handleSaveDraft = async () => {
    if (await persist('nhap', 'nhap')) toast.success('Đã lưu nháp')
  }

  const handleSaveReady = async () => {
    if (await persist('san-sang', 'san-sang')) toast.success('Đã lưu · Bộ bài sẵn sàng để giao')
  }

  const handleAssign = async () => {
    if (saving) return
    if ((dirty || draft.status !== 'san-sang') && !(await persist('san-sang', 'assign'))) return
    setSaving('assign')
    const assignment = await library.assignSet(draft.id)
    setSaving(null)
    if (!assignment) return
    toast.success(`Đã giao bài cho ${student.name}`, {
      description: `“${draft.title.trim()}” · Hạn ${formatVietnameseDate(assignment.dueDate)}`,
    })
  }

  const [solving, setSolving] = useState<ReadonlySet<string>>(new Set())
  const latestQuestions = useRef(questions)
  useEffect(() => {
    latestQuestions.current = questions
  }, [questions])
  const keylessCount = questions.filter((q) => q.answerStatus === 'missing').length

  /** "Giải đáp án": AI solves `targets` a few at a time, then the set is saved with their keys and solutions. */
  const solve = async (targets: Question[]) => {
    if (!targets.length || solving.size || saving) return
    setSolving(new Set(targets.map((q) => q.id)))
    const solved = new Map<string, Question>()
    const errors: string[] = []
    const queue = [...targets]
    const next = async (): Promise<void> => {
      const q = queue.shift()
      if (!q) return
      try {
        // The server drops the signed picture URLs; keep them so the pictures stay on screen.
        const answered = unwrap(await solveQuestion({ setId, subject: draft.subject, grade: draft.grade, question: q }))
        // Only the answer is taken: the câu may have been edited (or put in a bài) while the AI worked.
        solved.set(q.id, answered)
        setQuestions((prev) => prev.map((x) => (x.id === q.id ? mergeSolution(x, answered) : x)))
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Vui lòng thử lại.')
      } finally {
        setSolving((prev) => new Set([...prev].filter((id) => id !== q.id)))
      }
      return next()
    }
    await Promise.all(Array.from({ length: SOLVE_CONCURRENCY }, next))
    if (errors.length) toast.error(`Chưa giải được ${errors.length} câu`, { description: errors[0] })
    if (!solved.size) return
    // State may not hold the last results yet: apply them to the latest list before saving.
    if (await persist(draft.status, 'solve', latestQuestions.current.map((x) => (solved.has(x.id) ? mergeSolution(x, solved.get(x.id)!) : x)))) {
      const unsure = [...solved.values()].filter((q) => q.answerStatus === 'ai-check').length
      toast.success(`Đã giải và lưu ${solved.size} câu`, unsure ? { description: `${unsure} câu AI chưa chắc chắn – xem các câu có nhãn “cần kiểm tra”.` } : undefined)
    }
  }

  const patchDraft = (patch: Partial<ExerciseSet>) => {
    if (patch.title !== undefined && patch.title.trim()) setTitleError(false)
    setDraft((d) => ({ ...d, ...patch }))
  }

  const spinnerOr = (action: SaveAction, icon: React.ReactNode) =>
    saving === action ? <Loader2 className="animate-spin" aria-hidden /> : icon

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

  const handleDeleteGroup = (groupId: string) => {
    const before = questions
    const block = groupBlocks(before).find((b) => b.kind === 'group' && b.group.id === groupId)
    setQuestions(deleteGroup(before, groupId))
    toast(`Đã xoá ${block?.kind === 'group' ? block.title : 'bài'}`, { action: { label: 'Hoàn tác', onClick: () => setQuestions(before) } })
  }

  const editingGroup = editingGroupId ? groupBlocks(questions).find((b) => b.kind === 'group' && b.group.id === editingGroupId) : undefined
  const handleSubmitGroup = ({ total, ...shared }: GroupEdit) => {
    if (!editingGroupId) return
    const id = editingGroupId
    setQuestions((prev) => {
      const next = updateGroup(prev, id, shared)
      return total === null ? next : setGroupPoints(next, id, total)
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
            <Button variant="outline" disabled={saving !== null} onClick={handleAssign}>
              {spinnerOr('assign', <Send />)}
              Giao bài này
            </Button>
            <Button variant="secondary" disabled={saving !== null} onClick={handleSaveDraft}>
              {spinnerOr('nhap', <Save />)}
              Lưu nháp
            </Button>
            <Button disabled={saving !== null} onClick={handleSaveReady}>
              {spinnerOr('san-sang', <CheckCircle2 />)}
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
            <div className="flex gap-2">
              {keylessCount > 0 && (
                <Button
                  variant="outline"
                  className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                  disabled={solving.size > 0 || saving !== null}
                  onClick={() => void solve(questions.filter((q) => q.answerStatus === 'missing'))}
                >
                  {solving.size ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {solving.size ? `Đang giải… còn ${solving.size} câu` : `Giải đáp án (${keylessCount} câu)`}
                </Button>
              )}
              {questions.length >= 2 && draft.format !== 'flashcard' && (
                <Button variant="outline" onClick={() => setSuggestion(suggestGroups(questions))}>
                  <Layers />
                  Tự chia bài
                </Button>
              )}
              <Button variant="outline" className="hidden md:inline-flex" onClick={openAdd}>
                <Plus />
                Thêm câu hỏi
              </Button>
            </div>
          }
        />

        {questions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
            <p className="font-semibold text-slate-900">Chưa có câu hỏi nào</p>
            <p className="mt-1 text-sm text-slate-500">Thêm câu trắc nghiệm, điền chỗ trống, nối, tự luận…</p>
          </div>
        ) : (
          <QuestionList
            questions={questions}
            onChange={setQuestions}
            onEdit={openEdit}
            onDelete={handleDeleteQuestion}
            onEditGroup={setEditingGroupId}
            onDeleteGroup={handleDeleteGroup}
            onSolve={(q) => void solve([q])}
            solving={solving}
          />
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
          <span className={cn('text-xs font-medium', dirty && !saving ? 'text-amber-700' : 'text-slate-400')}>
            {saving ? 'Đang lưu…' : dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu mọi thay đổi'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 h-11 text-indigo-700 hover:bg-indigo-50"
            disabled={saving !== null}
            onClick={handleAssign}
          >
            {spinnerOr('assign', <Send />)}
            Giao bài này
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={saving !== null} onClick={handleSaveDraft}>
            {spinnerOr('nhap', null)}
            Lưu nháp
          </Button>
          <Button className="flex-[1.4]" disabled={saving !== null} onClick={handleSaveReady}>
            {spinnerOr('san-sang', null)}
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
        setId={setId}
        sources={attachments.filter((a) => a.kind === 'image' && a.url).map((a, i) => ({ label: `trang ${i + 1}`, source: a.url!, url: a.url }))}
      />

      <GroupEditorSheet
        open={editingGroup !== undefined}
        onOpenChange={(open) => !open && setEditingGroupId(null)}
        group={editingGroup?.kind === 'group' ? editingGroup.group : null}
        title={editingGroup?.kind === 'group' ? editingGroup.title : ''}
        count={editingGroup?.kind === 'group' ? editingGroup.items.length : 0}
        points={editingGroup?.kind === 'group' ? totalPoints(editingGroup.items.map((x) => x.item)) : 0}
        setId={setId}
        sources={attachments.filter((a) => a.kind === 'image' && a.url).map((a, i) => ({ label: `trang ${i + 1}`, source: a.url!, url: a.url }))}
        onSubmit={handleSubmitGroup}
      />

      <SuggestGroupsSheet
        open={suggestion !== null}
        onOpenChange={(open) => !open && setSuggestion(null)}
        groups={suggestion?.groups ?? []}
        onApply={() => {
          if (!suggestion) return
          setQuestions(suggestion.questions)
          toast.success(`Đã chia ${suggestion.groups.length} bài`, { description: 'Nhớ lưu để giữ thay đổi.' })
        }}
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
              disabled={saving !== null}
              onClick={() => {
                const next = pendingLeave
                setPendingLeave(null)
                next?.()
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button
              disabled={saving !== null}
              onClick={async () => {
                const next = pendingLeave
                if (!(await persist(draft.status, 'leave'))) {
                  setPendingLeave(null)
                  return
                }
                toast.success(isDraft ? 'Đã lưu nháp' : 'Đã lưu')
                setPendingLeave(null)
                next?.()
              }}
            >
              {spinnerOr('leave', null)}
              {isDraft ? 'Lưu nháp & thoát' : 'Lưu & thoát'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
