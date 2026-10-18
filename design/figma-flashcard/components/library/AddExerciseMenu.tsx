import { ChevronDown, Layers, PenLine, Plus, Sparkles, Upload, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ExerciseCreateOption } from '@/lib/types'

const OPTIONS: { source: ExerciseCreateOption; label: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { source: 'thu-cong', label: 'Soạn thủ công', hint: 'Tự nhập câu hỏi và đáp án', icon: PenLine, tone: 'bg-slate-100 text-slate-600' },
  { source: 'tai-len', label: 'Tải lên ảnh / PDF', hint: 'Chụp phiếu bài tập hoặc chọn file', icon: Upload, tone: 'bg-slate-100 text-slate-600' },
  { source: 'ai', label: 'Tạo bằng AI', hint: 'Tạo đề theo chủ đề và độ khó', icon: Sparkles, tone: 'bg-violet-50 text-violet-600' },
  { source: 'flashcard', label: 'Từ vựng (Flashcard)', hint: 'Tạo bộ từ mới Oxford Discovery 2', icon: Layers, tone: 'bg-green-50 text-green-600' },
]

interface AddExerciseMenuProps {
  onSelect: (source: ExerciseCreateOption) => void
  align?: 'start' | 'center' | 'end'
  className?: string
}

export default function AddExerciseMenu({ onSelect, align = 'end', className }: AddExerciseMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn('shrink-0', className)}>
          <Plus className="size-5" />
          Thêm bài tập
          <ChevronDown className="-mr-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72 p-1.5">
        {OPTIONS.map(({ source, label, hint, icon: Icon, tone }) => (
          <DropdownMenuItem key={source} onSelect={() => onSelect(source)} className="gap-3 py-2.5">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
              <Icon className="size-[18px] text-current" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
