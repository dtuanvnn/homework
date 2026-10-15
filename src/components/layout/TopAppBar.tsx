import { ArrowLeft } from 'lucide-react'
import type { AppMode, ChildOption, Student } from '@/lib/types'
import HoldToOpen from './HoldToOpen'
import ParentMenu from './ParentMenu'
import SoundControls from './SoundControls'

interface TopAppBarProps {
  title: string
  mode: AppMode
  onOpenMode: (mode: AppMode) => void
  student: Student | null
  household: ChildOption[]
  /** When set, shows a back button instead of the header buttons (sub-pages). */
  onBack?: () => void
}

export default function TopAppBar({ title, mode, onOpenMode, student, household, onBack }: TopAppBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-[60px] items-center justify-between gap-[12px] px-[16px]">
        {onBack ? (
          <div className="flex min-w-0 items-center gap-[4px]">
            <button
              type="button"
              onClick={onBack}
              className="-ml-[10px] flex size-[44px] shrink-0 items-center justify-center rounded-[12px] text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Quay lại"
            >
              <ArrowLeft className="size-[22px]" />
            </button>
            <h1 className="truncate text-[18px] leading-tight font-bold text-slate-900">{title}</h1>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <div className="text-[10px] leading-none font-bold tracking-[0.08em] text-indigo-600 uppercase">
                Homework Hub
              </div>
              <h1 className="mt-[4px] truncate text-[18px] leading-tight font-bold text-slate-900">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-[4px]">
              {mode === 'student' && <SoundControls />}
              {mode === 'student' ? (
                <HoldToOpen onOpen={() => onOpenMode('parent')}>
                  <span className="grid size-[40px] place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-[20px]" aria-hidden>
                    {student?.avatarEmoji}
                  </span>
                </HoldToOpen>
              ) : (
                <ParentMenu compact student={student} household={household} onOpenStudentMode={() => onOpenMode('student')} />
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
