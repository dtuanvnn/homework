import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileImage, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import QuestionEditorSheet from '@/components/exercise-detail/QuestionEditorSheet'
import GroupEditorSheet, { type GroupEdit } from '@/components/exercise-detail/GroupEditorSheet'
import { groupBlocks } from '@/lib/question-groups'
import {
  canRelease,
  hasBlanks,
  isBlankQuestion,
  joinGroup,
  joinPreviousGroup,
  mergeBlanks,
  releaseQuestion,
  splitGroupAt,
  ungroup,
  updateGroup,
} from '@/lib/question-groups-edit'
import { SUBJECTS } from '@/lib/subjects'
import { TABLET_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import type { Question } from '@/lib/types'
import { makeFigure } from '@/lib/figure-client'
import type { Box } from '@/lib/figure-crop'
import ExtractedQuestionCard from './ExtractedQuestionCard'
import ReviewGroupCard from './ReviewGroupCard'
import FigureCropDialog from './FigureCropDialog'
import SourceViewer from './SourceViewer'
import type { UploadMeta } from './UploadStep'
import { deletePassage, fillPlaceholder, mergeQuestions, needsCheck, pageSource, withQuestions, type ReviewItem, type SourcePage } from './review-utils'

interface ReviewStepProps {
  pages: SourcePage[]
  items: ReviewItem[]
  onItemsChange: (items: ReviewItem[]) => void
  meta: UploadMeta
  title: string
  onTitleChange: (title: string) => void
  setId: string
}

export default function ReviewStep({ pages, items, onItemsChange, meta, title, onTitleChange, setId }: ReviewStepProps) {
  const isTablet = useMediaQuery(TABLET_QUERY)
  const [tab, setTab] = useState<'source' | 'questions'>('questions')
  const [activePage, setActivePage] = useState(1)
  const [editing, setEditing] = useState<ReviewItem | null>(null)
  const latestItems = useRef(items)
  useEffect(() => {
    latestItems.current = items
  }, [items])
  const [figureFor, setFigureFor] = useState<ReviewItem | null>(null)
  /** The bài whose shared figure is being cropped (FigureCropDialog is shared with câu figures). */
  const [groupFigureFor, setGroupFigureFor] = useState<ReviewItem | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [savingFigure, setSavingFigure] = useState(false)
  const cropping = figureFor ?? groupFigureFor
  const figurePage = figureFor
    ? (figureFor.figure?.page ?? figureFor.page)
    : groupFigureFor
      ? (groupFigureFor.groupFigure?.page ?? groupFigureFor.page)
      : 1

  const flagged = items.filter(needsCheck)
  const subject = SUBJECTS[meta.subject]

  const saveGroupFigure = async (box: Box) => {
    const groupId = groupFigureFor?.question.group?.id
    const source = pageSource(pages[figurePage - 1])
    if (!groupId || !source) return
    setSavingFigure(true)
    try {
      const { image, imageUrl } = await makeFigure(setId, source, box)
      onItemsChange(
        latestItems.current.map((it) =>
          it.question.group?.id === groupId
            ? { ...it, figureState: undefined, groupFigure: { page: figurePage, box }, question: { ...it.question, group: { ...it.question.group, image, imageUrl } } }
            : it,
        ),
      )
      setGroupFigureFor(null)
    } catch {
      toast.error('Không tải được hình', { description: 'Kiểm tra mạng rồi thử lại.' })
    } finally {
      setSavingFigure(false)
    }
  }

  const saveFigure = async (box: Box) => {
    if (groupFigureFor) return saveGroupFigure(box)
    if (!figureFor) return
    const id = figureFor.question.id
    const source = pageSource(pages[figurePage - 1])
    if (!source) return
    setSavingFigure(true)
    try {
      const { image, imageUrl } = await makeFigure(setId, source, box)
      // Read the latest items: the parent may have edited other cards while this uploaded.
      onItemsChange(
        latestItems.current.map((it) =>
          it.question.id === id
            ? { ...it, reviewed: true, figureState: undefined, figure: { page: figurePage, box }, question: { ...it.question, image, imageUrl } }
            : it,
        ),
      )
      setFigureFor(null)
    } catch {
      toast.error('Không tải được hình', { description: 'Kiểm tra mạng rồi thử lại.' })
    } finally {
      setSavingFigure(false)
    }
  }

  const removeFigure = (id: string) =>
    onItemsChange(
      latestItems.current.map((it) => {
        if (it.question.id !== id) return it
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove image properties
        const { image: _image, imageUrl: _url, ...question } = it.question
        return { ...it, figure: undefined, figureState: undefined, reviewed: true, question: question as Question }
      }),
    )

  const withUndo = (next: ReviewItem[], message: string) => {
    const previous = items
    onItemsChange(next)
    toast(message, { action: { label: 'Hoàn tác', onClick: () => onItemsChange(previous) } })
  }

  const update = (id: string, patch: Partial<ReviewItem>) =>
    onItemsChange(latestItems.current.map((it) => (it.question.id === id ? { ...it, ...patch } : it)))

  const handleDelete = (index: number) => {
    // A blank câu answers one "___" of its passage: it goes with the whole passage ("Bỏ bài" merges them back).
    if (isBlankQuestion(items[index].question)) {
      toast('Câu này là một chỗ trống của đoạn văn', { description: 'Dùng "Bỏ bài" để gộp lại thành một câu điền chỗ trống.' })
      return
    }
    withUndo(items.filter((_, i) => i !== index), `Đã xóa câu ${index + 1}`)
  }

  /** A bài move on the questions (lib/question-groups-edit.ts), with undo. */
  const applyGroups = (next: Question[], message: string) => withUndo(withQuestions(items, next), message)
  const questionsNow = () => items.map((it) => it.question)
  const allQuestions = questionsNow()
  /** Offer a bài move only when it changes something (the helpers refuse moves that would break a split passage). */
  const changes = (next: Question[]) => next !== allQuestions

  const handleMergeUp = (index: number) => {
    const upper = items[index - 1]
    const lower = items[index]
    // The merged câu stays where the upper one was: in its bài, or standalone.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- replaced by the upper câu's bài
    const { group: _group, ...plain } = mergeQuestions(upper.question, lower.question)
    const mergedQuestion = (upper.question.group ? { ...plain, group: upper.question.group } : plain) as Question
    const image = upper.question.image ?? lower.question.image
    const merged: ReviewItem = {
      ...upper,
      question: image
        ? ({ ...mergedQuestion, image, imageUrl: upper.question.image ? upper.question.imageUrl : lower.question.imageUrl } as Question)
        : mergedQuestion,
      figure: upper.figure ?? lower.figure,
      figureState: upper.figureState ?? lower.figureState,
      confidence: Math.max(upper.confidence, lower.confidence),
      reviewed: true,
      note: undefined,
    }
    withUndo([...items.slice(0, index - 1), merged, ...items.slice(index + 1)], `Đã gộp câu ${index + 1} vào câu ${index}`)
  }

  const handleSubmitEdit = (q: Question) => {
    const before = latestItems.current.find((it) => it.question.id === q.id)
    // The picture was removed in the editor: drop its crop box too, so the card stops offering "Chỉnh khung / Bỏ hình".
    const dropFigure = before?.question.image && !q.image ? { figure: undefined, figureState: undefined } : {}
    update(q.id, { question: q, reviewed: true, ...dropFigure })
    toast.success('Đã cập nhật câu hỏi')
  }

  const editingBlock = editingGroupId ? groupBlocks(items.map((it) => it.question)).find((b) => b.kind === 'group' && b.group.id === editingGroupId) : undefined
  const editingGroup = editingBlock?.kind === 'group' ? editingBlock : undefined
  const submitGroup = (edit: GroupEdit) => {
    if (!editingGroupId) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- points are set after saving
    const { total: _total, ...shared } = edit
    onItemsChange(withQuestions(latestItems.current, updateGroup(latestItems.current.map((it) => it.question), editingGroupId, shared)))
    toast.success('Đã cập nhật bài')
  }

  const showSource = (page: number) => {
    setActivePage(page)
    if (!isTablet) setTab('source')
  }

  const jumpToFlagged = () => {
    const first = flagged[0]
    if (!first) return
    if (!isTablet) setTab('questions')
    requestAnimationFrame(() => {
      document.getElementById(`review-${first.question.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActivePage(first.page)
    })
  }

  const viewer = (
    <SourceViewer
      pages={pages}
      activePage={activePage}
      onPageChange={setActivePage}
      items={items}
      className={isTablet ? 'h-full' : 'h-[68dvh]'}
    />
  )

  // Câu numbers skip a passage still waiting for its câu.
  const numbers = new Map<string, number>()
  items.forEach((it) => {
    if (!it.placeholder) numbers.set(it.question.id, numbers.size + 1)
  })
  const card = (item: ReviewItem, i: number) => {
    const q = item.question
    const prev = items[i - 1]
    const next = items[i + 1]
    const groupActions: { label: string; onSelect: () => void }[] = []
    if (q.group) {
      if (prev?.question.group?.id === q.group.id && !prev.placeholder && changes(splitGroupAt(allQuestions, q.id)))
        groupActions.push({ label: 'Tách thành bài riêng', onSelect: () => applyGroups(splitGroupAt(questionsNow(), q.id), 'Đã tách thành bài riêng') })
      if (canRelease(questionsNow(), q.id)) groupActions.push({ label: 'Đưa ra khỏi bài', onSelect: () => applyGroups(releaseQuestion(questionsNow(), q.id), 'Đã đưa câu ra khỏi bài') })
    } else {
      if (prev?.question.group && !prev.placeholder)
        groupActions.push({ label: 'Đưa vào bài trên', onSelect: () => applyGroups(joinGroup(questionsNow(), q.id, 'up'), 'Đã đưa câu vào bài') })
      if (next?.question.group && !next.placeholder)
        groupActions.push({ label: 'Đưa vào bài dưới', onSelect: () => applyGroups(joinGroup(questionsNow(), q.id, 'down'), 'Đã đưa câu vào bài') })
    }
    const canMerge = i > 0 && !prev?.placeholder && !isBlankQuestion(q) && !(prev && isBlankQuestion(prev.question))
    return (
      <ExtractedQuestionCard
        key={q.id}
        domId={`review-${q.id}`}
        item={item}
        index={(numbers.get(q.id) ?? i + 1) - 1}
        onEdit={() => setEditing(item)}
        onDelete={() => handleDelete(i)}
        onMergeUp={canMerge ? () => handleMergeUp(i) : undefined}
        onConfirm={() => update(q.id, { reviewed: true })}
        onShowSource={() => showSource(item.page)}
        onAdjustFigure={() => setFigureFor(item)}
        onRemoveFigure={() => removeFigure(q.id)}
        groupActions={groupActions}
      />
    )
  }

  const blocks = groupBlocks(items.map((it) => it.question))
  const questionList = items.length ? (
    <ol className="flex flex-col gap-3">
      {blocks.map((block, b) => {
        if (block.kind === 'single') return card(items[block.number - 1], block.number - 1)
        const first = block.items[0].number - 1
        const members = block.items.map((x) => items[x.number - 1])
        const waiting = members.every((m) => m.placeholder)
        const above = blocks[b - 1]
        const below = items[block.items[block.items.length - 1].number]
        return (
          <ReviewGroupCard
            key={block.group.id}
            group={block.group}
            title={block.title}
            waiting={waiting}
            cropping={members.some((m) => m.figureState === 'cropping')}
            onEdit={() => setEditingGroupId(block.group.id)}
            onAdjustFigure={() => setGroupFigureFor(items[first])}
            onJoinAbove={
              above?.kind === 'group' && !waiting && changes(joinPreviousGroup(allQuestions, block.group.id))
                ? () => applyGroups(joinPreviousGroup(questionsNow(), block.group.id), `Đã gộp ${block.title} vào bài trên`)
                : undefined
            }
            onUngroup={() =>
              applyGroups(
                hasBlanks(allQuestions, block.group.id) ? mergeBlanks(allQuestions, block.group.id) : ungroup(allQuestions, block.group.id),
                `Đã bỏ ${block.title}`,
              )
            }
            onFillFromBelow={waiting && below && !below.question.group ? () => withUndo(fillPlaceholder(items, items[first].question.id), 'Đã đưa câu vào bài') : undefined}
            onDeletePassage={() => withUndo(deletePassage(items, block.group.id), 'Đã xóa đoạn văn')}
          >
            {block.items.map((x) => card(items[x.number - 1], x.number - 1))}
          </ReviewGroupCard>
        )
      })}
    </ol>
  ) : (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
      Đã xóa hết câu hỏi. Nhấn Hủy để tải tài liệu khác.
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <Card className="gap-4 p-4 md:flex-row md:items-end md:p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="scan-title">Tên bộ bài</Label>
          <Input id="scan-title" value={title} onChange={(e) => onTitleChange(e.target.value)} className="h-12 text-base font-semibold md:text-base" />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:pb-1.5">
          <span className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold', subject.softBg, subject.text)}>
            <subject.icon className="size-4" />
            {subject.name} {meta.grade}
          </span>
          <span className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-600">
            {numbers.size} câu · {pages.length} trang
          </span>
          {flagged.length > 0 && (
            <button
              type="button"
              onClick={jumpToFlagged}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-200"
            >
              <AlertTriangle className="size-4" />
              {flagged.length} cần kiểm tra
            </button>
          )}
        </div>
      </Card>

      {isTablet ? (
        <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-5">
          <div className="sticky top-6 h-[calc(100dvh-140px)] min-h-96">{viewer}</div>
          <section aria-label="Câu hỏi đã quét">{questionList}</section>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'source' | 'questions')} className="flex flex-col gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="source">
              <FileImage />
              Bản gốc
            </TabsTrigger>
            <TabsTrigger value="questions">
              <ListChecks />
              Câu hỏi đã quét
              <span className="rounded-full bg-slate-200/80 px-1.5 text-xs">{numbers.size}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="source">{viewer}</TabsContent>
          <TabsContent value="questions">{questionList}</TabsContent>
        </Tabs>
      )}

      <QuestionEditorSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        editing={editing?.question ?? null}
        onSubmit={handleSubmitEdit}
        skillSuggestions={[...new Set(items.flatMap((i) => i.question.skills))]}
        setId={setId}
        sources={pages.flatMap((p) => { const s = pageSource(p); return s ? [{ label: `trang ${p.index}`, source: s, url: p.file.url }] : [] })}
      />

      <GroupEditorSheet
        open={editingGroup !== undefined}
        onOpenChange={(open) => !open && setEditingGroupId(null)}
        group={editingGroup?.group ?? null}
        title={editingGroup?.title ?? ''}
        count={editingGroup?.items.length ?? 0}
        points={0}
        setId={setId}
        sources={pages.flatMap((p) => {
          const s = pageSource(p)
          return s ? [{ label: `trang ${p.index}`, source: s, url: p.file.url }] : []
        })}
        previewOnly
        onSubmit={submitGroup}
      />

      <FigureCropDialog
        open={cropping !== null}
        onOpenChange={(open) => {
          if (open) return
          setFigureFor(null)
          setGroupFigureFor(null)
        }}
        pageUrl={pages[figurePage - 1]?.file.url}
        initialBox={figureFor ? figureFor.figure?.box : groupFigureFor?.groupFigure?.box}
        title={
          groupFigureFor
            ? groupFigureFor.question.group?.image
              ? 'Chỉnh khung hình chung'
              : 'Thêm hình chung'
            : figureFor?.question.image
              ? 'Chỉnh khung hình'
              : 'Thêm hình minh họa'
        }
        saving={savingFigure}
        onSave={(box) => void saveFigure(box)}
      />
    </div>
  )
}
