import { useEffect, useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { SourcePage } from './review-utils'

/** Which part of the scan is running: the browser uploading files, or Claude reading them. */
export type ScanPhase = 'uploading' | 'reading'

/** The scanner shows the next page thumbnail this often while Claude reads. */
const PAGE_CYCLE_MS = 2500
/** Time constant of the (estimated) progress curve; a scan usually takes 30 s – 2 min. */
const PROGRESS_TAU_MS = 45_000

interface ProcessingStepProps {
  pages: SourcePage[]
  phase: ScanPhase
  onCancel: () => void
}

export default function ProcessingStep({ pages, phase, onCancel }: ProcessingStepProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => setElapsed(performance.now() - start), 250)
    return () => window.clearInterval(timer)
  }, [])

  const uploading = phase === 'uploading'
  const page = pages.length ? pages[Math.floor(elapsed / PAGE_CYCLE_MS) % pages.length] : undefined
  // The request gives no real progress, so ease towards 95% and let completion jump to the review step.
  const percent = uploading ? Math.min(10, Math.round(elapsed / 500)) : Math.round(10 + 85 * (1 - Math.exp(-elapsed / PROGRESS_TAU_MS)))
  const late = elapsed > 40_000

  return (
    <div className="flex flex-col gap-6">
      <Card className="items-center gap-5 p-6 text-center md:p-8">
        <div className="relative h-36 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
          {page?.file.kind === 'image' && page.file.url ? (
            <img src={page.file.url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-white px-3">
              <FileText className="size-7 text-red-500" strokeWidth={1.5} />
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-1.5 w-full rounded-full bg-slate-100" />
              ))}
            </div>
          )}
          <span className="anim-scan absolute inset-x-0 h-8 -translate-y-1/2 bg-gradient-to-b from-transparent via-indigo-500/25 to-transparent">
            <span className="absolute inset-x-0 top-1/2 h-0.5 bg-indigo-500 shadow-[0_0_12px_2px_rgba(99,102,241,0.6)]" />
          </span>
        </div>

        <div aria-live="polite">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-slate-900">
            <Sparkles className="size-5 text-violet-500" />
            {uploading
              ? `Đang tải tài liệu lên… (${pages.length} tệp)`
              : late
                ? 'Đang nhận dạng câu hỏi…'
                : `Đang đọc tài liệu… (${pages.length} tệp)`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {uploading
              ? 'Ảnh được thu nhỏ trước khi gửi để quét nhanh hơn.'
              : late
                ? 'Sắp xong rồi! Bạn sẽ được kiểm tra lại trước khi lưu.'
                : 'Thường mất 30 giây đến 2 phút. Hãy giữ màn hình này mở.'}
          </p>
        </div>

        <div className="w-full max-w-sm">
          <Progress value={percent} className="h-2.5" indicatorClassName="bg-gradient-to-r from-indigo-500 to-violet-500" aria-label="Tiến độ quét" />
          <p className="mt-2 text-xs font-semibold text-slate-400 tabular-nums">{percent}%</p>
        </div>

        <Button variant="ghost" className="text-slate-500" onClick={onCancel}>
          Hủy quét
        </Button>
      </Card>

      <div className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-5" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-full bg-slate-200" />
              <span className="h-5 w-24 rounded-full bg-slate-100" />
              <span className="h-5 w-14 rounded-full bg-slate-100" />
            </div>
            <span className="h-4 w-4/5 rounded-full bg-slate-200" />
            <div className="grid grid-cols-2 gap-2">
              <span className="h-10 rounded-xl bg-slate-100" />
              <span className="h-10 rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
