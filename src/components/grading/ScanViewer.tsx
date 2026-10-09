import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Attachment } from "@/lib/types"

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const STEP = 0.5

/** Scanned pages of a paper attempt: swipe or arrows between pages, buttons or double tap to zoom. */
export default function ScanViewer({ scans, className }: { scans: Attachment[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const touchX = useRef<number | null>(null)
  const page = scans[index]
  const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
  const go = (next: number) => {
    setIndex(Math.min(scans.length - 1, Math.max(0, next)))
    setZoom(1)
  }

  if (!page) {
    return (
      <div className={cn("rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500", className)}>
        Bài làm này chưa có ảnh scan.
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Trang trước">
            <ChevronLeft className="size-5" />
          </Button>
          <span className="min-w-20 text-center text-sm font-semibold text-slate-700 tabular-nums" aria-live="polite">
            Trang {index + 1}/{scans.length}
          </span>
          <Button variant="ghost" size="icon" disabled={index >= scans.length - 1} onClick={() => go(index + 1)} aria-label="Trang sau">
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
        onTouchStart={(e) => {
          touchX.current = e.touches.length === 1 ? e.touches[0].clientX : null
        }}
        onTouchEnd={(e) => {
          // Swipe between pages only when not zoomed in (then the finger pans).
          if (touchX.current === null || zoom > 1) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1))
        }}
        title="Nhấn đúp để phóng to / thu nhỏ"
      >
        <div className="mx-auto transition-[width] duration-200" style={{ width: `${zoom * 100}%` }}>
          {page.kind === "image" && page.url ? (
            <img src={page.url} alt={`Bài làm trang ${index + 1}: ${page.name}`} className="w-full rounded-md shadow-md" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-md bg-white p-8 text-center text-sm text-slate-600 shadow-md">
              <p className="font-semibold">{page.name}</p>
              {page.url && (
                <Button asChild variant="outline">
                  <a href={page.url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Mở tệp
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {scans.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-slate-100 p-2">
          {scans.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Xem trang ${i + 1}`}
              aria-current={i === index ? "page" : undefined}
              className={cn(
                "flex h-11 shrink-0 items-center rounded-xl border px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                i === index ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50",
              )}
            >
              Trang {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
