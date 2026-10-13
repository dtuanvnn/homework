'use client'

import { useRef, useState } from 'react'
import { Crop, ImageOff, ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import QuestionPicture from '@/components/question/QuestionPicture'
import FigureCropDialog from '@/components/upload/FigureCropDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { makeFigure } from '@/lib/figure-client'
import { FULL_PAGE, type Box } from '@/lib/figure-crop'
import type { QuestionImage } from '@/lib/types'

export interface FigureSource {
  label: string
  source: Blob | string
  url?: string
}

interface FigureFieldProps {
  setId: string
  sources: FigureSource[]
  image?: QuestionImage
  imageUrl?: string
  onChange: (image?: QuestionImage, imageUrl?: string) => void
}

/** "Hình minh họa": pick a photo, cut one out of the set's pages, or remove it. */
export default function FigureField({ setId, sources, image, imageUrl, onChange }: FigureFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [cropFrom, setCropFrom] = useState<FigureSource | null>(null)

  const run = async (source: Blob | string, box: Box) => {
    setBusy(true)
    try {
      const made = await makeFigure(setId, source, box)
      onChange(made.image, made.imageUrl)
      setCropFrom(null)
    } catch {
      toast.error('Không tải được hình', { description: 'Kiểm tra mạng rồi thử lại.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Hình minh họa</Label>
      {image && <QuestionPicture question={{ image, imageUrl }} className="max-h-48" />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus />}
          Chọn ảnh
        </Button>
        {sources.map((s) => (
          <Button key={s.label} type="button" variant="outline" size="sm" disabled={busy || !s.url} onClick={() => setCropFrom(s)}>
            <Crop />
            Cắt từ {s.label}
          </Button>
        ))}
        {image && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(undefined, undefined)}>
            <ImageOff />
            Bỏ hình
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void run(file, FULL_PAGE)
        }}
      />
      <FigureCropDialog
        open={cropFrom !== null}
        onOpenChange={(open) => !open && setCropFrom(null)}
        pageUrl={cropFrom?.url}
        title="Cắt hình từ trang tài liệu"
        saving={busy}
        onSave={(box) => cropFrom && void run(cropFrom.source, box)}
      />
    </div>
  )
}
