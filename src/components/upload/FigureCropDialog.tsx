'use client'

import { useState } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { boxFromPercent, percentFromBox, type Box } from '@/lib/figure-crop'

interface FigureCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageUrl?: string
  initialBox?: Box
  title: string
  saving?: boolean
  onSave: (box: Box) => void
}

/** Drag a box on a page image to choose a question's figure. */
export default function FigureCropDialog({ open, onOpenChange, pageUrl, initialBox, title, saving, onSave }: FigureCropDialogProps) {
  const [crop, setCrop] = useState<PercentCrop | undefined>(initialBox ? percentFromBox(initialBox) : undefined)
  // Reset the selection whenever the dialog opens for another figure.
  const [shownFor, setShownFor] = useState({ open, initialBox })
  if (shownFor.open !== open || shownFor.initialBox !== initialBox) {
    setShownFor({ open, initialBox })
    if (open) setCrop(initialBox ? percentFromBox(initialBox) : undefined)
  }
  const valid = Boolean(crop && crop.width > 2 && crop.height > 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Kéo để khoanh vùng hình minh họa, kéo các góc để chỉnh.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[65dvh] items-start justify-center overflow-auto rounded-xl bg-slate-100 p-2">
          {pageUrl ? (
            // The height limit goes on ReactCrop: its stylesheet makes the image inherit max-height (overriding a class on
            // the image), and its mask covers ReactCrop's box, which must be exactly the image's.
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} keepSelection className="max-h-[60dvh]">
              {/* eslint-disable-next-line @next/next/no-img-element -- Page blob/signed URLs can't use next/image optimization */}
              <img src={pageUrl} alt="Trang tài liệu" draggable={false} />
            </ReactCrop>
          ) : (
            <p className="p-8 text-sm text-slate-500">Không có ảnh trang để cắt.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button disabled={!valid || saving} onClick={() => crop && onSave(boxFromPercent(crop))}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Dùng hình này
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
