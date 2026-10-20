import type { ReactNode } from 'react'
import { Layers, MoreVertical, Pencil } from 'lucide-react'
import QuestionPicture from '@/components/question/QuestionPicture'
import RichText from '@/components/question/RichText'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatPoints } from '@/lib/format'
import type { QuestionGroup } from '@/lib/types'

interface GroupCardProps {
  group: QuestionGroup
  title: string
  count: number
  points: number
  onEdit: () => void
  onUngroup: () => void
  onDelete: () => void
  /** A split passage: "Gộp chỗ trống" (and "Bỏ bài", given the merge as onUngroup) turns it back into one question. */
  blanks?: boolean
  /** The bài's câu cards. */
  children: ReactNode
}

/** A bài in the editor: its shared prompt and figure once, then its câu. */
export default function GroupCard({ group, title, count, points, onEdit, onUngroup, onDelete, blanks, children }: GroupCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/40 p-3 md:p-4" aria-label={title}>
      <div className="flex items-center gap-2 px-1">
        <Layers className="size-5 shrink-0 text-indigo-600" aria-hidden />
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {count} câu · {formatPoints(points)} điểm
          </p>
        </div>
        <div className="-mr-1 ml-auto flex items-center">
          <Button variant="ghost" size="sm" className="text-indigo-700" onClick={onEdit}>
            <Pencil />
            Sửa bài
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-700" aria-label={`Thêm thao tác cho ${title}`}>
                <MoreVertical className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {blanks && <DropdownMenuItem onSelect={onUngroup}>Gộp chỗ trống</DropdownMenuItem>}
              <DropdownMenuItem onSelect={onUngroup}>Bỏ bài</DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} className="text-red-600 focus:text-red-700">
                Xoá bài
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {(group.prompt || group.image) && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 text-slate-800">
          {group.prompt && (
            <p className="break-words whitespace-pre-line">
              <RichText text={group.prompt} />
            </p>
          )}
          <QuestionPicture question={group} className="max-h-72" />
        </div>
      )}
      <ol className="flex flex-col gap-3">{children}</ol>
    </li>
  )
}
