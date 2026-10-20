import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatPoints, formatScoreValue } from '@/lib/format'
import type { PassageLayout, QuestionGroup } from '@/lib/types'
import { cn } from '@/lib/utils'
import Passage from '@/components/question/Passage'
import FigureField, { type FigureSource } from './FigureField'
import FormulaPreview from './FormulaPreview'
import { parsePoints } from './question-draft'

export interface GroupEdit {
  label?: string
  prompt: string
  /** Formatted passage or dialogue; undefined shows the prompt as typed. */
  layout?: PassageLayout
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
  /** The scan review step: no "Điểm cả bài" (points are set after saving). */
  previewOnly?: boolean
  onSubmit: (edit: GroupEdit) => void
}

const LAYOUTS: { value: PassageLayout | undefined; label: string }[] = [
  { value: undefined, label: 'Thường' },
  { value: 'doan-van', label: 'Đoạn văn' },
  { value: 'hoi-thoai', label: 'Hội thoại' },
]

/** "Sửa bài": label, shared prompt and its layout, shared figure and the bài's total points. */
export default function GroupEditorSheet({ open, onOpenChange, group, title, count, points, setId, sources, previewOnly, onSubmit }: GroupEditorSheetProps) {
  const [label, setLabel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [layout, setLayout] = useState<PassageLayout | undefined>()
  const [image, setImage] = useState<{ image?: QuestionGroup['image']; imageUrl?: string }>({})
  const [totalText, setTotalText] = useState('')

  // Reset the form whenever the sheet opens for a bài.
  const [shownFor, setShownFor] = useState<{ open: boolean; id?: string }>({ open: false })
  if (shownFor.open !== open || shownFor.id !== group?.id) {
    setShownFor({ open, id: group?.id })
    if (open && group) {
      setLabel(group.label ?? '')
      setPrompt(group.prompt)
      setLayout(group.layout)
      setImage({ image: group.image, imageUrl: group.imageUrl })
      setTotalText('')
    }
  }

  const total = totalText.trim() ? parsePoints(totalText) : null
  const totalInvalid = totalText.trim() !== '' && total === null

  const submit = () => {
    if (totalInvalid) return
    onSubmit({ label: label.trim() || undefined, prompt: prompt.trim(), layout, ...image, total: previewOnly ? null : total })
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
            {layout ? (
              <>
                <p className="text-xs text-slate-500">
                  # tiêu đề · **hướng dẫn**{layout === 'hoi-thoai' ? ' · Tên: lời nói' : ''} · mỗi đoạn một dòng
                </p>
                {prompt.trim() && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-slate-800">
                    <Passage group={{ id: group?.id ?? 'preview', prompt, layout, ...image }} pictureClassName="max-h-48" />
                  </div>
                )}
              </>
            ) : (
              <FormulaPreview text={prompt} />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label id="group-layout">Trình bày</Label>
            <div role="radiogroup" aria-labelledby="group-layout" className="flex gap-1 rounded-full bg-slate-100 p-1">
              {LAYOUTS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={layout === option.value}
                  onClick={() => setLayout(option.value)}
                  className={cn(
                    'h-10 flex-1 rounded-full text-sm font-semibold transition',
                    layout === option.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <FigureField
            setId={setId}
            sources={sources}
            image={image.image}
            imageUrl={image.imageUrl}
            onChange={(img, imageUrl) => setImage({ image: img, imageUrl })}
            label="Hình chung"
          />
          {!previewOnly && (
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
          )}
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
