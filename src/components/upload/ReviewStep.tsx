import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileImage, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import QuestionEditorSheet from '@/components/exercise-detail/QuestionEditorSheet'
import { SUBJECTS } from '@/lib/subjects'
import { TABLET_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import type { Question } from '@/lib/types'
import { makeFigure } from '@/lib/figure-client'
import type { Box } from '@/lib/figure-crop'
import ExtractedQuestionCard from './ExtractedQuestionCard'
import FigureCropDialog from './FigureCropDialog'
import SourceViewer from './SourceViewer'
import type { UploadMeta } from './UploadStep'
import { mergeQuestions, needsCheck, pageSource, type ReviewItem, type SourcePage } from './review-utils'

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
  const [savingFigure, setSavingFigure] = useState(false)
  const figurePage = figureFor ? (figureFor.figure?.page ?? figureFor.page) : 1

  const flagged = items.filter(needsCheck)
  const subject = SUBJECTS[meta.subject]

  const saveFigure = async (box: Box) => {
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
      items.map((it) => {
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
    onItemsChange(items.map((it) => (it.question.id === id ? { ...it, ...patch } : it)))

  const handleDelete = (index: number) => withUndo(items.filter((_, i) => i !== index), `Đã xóa câu ${index + 1}`)

  const handleMergeUp = (index: number) => {
    const upper = items[index - 1]
    const lower = items[index]
    const mergedQuestion = mergeQuestions(upper.question, lower.question)
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
    update(q.id, { question: q, reviewed: true })
    toast.success('Đã cập nhật câu hỏi')
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

  const questionList = items.length ? (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <ExtractedQuestionCard
          key={item.question.id}
          domId={`review-${item.question.id}`}
          item={item}
          index={i}
          onEdit={() => setEditing(item)}
          onDelete={() => handleDelete(i)}
          onMergeUp={i > 0 ? () => handleMergeUp(i) : undefined}
          onConfirm={() => update(item.question.id, { reviewed: true })}
          onShowSource={() => showSource(item.page)}
          onAdjustFigure={() => setFigureFor(item)}
          onRemoveFigure={() => removeFigure(item.question.id)}
        />
      ))}
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
            {items.length} câu · {pages.length} trang
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
              <span className="rounded-full bg-slate-200/80 px-1.5 text-xs">{items.length}</span>
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

      <FigureCropDialog
        open={figureFor !== null}
        onOpenChange={(open) => !open && setFigureFor(null)}
        pageUrl={pages[figurePage - 1]?.file.url}
        initialBox={figureFor?.figure?.box}
        title={figureFor?.question.image ? 'Chỉnh khung hình' : 'Thêm hình minh họa'}
        saving={savingFigure}
        onSave={(box) => void saveFigure(box)}
      />
    </div>
  )
}
