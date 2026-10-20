import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, FilePlus2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ProcessingStep, { type ScanPhase } from '@/components/upload/ProcessingStep'
import ReviewStep from '@/components/upload/ReviewStep'
import UploadStep, { type UploadMeta } from '@/components/upload/UploadStep'
import UploadStepper, { type UploadStepId } from '@/components/upload/UploadStepper'
import { appendScanned, draftFigurePaths, hasPlaceholder, needsCheck, pageSource, pagesFromFiles, type ReviewItem, type SourcePage, withSignedFigures } from '@/components/upload/review-utils'
import { findInvalidQuestion } from '@/components/exercise-detail/question-draft'
import { unwrap } from '@/lib/action-result'
import type { ScanResult } from '@/lib/ai/scan'
import { makeFigure } from '@/lib/figure-client'
import type { Box } from '@/lib/figure-crop'
import { shrinkImage, uploadFiles } from '@/lib/upload-client'
import { cn } from '@/lib/utils'
import { scanDocuments } from '@/server/actions/ai-scan'
import { previewSetUploads, requestSetUploads } from '@/server/actions/library'
import { clearScanDraft, loadScanDraft, saveScanDraft, type ScanDraft } from '@/lib/scan-draft'
import { useLibrary } from '@/state/library-store'
import type { Attachment, ExerciseSet } from '@/lib/types'
import type { LeaveGuard } from '@/components/layout/AppFrame'

