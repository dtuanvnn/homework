import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppMode, ChildOption, Student } from '@/lib/types'
import BrandMark from './BrandMark'
import ParentMenu from './ParentMenu'
import SoundControls from './SoundControls'
import StudentChip from './StudentChip'
import type { NavItem, TabId } from './nav-config'

interface SidebarProps {
  mode: AppMode
  onOpenMode: (mode: AppMode) => void
  household: ChildOption[]
  items: NavItem[]
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  student: Student | null
}

export default function Sidebar({
  mode,
  onOpenMode,
  household,
  items,
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
  student,
}: SidebarProps) {
  const isStudent = mode === 'student'
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200 md:flex',
        collapsed ? 'w-20' : 'w-64',
      )}
      aria-label="Điều hướng chính"
    >
      <div className={cn('flex items-center gap-2 p-4', collapsed ? 'flex-col' : 'justify-between')}>
        <BrandMark showName={!collapsed} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500"
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            >
              <CollapseIcon className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Mở rộng' : 'Thu gọn'}</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-4 pb-2">
        {mode === 'student' ? (
          <StudentChip student={student} mode={mode} collapsed={collapsed} onHold={() => onOpenMode('parent')} />
        ) : (
          <ParentMenu student={student} household={household} compact={collapsed} onOpenStudentMode={() => onOpenMode('student')} />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-3">
        {!collapsed && (
          <div className="px-3 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {isStudent ? 'Góc học tập' : 'Quản lý'}
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = item.id === activeTab
            const Icon = item.icon
            const button = (
              <button
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-medium text-slate-600 transition-colors outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  collapsed && 'justify-center px-0',
                  isStudent && 'min-h-12 rounded-2xl',
                  active && !isStudent && 'bg-indigo-50 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-700',
                  active &&
                    isStudent &&
                    'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-600 hover:text-white',
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!!item.badge &&
                  (collapsed ? (
                    <span className="absolute top-1.5 right-3 size-2.5 rounded-full bg-violet-500 ring-2 ring-white" />
                  ) : (
                    <span
                      className={cn(
                        'min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold',
                        active && isStudent ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700',
                      )}
                    >
                      {item.badge}
                    </span>
                  ))}
              </button>
            )
            return (
              <li key={item.id}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {isStudent && (
        <div className={cn('border-t border-slate-100 p-4', collapsed && 'flex flex-col items-center')}>
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
            {!collapsed && <span className="text-xs font-semibold text-slate-400">Âm thanh</span>}
            <SoundControls stacked={collapsed} />
          </div>
        </div>
      )}
    </aside>
  )
}
