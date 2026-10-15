"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { trimInk, type Ink } from "@/lib/ink"
import { InkPageSvg } from "./InkPage"

export interface Handwriting {
  ink?: Ink
  /** Legacy PNG data URL from the old single canvas. */
  drawing?: string
}

const ZOOMS = [1, 1.5, 2, 3]

/**
 * The child's handwritten pages, full width; tapping a page opens it large
 * with page navigation and zoom. Legacy answers show their single image.
 */
export default function HandwritingView({ handwriting, label }: { handwriting: Handwriting; label: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const [zoom, setZoom] = useState(0)
  const ink = handwriting.ink ? trimInk(handwriting.ink) : undefined
  const count = ink ? ink.pages.length : handwriting.drawing ? 1 : 0
  if (!count) return null

  const page = (i: number, large = false) =>
    ink ? (
      <InkPageSvg paper={ink.paper} strokes={ink.pages[i].strokes} label={`${label}, trang ${i + 1}/${count}`} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- inline data URL
      <img src={handwriting.drawing} alt={label} className={large ? "w-full bg-white" : "w-full rounded-xl bg-white"} />
    )

  return (
    <div className="mt-2 space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            setZoom(0)
            setOpen(i)
          }}
          aria-label={`Xem lớn ${label}${count > 1 ? `, trang ${i + 1}` : ""}`}
          className="relative block w-full overflow-hidden rounded-xl border bg-white text-left"
        >
          {page(i)}
          {count > 1 && <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">{i + 1}/{count}</span>}
        </button>
      ))}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none p-0" aria-describedby={undefined}>
          {open !== null && (
            <>
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <DialogTitle className="mr-auto truncate text-base">
                  {label}
                  {count > 1 && ` · Trang ${open + 1}/${count}`}
                </DialogTitle>
                <IconBtn label="Thu nhỏ" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)} icon={ZoomOut} />
                <IconBtn label="Phóng to" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => z + 1)} icon={ZoomIn} />
                {count > 1 && (
                  <>
                    <IconBtn label="Trang trước" disabled={open === 0} onClick={() => setOpen(open - 1)} icon={ChevronLeft} />
                    <IconBtn label="Trang sau" disabled={open === count - 1} onClick={() => setOpen(open + 1)} icon={ChevronRight} />
                  </>
                )}
                <DialogClose className="inline-flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                  <X className="size-5" />
                </DialogClose>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-3">
                <div className="mx-auto overflow-hidden rounded-xl border bg-white shadow-sm" style={{ width: `${ZOOMS[zoom] * 100}%`, maxWidth: zoom === 0 ? "1100px" : undefined }}>
                  {page(open, true)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, icon: Icon }: { label: string; onClick: () => void; disabled?: boolean; icon: typeof X }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30"
    >
      <Icon className="size-5" />
    </button>
  )
}