interface UploadFlowProps {
  onClose: () => void
  onOpenSet: (id: string) => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

const STEP_COPY: Record<UploadStepId, string> = {
  upload: 'Tải ảnh chụp hoặc PDF phiếu bài tập, AI sẽ tách thành từng câu hỏi.',
  processing: 'AI đang đọc tài liệu của bạn.',
  review: 'Đối chiếu với bản gốc và sửa những câu AI chưa chắc chắn.',
}

/** Set details Claude suggested; the title is edited separately in the review step. */
type ScanDetails = Omit<ScanResult, 'items' | 'title'>

export default function UploadFlow({ onClose, onOpenSet, registerLeaveGuard }: UploadFlowProps) {
  const library = useLibrary()
  const [step, setStep] = useState<UploadStepId>('upload')
  const [files, setFiles] = useState<Attachment[]>([])
  const [meta, setMeta] = useState<UploadMeta>({ subject: 'toan', grade: 3, kind: 'luyen-tap' })
  const [items, setItems] = useState<ReviewItem[]>([])
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState<ScanDetails | null>(null)
  /** Files already scanned: the first `scannedCount` of `files` (added pages go after them and can't be removed). */
  const [scannedCount, setScannedCount] = useState(0)
  // Files are uploaded under this id before the scan, and the set is saved with it.
  const [setId, setSetId] = useState(() => crypto.randomUUID())
  /** An unsaved scan from an earlier visit (back pressed, tab closed…), offered for restore. */
  const [restorable, setRestorable] = useState<ScanDraft | null>(() => loadScanDraft())
  const [phase, setPhase] = useState<ScanPhase>('uploading')
  const [scanError, setScanError] = useState<string | null>(null)
  /** Bumped by every scan and by cancel, so the late result of a cancelled scan is ignored. */
  const scanRun = useRef(0)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const [saving, setSaving] = useState(false)

  const pages = useMemo(() => pagesFromFiles(files), [files])
  const flaggedCount = items.filter(needsCheck).length
  const incompleteCount = items.filter((i) => !i.placeholder && findInvalidQuestion([i.question])).length
  const waitingPassages = hasPlaceholder(items)
  const hasProgress = files.length > 0

  useEffect(() => {
    registerLeaveGuard((next) => (hasProgress ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [hasProgress, registerLeaveGuard])

  // Keep the review state restorable until it's saved or explicitly discarded.
  useEffect(() => {
    if (step === 'review' && items.length) saveScanDraft({ setId, meta, title, details, items, files, scannedCount })
  }, [step, setId, meta, title, details, items, files, scannedCount])

  const restoreDraft = async (draft: ScanDraft) => {
    setRestorable(null)
    setSetId(draft.setId)
    setMeta(draft.meta)
    setTitle(draft.title)
    setDetails(draft.details)
    setItems(draft.items.map((it) => (it.figureState === 'cropping' ? { ...it, figureState: 'error' as const } : it)))
    setFiles(draft.files)
    setScannedCount(draft.scannedCount ?? draft.files.length)
    setStep('review')
    // Blob previews are gone; show the uploaded copies (pages, câu and bài figures) instead.
    const paths = [...draft.files.flatMap((f) => (f.uploaded ? [f.uploaded.path] : [])), ...draftFigurePaths(draft.items)]
    try {
      const urls = unwrap(await previewSetUploads(draft.setId, paths))
      setFiles((list) => list.map((f) => (f.uploaded && urls[f.uploaded.path] ? { ...f, url: urls[f.uploaded.path] } : f)))
      setItems((list) => withSignedFigures(list, urls))
    } catch {
      toast('Không tải được ảnh xem trước', { description: 'Các câu hỏi vẫn được giữ nguyên.' })
    }
  }

  const discardDraft = () => {
    clearScanDraft()
    setRestorable(null)
  }

  /**
   * Cuts out every figure the scan found (identical boxes once) and attaches it
   * to its questions: a câu box to the câu, a bài box to the bài on all its câu.
   */
  const cropFigures = async (scanned: ReviewItem[], sourcePages: SourcePage[], run: number) => {
    const groups = new Map<string, { page: number; box: Box; ids: string[]; baiIds: string[] }>()
    const add = (figure: { page: number; box: Box }, it: ReviewItem, bai: boolean) => {
      const key = `${figure.page}:${figure.box.join(',')}`
      const group = groups.get(key) ?? { page: figure.page, box: figure.box, ids: [], baiIds: [] }
      if (bai) group.baiIds.push(it.question.id)
      else group.ids.push(it.question.id)
      groups.set(key, group)
    }
    for (const it of scanned) {
      if (it.figure) add(it.figure, it, false)
      if (it.groupFigure && it.question.group) add(it.groupFigure, it, true)
    }
    // Each crop decodes the full-size photo, so at most two run at once (iPad Safari memory).
    const queue = [...groups.values()]
    const cropNext = async (): Promise<void> => {
      const g = queue.shift()
      if (!g) return
      const all = [...g.ids, ...g.baiIds]
      const apply = (patch: (it: ReviewItem) => ReviewItem) => {
        if (run === scanRun.current) setItems((list) => list.map((it) => (all.includes(it.question.id) ? patch(it) : it)))
      }
      try {
        const source = pageSource(sourcePages[g.page - 1])
        if (!source) throw new Error('missing page')
        const { image, imageUrl, box } = await makeFigure(setId, source, g.box, { snap: true })
        apply((it) => {
          const done = { ...it, figureState: undefined }
          if (g.ids.includes(it.question.id)) return { ...done, figure: { page: g.page, box }, question: { ...it.question, image, imageUrl } }
          const group = it.question.group
          return group ? { ...done, groupFigure: { page: g.page, box }, question: { ...it.question, group: { ...group, image, imageUrl } } } : done
        })
      } catch (error) {
        console.error('Không cắt được hình minh họa', error)
        apply((it) => ({ ...it, figureState: 'error' }))
      }
      return cropNext()
    }
    await Promise.all([cropNext(), cropNext()])
  }

  /** Scans the files not scanned yet: all of them first, then pages added from the review step. */
  const startScan = async () => {
    const run = ++scanRun.current
    const adding = scannedCount > 0
    setScanError(null)
    setPhase('uploading')
    setStep('processing')
    try {
      // Upload what isn't uploaded yet (a retry reuses earlier uploads).
      let current = files
      const pending = files.filter((f) => f.file && !f.uploaded)
      if (pending.length) {
        const small = await Promise.all(pending.map((f) => shrinkImage(f.file!)))
        const uploaded = await uploadFiles(small, async (names) => unwrap(await requestSetUploads(setId, names)))
        const byId = new Map(pending.map((f, i) => [f.id, uploaded[i]]))
        const withUploads = (list: Attachment[]) => list.map((f) => (byId.has(f.id) ? { ...f, uploaded: byId.get(f.id) } : f))
        current = withUploads(files)
        setFiles(withUploads)
      }
      if (run !== scanRun.current) return
      setPhase('reading')
      const fresh = current.slice(scannedCount)
      const result = unwrap(await scanDocuments({ setId, files: fresh.flatMap((f) => (f.uploaded ? [f.uploaded] : [])), ...meta }))
      if (run !== scanRun.current) return
      const { items: scanned, title: suggested, ...rest } = result
      // The review step is hidden while scanning, so `items` is still the list the parent left.
      const existing = adding ? items : []
      const reviewItems = appendScanned(existing, scanned, pagesFromFiles(current.slice(0, scannedCount)).length)
      setItems(reviewItems)
      void cropFigures(reviewItems.slice(existing.length), pagesFromFiles(current), run)
      if (adding) {
        // Keep the first scan's title and details; the added pages take extra time.
        setDetails((d) => (d ? { ...d, estimatedMinutes: Math.min(240, d.estimatedMinutes + rest.estimatedMinutes) } : rest))
        toast.success(`Đã thêm ${scanned.length} câu từ ${fresh.length} trang mới`)
      } else {
        setTitle(suggested)
        setDetails(rest)
      }
      setScannedCount(current.length)
      setStep('review')
    } catch (e) {
      if (run !== scanRun.current) return
      const message = e instanceof Error ? e.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.'
      toast.error('Không quét được tài liệu', { description: message })
      setScanError(message)
      // Questions from earlier pages stay; the new pages wait for another try.
      setStep(adding ? 'review' : 'upload')
    }
  }

  const cancelScan = () => {
    scanRun.current++
    setStep(scannedCount > 0 ? 'review' : 'upload')
  }

  const addPages = () => setStep('upload')

  const requestCancel = () => (hasProgress ? setPendingLeave(() => onClose) : onClose())

  /** The server rejects incomplete questions: point to the first one. True when all can be saved. */
  const checkComplete = () => {
    const questions = items.map((i) => i.question)
    const invalid = findInvalidQuestion(questions)
    if (!invalid) return true
    toast.error(`Câu ${invalid.index + 1} chưa thể lưu`, { description: `${invalid.hint} Hãy sửa hoặc xóa câu này.` })
    document.getElementById(`review-${questions[invalid.index].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return false
  }

  const save = async () => {
    if (saving || !checkComplete()) return
    const questions = items.map((i) => i.question)
    const set: ExerciseSet = {
      id: setId,
      title: title.trim() || 'Phiếu bài tập đã quét',
      subject: meta.subject,
      grade: meta.grade,
      kind: meta.kind,
      topic: details?.topic ?? questions[0]?.skills[0] ?? '',
      description: details?.description || `Quét bằng AI từ ${files.length} tệp.`,
      source: 'tai-len',
      status: 'nhap',
      format: 'cau-hoi',
      questionCount: questions.length,
      estimatedMinutes: details?.estimatedMinutes ?? Math.max(10, questions.length * 3),
      difficulty: details?.difficulty ?? 3,
      timesAssigned: 0,
      createdAt: new Date().toISOString(),
    }
    setSaving(true)
    // The files were uploaded for the scan (`uploaded`), so the store saves them without uploading again.
    const ok = await library.addSet(set, questions, files)
    setSaving(false)
    if (!ok) return
    clearScanDraft()
    toast.success('Đã lưu vào kho bài tập', {
      description: `“${set.title}” · ${questions.length} câu · lưu ở dạng Nháp`,
    })
    onOpenSet(set.id)
  }

  const handleSave = () => {
    if (items.some((i) => i.figureState === 'cropping')) {
      toast('Đang cắt hình minh họa', { description: 'Chờ vài giây rồi lưu nhé.' })
      return
    }
    const failed = items.filter((i) => i.figureState === 'error').length
    if (failed && !window.confirm(`${failed} câu chưa tải được hình minh họa. Vẫn lưu mà không có hình?`)) return
    if (!items.length) {
      toast.error('Chưa có câu hỏi nào để lưu')
      return
    }
    if (waitingPassages) {
      toast.error('Đoạn văn chưa có câu hỏi', { description: 'Đưa câu hỏi vào bài hoặc xóa đoạn văn trước khi lưu.' })
      document.querySelector('[data-placeholder]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!checkComplete()) return
    if (flaggedCount > 0) setConfirmSave(true)
    else void save()
  }

  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6', step === 'review' ? 'max-w-6xl' : 'max-w-3xl')}>
      <header className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="hidden h-10 w-fit -translate-x-3 text-slate-500 md:inline-flex" onClick={requestCancel}>
          <ArrowLeft />
          Kho bài tập
        </Button>
        <div>
          <h1 className="hidden text-3xl font-bold tracking-tight text-slate-900 md:block">Tải lên tài liệu</h1>
          <p className="text-slate-500 md:mt-1.5">{STEP_COPY[step]}</p>
        </div>
        <div className="max-w-md">
          <UploadStepper current={step} />
        </div>
      </header>

      {step === 'upload' && (
        <UploadStep
          files={files}
          onFilesChange={setFiles}
          meta={meta}
          onMetaChange={setMeta}
          onScan={() => void startScan()}
          error={scanError}
          scannedCount={scannedCount}
          onBackToReview={scannedCount > 0 ? () => setStep('review') : undefined}
        />
      )}

      {step === 'processing' && <ProcessingStep pages={pages} phase={phase} onCancel={cancelScan} />}

      {step === 'review' && (
        <>
          <ReviewStep pages={pages} items={items} onItemsChange={setItems} meta={meta} title={title} onTitleChange={setTitle} setId={setId} />

          <div className="sticky bottom-0 z-30 -mx-4 border-t border-slate-200/80 bg-white/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur md:bottom-4 md:mx-0 md:flex md:items-center md:justify-between md:gap-4 md:rounded-2xl md:border md:p-3 md:pl-5">
            <p
              className={cn(
                'mb-2 flex items-center gap-1.5 text-sm font-medium md:mb-0',
                incompleteCount || waitingPassages ? 'text-red-700' : flaggedCount ? 'text-amber-700' : 'text-emerald-700',
              )}
            >
              {incompleteCount || flaggedCount || waitingPassages ? <AlertTriangle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
              {waitingPassages
                ? 'Đoạn văn chưa có câu hỏi – đưa câu vào bài hoặc xóa đoạn văn trước khi lưu'
                : incompleteCount
                ? `${incompleteCount} câu chưa đủ thông tin – sửa hoặc xóa trước khi lưu`
                : flaggedCount
                  ? `Còn ${flaggedCount} câu cần kiểm tra`
                  : 'Tất cả câu hỏi đã sẵn sàng'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 md:flex-none" disabled={saving} onClick={requestCancel}>
                Hủy
              </Button>
              <Button variant="outline" className="flex-1 md:flex-none" disabled={saving} onClick={addPages}>
                <FilePlus2 />
                Thêm trang
              </Button>
              <Button className="flex-[2] md:flex-none" disabled={saving} onClick={handleSave}>
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save />}
                Lưu vào kho bài tập
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={pendingLeave !== null} onOpenChange={(open) => !open && setPendingLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy tải lên?</DialogTitle>
            <DialogDescription>
              {items.length ? 'Các tệp và câu hỏi đã quét sẽ bị bỏ, không lưu vào kho bài tập.' : 'Các tệp đã chọn sẽ bị bỏ.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLeave(null)}>
              Tiếp tục làm
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const next = pendingLeave
                setPendingLeave(null)
                clearScanDraft()
                next?.()
              }}
            >
              Hủy tải lên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restorable !== null} onOpenChange={(open) => !open && setRestorable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khôi phục kết quả quét?</DialogTitle>
            <DialogDescription>
              {restorable &&
                `“${restorable.title || 'Phiếu bài tập đã quét'}” · ${restorable.items.length} câu, quét lúc ${new Date(restorable.savedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} nhưng chưa lưu vào kho.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={discardDraft}>
              Bỏ đi
            </Button>
            <Button onClick={() => restorable && void restoreDraft(restorable)}>Khôi phục</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSave} onOpenChange={setConfirmSave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Còn {flaggedCount} câu cần kiểm tra</DialogTitle>
            <DialogDescription>
              AI chưa chắc chắn về những câu này. Bạn vẫn có thể lưu ở dạng Nháp và sửa sau trong Kho bài tập.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSave(false)}>
              Xem lại
            </Button>
            <Button
              onClick={() => {
                setConfirmSave(false)
                void save()
              }}
            >
              Vẫn lưu nháp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
