import { useRef, useState } from 'react'
import { AlertTriangle, Camera, FolderOpen, Sparkles, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AttachmentGallery, { filesToAttachments } from '@/components/exercise-detail/AttachmentGallery'
import { MAX_SCAN_FILES, type ScanMeta } from '@/lib/ai/scan'
import { EXERCISE_KINDS, GRADES } from '@/lib/library'
import { SUBJECT_LIST } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { Attachment, ExerciseKind, SubjectId } from '@/lib/types'

export type UploadMeta = ScanMeta

interface UploadStepProps {
  files: Attachment[]
  onFilesChange: (files: Attachment[]) => void
  meta: UploadMeta
  onMetaChange: (meta: UploadMeta) => void
  onScan: () => void
  /** Why the last scan failed, shown above the scan button. */
  error?: string | null
}

export default function UploadStep({ files, onFilesChange, meta, onMetaChange, onScan, error }: UploadStepProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const tooMany = files.length > MAX_SCAN_FILES

  const addFiles = (list: FileList | null) => {
    if (list?.length) onFilesChange([...files, ...filesToAttachments(list)])
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center rounded-3xl border-2 border-dashed px-5 py-10 text-center transition-colors md:py-14',
          dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white',
        )}
      >
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-2xl transition-transform',
            dragging ? 'scale-110 bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600',
          )}
        >
          <UploadCloud className="size-8" />
        </span>
        <p className="mt-4 text-lg font-bold text-slate-900">Kéo thả ảnh hoặc PDF vào đây</p>
        <p className="mt-1 text-sm text-slate-500">Phiếu bài tập, đề kiểm tra, trang sách · JPG, PNG, PDF</p>
        <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" size="lg" className="sm:flex-1" onClick={() => cameraInput.current?.click()}>
            <Camera className="size-5" />
            Chụp ảnh
          </Button>
          <Button variant="secondary" size="lg" className="sm:flex-1" onClick={() => fileInput.current?.click()}>
            <FolderOpen className="size-5" />
            Chọn tệp
          </Button>
        </div>
        <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {files.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold text-slate-900">Tệp đã chọn</h2>
            <span className="text-sm text-slate-500">{files.length} tệp</span>
          </div>
          <AttachmentGallery attachments={files} onChange={onFilesChange} showAdd={false} />
        </section>
      )}

      <Card className="gap-4 p-4 md:p-6">
        <div>
          <h2 className="font-bold text-slate-900">Thông tin bộ bài</h2>
          <p className="text-sm text-slate-500">Giúp AI nhận dạng câu hỏi chính xác hơn.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Môn</Label>
            <Select value={meta.subject} onValueChange={(v) => onMetaChange({ ...meta, subject: v as SubjectId })}>
              <SelectTrigger aria-label="Môn" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_LIST.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <s.icon className={cn('size-4', s.text)} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Lớp</Label>
            <Select value={String(meta.grade)} onValueChange={(v) => onMetaChange({ ...meta, grade: Number(v) })}>
              <SelectTrigger aria-label="Lớp" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Lớp {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
            <Label>Loại</Label>
            <Select value={meta.kind} onValueChange={(v) => onMetaChange({ ...meta, kind: v as ExerciseKind })}>
              <SelectTrigger aria-label="Loại" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXERCISE_KINDS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
          <div>
            <p className="font-bold">Chưa quét được tài liệu</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <Button
          size="lg"
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
          disabled={files.length === 0 || tooMany}
          onClick={onScan}
        >
          <Sparkles className="size-5" />
          {error ? 'Quét lại bằng AI' : 'Quét bằng AI'}
        </Button>
        {files.length === 0 && <p className="text-center text-xs text-slate-400 sm:text-right">Thêm ít nhất một tệp để bắt đầu quét.</p>}
        {tooMany && (
          <p className="text-center text-xs font-medium text-amber-700 sm:text-right">
            Mỗi lần quét tối đa {MAX_SCAN_FILES} tệp – hãy bỏ bớt {files.length - MAX_SCAN_FILES} tệp.
          </p>
        )}
      </div>
    </div>
  )
}
