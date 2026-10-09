import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ProcessingStep from '@/components/upload/ProcessingStep'
import ReviewStep from '@/components/upload/ReviewStep'
import UploadStep, { type UploadMeta } from '@/components/upload/UploadStep'
import UploadStepper, { type UploadStepId } from '@/components/upload/UploadStepper'
import { needsCheck, pagesFromFiles, type ReviewItem } from '@/components/upload/review-utils'
import { TODAY } from '@/data/mock-data'
import { mockScan } from '@/data/scan-mock'
import { formatDayMonth } from '@/lib/format'
import { uid } from '@/lib/questions'
import { SUBJECTS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/state/library-store'
import type { Attachment, Difficulty } from '@/lib/types'
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

export default function UploadFlow({ onClose, onOpenSet, registerLeaveGuard }: UploadFlowProps) {
  const library = useLibrary()
  const [step, setStep] = useState<UploadStepId>('upload')
  const [files, setFiles] = useState<Attachment[]>([])
  const [meta, setMeta] = useState<UploadMeta>({ subject: 'toan', grade: 3, kind: 'luyen-tap' })
  const [items, setItems] = useState<ReviewItem[]>([])
  const [title, setTitle] = useState('')
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)

  const pages = useMemo(() => pagesFromFiles(files), [files])
  const flaggedCount = items.filter(needsCheck).length
  const hasProgress = files.length > 0

  useEffect(() => {
    registerLeaveGuard((next) => (hasProgress ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [hasProgress, registerLeaveGuard])

  const handleScanDone = useCallback(() => {
    setItems(mockScan(meta.subject, pages.length).map((s) => ({ ...s, reviewed: false })))
    setTitle(`Phiếu bài tập ${SUBJECTS[meta.subject].name} ${meta.grade} – ${formatDayMonth(TODAY)}`)
    setStep('review')
  }, [meta.subject, meta.grade, pages.length])

  const requestCancel = () => (hasProgress ? setPendingLeave(() => onClose) : onClose())

  const save = () => {
    const questions = items.map((i) => i.question)
    const avgDifficulty = Math.round(questions.reduce((s, q) => s + q.points, 0) / Math.max(1, questions.length) + 1.5)
    const set = {
      id: uid('bt'),
      title: title.trim() || 'Phiếu bài tập đã quét',
      subject: meta.subject,
      grade: meta.grade,
      kind: meta.kind,
      topic: questions[0]?.skills[0] ?? '',
      description: `Quét bằng AI từ ${files.length} tệp (${pages.length} trang).`,
      source: 'tai-len' as const,
      status: 'nhap' as const,
      questionCount: questions.length,
      estimatedMinutes: Math.max(10, questions.length * 3),
      difficulty: Math.min(5, Math.max(1, avgDifficulty)) as Difficulty,
      timesAssigned: 0,
      createdAt: TODAY.toISOString(),
    }
    library.addSet(set, questions, files)
    toast.success('Đã lưu vào kho bài tập', {
      description: `“${set.title}” · ${questions.length} câu · lưu ở dạng Nháp`,
      action: { label: 'Mở', onClick: () => onOpenSet(set.id) },
    })
    onClose()
  }

  const handleSave = () => {
    if (!items.length) {
      toast.error('Chưa có câu hỏi nào để lưu')
      return
    }
    if (flaggedCount > 0) setConfirmSave(true)
    else save()
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

      {step === 'upload' && <UploadStep files={files} onFilesChange={setFiles} meta={meta} onMetaChange={setMeta} onScan={() => setStep('processing')} />}

      {step === 'processing' && <ProcessingStep pages={pages} onDone={handleScanDone} onCancel={() => setStep('upload')} />}

      {step === 'review' && (
        <>
          <ReviewStep pages={pages} items={items} onItemsChange={setItems} meta={meta} title={title} onTitleChange={setTitle} />

          <div className="sticky bottom-0 z-30 -mx-4 border-t border-slate-200/80 bg-white/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur md:bottom-4 md:mx-0 md:flex md:items-center md:justify-between md:gap-4 md:rounded-2xl md:border md:p-3 md:pl-5">
            <p className={cn('mb-2 flex items-center gap-1.5 text-sm font-medium md:mb-0', flaggedCount ? 'text-amber-700' : 'text-emerald-700')}>
              {flaggedCount ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
              {flaggedCount ? `Còn ${flaggedCount} câu cần kiểm tra` : 'Tất cả câu hỏi đã sẵn sàng'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 md:flex-none" onClick={requestCancel}>
                Hủy
              </Button>
              <Button className="flex-[2] md:flex-none" onClick={handleSave}>
                <Save />
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
                next?.()
              }}
            >
              Hủy tải lên
            </Button>
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
                save()
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
