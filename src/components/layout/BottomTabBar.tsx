import { cn } from '@/lib/utils'
import type { AppMode } from '@/lib/types'
import type { NavItem, TabId } from './nav-config'

interface BottomTabBarProps {
  mode: AppMode
  items: NavItem[]
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export default function BottomTabBar({ mode, items, activeTab, onTabChange }: BottomTabBarProps) {
  const isStudent = mode === 'student'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Điều hướng chính"
    >
      <ul className="mx-auto flex max-w-lg px-[6px] pt-[6px] pb-[6px]">
        {items.map((item) => {
          const active = item.id === activeTab
          const Icon = item.icon
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[56px] w-full flex-col items-center justify-center gap-[3px] rounded-[12px] px-[2px] font-medium text-slate-500 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active && 'text-indigo-700',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-[30px] items-center justify-center rounded-full px-[14px] transition-colors',
                    active && (isStudent ? 'bg-indigo-600 text-white' : 'bg-indigo-50'),
                    isStudent && 'h-[34px] px-[18px]',
                  )}
                >
                  <Icon className={cn('size-[20px]', isStudent && 'size-[22px]')} />
                  {!!item.badge && (
                    <span className="absolute -top-[4px] right-[2px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-violet-500 px-[4px] text-[10px] leading-none font-bold text-white ring-2 ring-white">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'w-full truncate text-center text-[11px] leading-tight',
                    isStudent && 'text-[13px]',
                    active && 'font-semibold',
                  )}
                >
                  {item.shortLabel ?? item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
