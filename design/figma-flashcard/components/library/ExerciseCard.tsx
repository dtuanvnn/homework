import { Copy, Layers, ListChecks, MoreVertical, Pencil, PencilLine, Send, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import SubjectIcon from '@/components/shared/SubjectIcon'
import { EXERCISE_KINDS, EXERCISE_SOURCES } from '@/lib/library'
import { SUBJECTS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { ExerciseSet } from '@/lib/types'
import DifficultyDots from './DifficultyDots'

export interface ExerciseCardActions {
  onOpen: (set: ExerciseSet) => void
  onEdit: (set: ExerciseSet) => void
  onAssign: (set: ExerciseSet) => void
  onDuplicate: (set: ExerciseSet) => void
  onDelete: (set: ExerciseSet) => void
}

export default function ExerciseCard({ set, actions }: { set: ExerciseSet; actions: ExerciseCardActions }) {
  const subject = SUBJECTS[set.subject]
  const source = EXERCISE_SOURCES[set.source]
  const SourceIcon = source.icon
  const isDraft = set.status === 'nhap'
  const isFlashcard = set.format === 'flashcard'

  return (
    <Card className="relative h-full gap-4 overflow-hidden p-5 pl-6 transition-shadow focus-within:ring-[3px] focus-within:ring-ring/40 hover:shadow-md">
      <div className={cn('absolute inset-y-0 left-0 w-1.5', subject.bg)} aria-hidden />

      <div className="flex items-start gap-3">
        <SubjectIcon subject={set.subject} flashcard={isFlashcard} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold', subject.text)}>{subject.name}</span>
            {isFlashcard && (
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                <Layers />
                Flashcard
              </Badge>
            )}
            {isDraft && (
              <Badge variant="outline" className="border-dashed border-slate-300 bg-slate-50 text-slate-600">
                <PencilLine />
                Nháp
              </Badge>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 leading-snug font-semibold text-slate-900">
            {/* Stretched button: the whole card opens the detail page. */}
            <button
              type="button"
              onClick={() => actions.onOpen(set)}
              className="text-left outline-none after:absolute after:inset-0 after:content-['']"
            >
              {set.title}
            </button>
          </h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative z-10 -mt-2 -mr-3 text-slate-400 hover:text-slate-700" aria-label={`Thao tác cho ${set.title}`}>
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => actions.onEdit(set)}>
              <Pencil />
              Sửa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onAssign(set)} disabled={isDraft}>
              <Send />
              {isDraft ? 'Giao bài (cần hoàn tất)' : 'Giao bài'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onDuplicate(set)}>
              <Copy />
              Nhân bản
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(set)}>
              <Trash2 />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">Lớp {set.grade}</Badge>
        {isFlashcard ? (
          <Badge variant="secondary" className="bg-green-50 text-green-700">
            <Layers />
            Flashcard
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">{EXERCISE_KINDS[set.kind]}</Badge>
        )}
        {isFlashcard && set.book && (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            {set.book}{set.unit ? ` · Unit ${set.unit}` : ''}
          </Badge>
        )}
        <Badge
          variant="secondary"
          className={cn(set.source === 'ai' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700')}
        >
          <SourceIcon />
          {source.label}
        </Badge>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            {isFlashcard ? (
              <>
                <Layers className="size-4 text-green-600" aria-hidden />
                {set.questionCount} từ
              </>
            ) : (
              <>
                <ListChecks className="size-4 text-slate-400" aria-hidden />
                {set.questionCount} câu
              </>
            )}
          </span>
          <DifficultyDots level={set.difficulty} colorClass={subject.bg} />
        </div>
        <span className={cn('text-xs', set.timesAssigned ? 'text-slate-500' : 'text-slate-400')}>
          {set.timesAssigned ? `Đã giao ${set.timesAssigned} lần` : 'Chưa giao'}
        </span>
      </div>
    </Card>
  )
}
