import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatPoints, formatScoreValue } from '@/lib/format'
import type { QuestionGroup } from '@/lib/types'
import FigureField, { type FigureSource } from './FigureField'
import FormulaPreview from './FormulaPreview'
import { parsePoints } from './question-draft'

export interface GroupEdit {
  label?: string
  prompt: string
  image?: QuestionGroup['image']
  imageUrl?: string
  /** "Điểm cả bài", split evenly over the câu; null keeps each câu's points. */
  total: number | null
}

interface GroupEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: QuestionGroup | null
  title: string
  count: number
  points: number
  setId: string
  sources: FigureSource[]
  onSubmit: (edit: GroupEdit) => void
}

/** "Sửa bài": label, shared prompt, shared figure and the bài's total points. */
export default function GroupEditorSheet({ open, onOpenChange, group, title, count, points, setId, sources, onSubmit }: GroupEditorSheetProps) {
  const [label, setLabel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState<{ image?: QuestionGroup['image']; imageUrl?: string }>({})
  const [totalText, setTotalText] = useState('')

  // Reset the form whenever the sheet opens for a bài.
  const [shownFor, setShownFor] = useState<{ open: boolean; id?: string }>({ open: false })
  if (shownFor.open !== open || shownFor.id !== group?.id) {
    setShownFor({ open, id: group?.id })
    if (open && group) {
      setLabel(group.label ?? '')
      setPrompt(group.prompt)
      setImage({ image: group.image, imageUrl: group.imageUrl })
      setTotalText('')
    }
  }

  const total = totalText.trim() ? parsePoints(totalText) : null
  const totalInvalid = totalText.trim() !== '' && total === null

  const submit = () => {
    if (totalInvalid) return
    onSubmit({ label: label.trim() || undefined, prompt: prompt.trim(), ...image, total })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sửa bài</SheetTitle>
          <SheetDescription>
            {title} · {count} câu · {formatPoints(points)} điểm. Đề chung hiện một lần phía trên các câu của bài.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 md:px-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-label">Nhãn bài (không bắt buộc)</Label>
            <Input id="group-label" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="VD: Part 3 · để trống sẽ hiện “Bài n”" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-prompt">Đề chung</Label>
            <Textarea
              id="group-prompt"
              rows={prompt.includes('\n') || prompt.length > 160 ? 8 : 4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="VD: Đọc đoạn văn sau và trả lời các câu hỏi."
            />
            <FormulaPreview text={prompt} />
          </div>
          <FigureField
            setId={setId}
            sources={sources}
            image={image.image}
            imageUrl={image.imageUrl}
            onChange={(img, imageUrl) => setImage({ image: img, imageUrl })}
            label="Hình chung"
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-total">Điểm cả bài</Label>
            <Input
              id="group-total"
              inputMode="decimal"
              className="w-32 tabular-nums"
              aria-invalid={totalInvalid || undefined}
              placeholder={formatScoreValue(Math.round(points * 100) / 100)}
              value={totalText}
              onChange={(e) => setTotalText(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              {total !== null
                ? `Mỗi câu ${formatPoints(total / count)} điểm (chia đều).`
                : 'Để trống để giữ điểm từng câu; nhập điểm thì chia đều cho các câu của bài.'}
            </p>
          </div>
        </div>
        <SheetFooter>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button className="flex-[2]" disabled={totalInvalid} onClick={submit}>
              Lưu bài
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
