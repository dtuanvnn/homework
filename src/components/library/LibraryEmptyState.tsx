import { X } from 'lucide-react'
import { useStudent } from '@/components/layout/AppFrame'
import { Button } from '@/components/ui/button'
import type { ExerciseSource } from '@/lib/types'
import AddExerciseMenu from './AddExerciseMenu'

function EmptyIllustration() {
  return (
    <svg viewBox="0 0 220 160" className="h-36 w-auto" aria-hidden>
      <ellipse cx="110" cy="146" rx="78" ry="8" fill="#e2e8f0" />
      <circle cx="110" cy="78" r="64" fill="#eef2ff" />
      {/* back sheet – Tiếng Anh */}
      <g transform="rotate(-12 80 80)">
        <rect x="48" y="42" width="64" height="82" rx="10" fill="#fff" stroke="#e2e8f0" />
        <rect x="48" y="42" width="64" height="12" rx="6" fill="#22c55e" />
        <rect x="58" y="66" width="40" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="58" y="78" width="30" height="5" rx="2.5" fill="#e2e8f0" />
      </g>
      {/* back sheet – Tiếng Việt */}
      <g transform="rotate(12 140 80)">
        <rect x="108" y="42" width="64" height="82" rx="10" fill="#fff" stroke="#e2e8f0" />
        <rect x="108" y="42" width="64" height="12" rx="6" fill="#f97316" />
        <rect x="118" y="66" width="40" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="118" y="78" width="30" height="5" rx="2.5" fill="#e2e8f0" />
      </g>
      {/* front sheet – Toán, empty with dashed outline */}
      <rect x="76" y="34" width="68" height="90" rx="12" fill="#fff" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx="110" cy="79" r="16" fill="#4f46e5" />
      <path d="M110 71v16M102 79h16" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      {/* sparkles */}
      <path d="M170 28l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#a78bfa" />
      <path d="M44 34l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="#3b82f6" />
      <circle cx="186" cy="62" r="3" fill="#fdba74" />
    </svg>
  )
}

interface LibraryEmptyStateProps {
  /** true when the library has items but none match the current search/filters. */
  filtered: boolean
  onAdd: (source: ExerciseSource) => void
  onReset: () => void
}

export default function LibraryEmptyState({ filtered, onAdd, onReset }: LibraryEmptyStateProps) {
  const student = useStudent()
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
      <EmptyIllustration />
      <h2 className="mt-4 text-lg font-bold text-slate-900">
        {filtered ? 'Không tìm thấy bài tập phù hợp' : 'Chưa có bài tập nào'}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {filtered
          ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc để xem thêm bài tập.'
          : `Soạn bài, tải lên phiếu bài tập hoặc để AI tạo giúp bạn bộ bài đầu tiên cho ${student.name}.`}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {filtered && (
          <Button variant="outline" onClick={onReset}>
            <X />
            Xóa bộ lọc
          </Button>
        )}
        <AddExerciseMenu onSelect={onAdd} align="center" />
      </div>
    </div>
  )
}
