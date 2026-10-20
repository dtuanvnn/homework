import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2, MoreVertical, Pencil, Sparkles, Trash2 } from 'lucide-react'
import AnswerStatusBadge from '@/components/question/AnswerStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatPoints } from '@/lib/format'
import { QUESTION_TYPES } from '@/lib/questions'
import { cn } from '@/lib/utils'
import type { Question } from '@/lib/types'
import QuestionContent from './QuestionContent'

/** An entry of the card's "more" menu (bài actions). */
export interface CardAction {
  label: string
  onSelect: () => void
  disabled?: boolean
  /** Why it's disabled. */
  hint?: string
}

interface QuestionCardProps {
  question: Question
  index: number
  onEdit: () => void
  onDelete: () => void
  onSolve?: () => void
  solving?: boolean
  actions?: CardAction[]
}

export default function QuestionCard({ question, index, onEdit, onDelete, onSolve, solving, actions }: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })
  const typeInfo = QUESTION_TYPES[question.type]
  const TypeIcon = typeInfo.icon

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.04)] md:p-5',
        isDragging && 'z-10 border-indigo-200 shadow-xl ring-2 ring-indigo-500/20',
      )}
    >
      <div className="-my-1.5 flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Kéo để sắp xếp câu ${index + 1}`}
          className={cn(
            '-ml-2.5 flex size-11 touch-none items-center justify-center rounded-xl text-slate-300 outline-none hover:bg-slate-100 hover:text-slate-500 focus-visible:ring-[3px] focus-visible:ring-ring/50',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          <GripVertical className="size-5" />
        </button>
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 text-sm font-bold text-white">
          <span className="sr-only">Câu </span>
          {index + 1}
        </span>
        <div className="-mr-2 ml-auto flex items-center">
          {onSolve && (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-violet-700"
              onClick={onSolve}
              disabled={solving}
              aria-label={`Giải câu ${index + 1} bằng AI`}
              title="Giải bằng AI"
            >
              {solving ? <Loader2 className="size-[18px] animate-spin" /> : <Sparkles className="size-[18px]" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-700" onClick={onEdit} aria-label={`Sửa câu ${index + 1}`}>
            <Pencil className="size-[18px]" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={onDelete} aria-label={`Xóa câu ${index + 1}`}>
            <Trash2 className="size-[18px]" />
          </Button>
          {actions && actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-700" aria-label={`Thêm thao tác cho câu ${index + 1}`}>
                  <MoreVertical className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {actions.map((a) => (
                  <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={a.onSelect} className="flex-col items-start gap-0.5">
                    {a.label}
                    {a.disabled && a.hint && <span className="text-xs text-slate-500">{a.hint}</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
          <TypeIcon />
          {typeInfo.label}
        </Badge>
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          {formatPoints(question.points)} điểm
        </Badge>
        <AnswerStatusBadge status={question.answerStatus} />
        {question.skills.map((skill) => (
          <Badge key={skill} variant="outline" className="border-slate-200 font-medium text-slate-600">
            #{skill}
          </Badge>
        ))}
      </div>

      <QuestionContent question={question} />
    </li>
  )
}
