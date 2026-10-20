import type { ReactNode } from 'react'
import { AlertTriangle, Crop, ImagePlus, Layers, Merge, MoreVertical, Pencil, Trash2, Ungroup } from 'lucide-react'
import Passage from '@/components/question/Passage'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { QuestionGroup } from '@/lib/types'

interface ReviewGroupCardProps {
  group: QuestionGroup
  title: string
  /** The passage has no câu yet (cut off before its questions). */
  waiting: boolean
  cropping: boolean
  onEdit: () => void
  onAdjustFigure: () => void
  /** Undefined when the item above is not a bài. */
  onJoinAbove?: () => void
  onUngroup: () => void
  /** Waiting passage: the standalone câu below joins it; undefined when there is none. */
  onFillFromBelow?: () => void
  onDeletePassage: () => void
  children: ReactNode
}

/** A scanned bài in the review step: its shared prompt once, then its câu. */
export default function ReviewGroupCard({
  group,
  title,
  waiting,
  cropping,
  onEdit,
  onAdjustFigure,
  onJoinAbove,
  onUngroup,
  onFillFromBelow,
  onDeletePassage,
  children,
}: ReviewGroupCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-3 md:p-4" aria-label={title} data-placeholder={waiting || undefined}>
      <div className="flex items-center gap-2">
        <Layers className="size-5 text-indigo-600" aria-hidden />
        <p className="font-bold text-slate-900">{title}</p>
        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="sm" className="h-10 text-indigo-700" onClick={onEdit} disabled={cropping}>
            <Pencil />
            Sửa bài
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-700" aria-label={`Thêm thao tác cho ${title}`}>
                <MoreVertical className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={onAdjustFigure}>
                {group.image ? <Crop /> : <ImagePlus />}
                {group.image ? 'Chỉnh khung hình chung' : 'Thêm hình chung'}
              </DropdownMenuItem>
              {onJoinAbove && (
                <DropdownMenuItem onSelect={onJoinAbove}>
                  <Merge className="rotate-180" />
                  Gộp vào bài trên
                </DropdownMenuItem>
              )}
              {!waiting && (
                <DropdownMenuItem onSelect={onUngroup}>
                  <Ungroup />
                  Bỏ bài
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {(group.prompt || group.image) && (
        <div className="rounded-2xl bg-white p-4 text-slate-800">
          <Passage group={group} pictureClassName="max-h-60" />
        </div>
      )}
      {waiting && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden />
            Đoạn văn chưa có câu hỏi
          </p>
          <p className="text-sm text-amber-800">Có thể câu hỏi nằm ở trang sau. Đưa câu bên dưới vào bài, hoặc xóa đoạn văn nếu không cần.</p>
          <div className="flex flex-wrap gap-2">
            {onFillFromBelow && (
              <Button size="sm" className="h-10" onClick={onFillFromBelow}>
                Đưa câu dưới vào bài
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-10 text-red-600 hover:text-red-700" onClick={onDeletePassage}>
              <Trash2 />
              Xóa đoạn văn
            </Button>
          </div>
        </div>
      )}
      {!waiting && <ol className="flex flex-col gap-3">{children}</ol>}
    </li>
  )
}
