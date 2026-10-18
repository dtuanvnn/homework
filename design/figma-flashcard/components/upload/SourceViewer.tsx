import { useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SubjectId } from '@/lib/types'
import PaperPage from './PaperPage'
import type { ReviewItem, SourcePage } from './review-utils'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const STEP = 0.25

interface SourceViewerProps {
  pages: SourcePage[]
  activePage: number
  onPageChange: (page: number) => void
  items: ReviewItem[]
  subject: SubjectId
  grade: number
  className?: string
}

export default function SourceViewer({ pages, activePage, onPageChange, items, subject, grade, className }: SourceViewerProps) {
  const [zoom, setZoom] = useState(1)
  const page = pages[activePage - 1] ?? pages[0]
  const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

  const pageQuestions = items
    .map((item, i) => ({ number: i + 1, question: item.question, page: item.page }))
    .filter((q) => q.page === page?.index)

  if (!page) return null

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" disabled={activePage <= 1} onClick={() => onPageChange(activePage - 1)} aria-label="Trang trước">
            <ChevronLeft className="size-5" />
          </Button>
          <span className="min-w-20 text-center text-sm font-semibold text-slate-700 tabular-nums" aria-live="polite">
            Trang {page.index}/{pages.length}
          </span>
          <Button variant="ghost" size="icon" disabled={activePage >= pages.length} onClick={() => onPageChange(activePage + 1)} aria-label="Trang sau">
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => clamp(z - STEP))} aria-label="Thu nhỏ">
            <ZoomOut className="size-5" />
          </Button>
          <span className="w-12 text-center text-xs font-semibold text-slate-500 tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => clamp(z + STEP))} aria-label="Phóng to">
            <ZoomIn className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" disabled={zoom === 1} onClick={() => setZoom(1)} aria-label="Vừa khung">
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 md:p-4"
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
        title="Nhấn đúp để phóng to / thu nhỏ"
      >
        <div className="mx-auto transition-[width] duration-200" style={{ width: `${zoom * 100}%` }}>
          {page.file.kind === 'image' && page.file.url ? (
            <img src={page.file.url} alt={`Bản gốc trang ${page.index}: ${page.file.name}`} className="w-full rounded-md shadow-md" draggable={false} />
          ) : (
            <PaperPage subject={subject} grade={grade} pageNo={page.pageInFile} fileName={page.file.name} questions={pageQuestions} />
          )}
        </div>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-slate-100 p-2">
        {pages.map((p) => (
          <button
            key={p.index}
            type="button"
            onClick={() => onPageChange(p.index)}
            aria-label={`Xem trang ${p.index}`}
            aria-current={p.index === activePage ? 'page' : undefined}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              p.index === activePage ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
            )}
          >
            Trang {p.index}
            <span className="font-medium text-slate-400">{items.filter((i) => i.page === p.index).length} câu</span>
          </button>
        ))}
      </div>
    </div>
  )
}
