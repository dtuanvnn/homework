import { AlertTriangle, Check, FileSearch, Loader2, Merge, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import QuestionContent from '@/components/exercise-detail/QuestionContent'
import { formatScoreValue } from '@/lib/format'
import { QUESTION_TYPES } from '@/lib/questions'
import { cn } from '@/lib/utils'
import { HIGH_CONFIDENCE, LOW_CONFIDENCE, hasAnswer, needsCheck, type ReviewItem } from './review-utils'

function ConfidencePill({ item }: { item: ReviewItem }) {
  const pct = Math.round(item.confidence * 100)
  const level = item.confidence >= HIGH_CONFIDENCE ? 'high' : item.confidence >= LOW_CONFIDENCE ? 'mid' : 'low'
  const bars = level === 'high' ? 3 : level === 'mid' ? 2 : 1
  const color = { high: 'bg-emerald-500', mid: 'bg-sky-500', low: 'bg-amber-500' }[level]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
        level === 'low' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600',
      )}
      title={`Độ tin cậy của AI: ${pct}%`}
    >
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cn('w-1 rounded-sm', b <= bars ? color : 'bg-slate-200')} style={{ height: 4 + b * 3 }} />
        ))}
      </span>
      <span className="sr-only">Độ tin cậy</span>
      {pct}%
    </span>
  )
}

interface ExtractedQuestionCardProps {
  domId?: string
  item: ReviewItem
  index: number
  onEdit: () => void
  onDelete: () => void
  /** Undefined for the first question. */
  onMergeUp?: () => void
  onConfirm: () => void
  onShowSource: () => void
}

export default function ExtractedQuestionCard({ domId, item, index, onEdit, onDelete, onMergeUp, onConfirm, onShowSource }: ExtractedQuestionCardProps) {
  const q = item.question
  const typeInfo = QUESTION_TYPES[q.type]
  const flagged = needsCheck(item)
  const missingAnswer = !hasAnswer(q)

  return (
    <li
      id={domId}
      className={cn(
        'flex scroll-mt-24 flex-col gap-3 rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.04)] md:p-5',
        flagged ? 'border-amber-300 bg-amber-50/50 ring-4 ring-amber-100' : 'border-slate-200/70',
      )}
    >
      {flagged && (
        <div className="-mx-1 -mt-1 flex items-start gap-2.5 rounded-xl bg-amber-100/80 px-3 py-2 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <span className="font-bold">Cần kiểm tra</span>
            {item.note && <span className="text-amber-800"> · {item.note}</span>}
          </div>
          <Button size="sm" variant="ghost" className="-my-1 -mr-1 h-9 shrink-0 bg-white/70 text-amber-800 hover:bg-white" onClick={onConfirm}>
            <Check />
            Đã đúng
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 text-sm font-bold text-white">
          <span className="sr-only">Câu </span>
          {index + 1}
        </span>
        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
          <typeInfo.icon />
          {typeInfo.label}
        </Badge>
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          {formatScoreValue(q.points)} điểm
        </Badge>
        {item.reviewed ? (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            <Check />
            Đã kiểm tra
          </Badge>
        ) : (
          <ConfidencePill item={item} />
        )}
        <button
          type="button"
          onClick={onShowSource}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
        >
          <FileSearch className="size-3.5" />
          Trang {item.page}
        </button>
      </div>

      {q.skills.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-1.5">
          {q.skills.map((s) => (
            <Badge key={s} variant="outline" className="border-slate-200 font-medium text-slate-600">
              #{s}
            </Badge>
          ))}
        </div>
      )}

      <QuestionContent question={q} />

      {item.figureState === 'cropping' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Đang cắt hình…
        </p>
      )}
      {item.figureState === 'error' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
          <AlertTriangle className="size-4" aria-hidden />
          Chưa tải được hình – nhấn Chỉnh khung để thử lại.
        </p>
      )}

      {missingAnswer && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
          <AlertTriangle className="size-4" />
          Chưa nhận dạng được đáp án – nhấn Sửa để bổ sung.
        </p>
      )}

      <div className="-mx-2 -mb-2 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2">
        <Button variant="ghost" size="sm" className="h-11 text-slate-600" onClick={onEdit}>
          <Pencil />
          Sửa
        </Button>
        <Button variant="ghost" size="sm" className="h-11 text-slate-600 hover:bg-red-50 hover:text-red-600" onClick={onDelete}>
          <Trash2 />
          Xóa
        </Button>
        {onMergeUp && (
          <Button variant="ghost" size="sm" className="h-11 text-slate-600" onClick={onMergeUp}>
            <Merge className="rotate-180" />
            Gộp với câu trên
          </Button>
        )}
      </div>
    </li>
  )
}
