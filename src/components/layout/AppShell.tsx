import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { parentPage, studentPage } from '@/lib/animations'
import { setSoundMode } from '@/hooks/useSound'
import { useMediaQuery } from '@/lib/use-media-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AppMode, ChildOption, Student } from '@/lib/types'
import BottomTabBar from './BottomTabBar'
import Sidebar from './Sidebar'
import TopAppBar from './TopAppBar'
import type { NavItem, TabId } from './nav-config'

interface AppShellProps {
  student: Student
  mode: AppMode
  onOpenMode: (mode: AppMode) => void
  household: ChildOption[]
  items: NavItem[]
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: React.ReactNode
  /** Sub-page title shown in the phone app bar instead of the tab name. */
  pageTitle?: string
  /** Sub-page back action; also hides the phone tab bar so the page can own the bottom edge. */
  onBack?: () => void
}

export default function AppShell({ student, mode, onOpenMode, household, items, activeTab, onTabChange, children, pageTitle, onBack }: AppShellProps) {
  // Collapsed by default on iPad portrait so content keeps a 2-column grid.
  const narrow = useMediaQuery('(max-width: 1023px)')
  const [userCollapsed, setCollapsed] = useState<boolean | null>(null)
  const collapsed = userCollapsed ?? narrow
  const activeItem = items.find((i) => i.id === activeTab) ?? items[0]

  const reduced = useReducedMotion()
  const pageKey = `${mode}-${activeItem.id}-${pageTitle ?? ''}`
  // The first page shows as server-rendered; pages opened later animate in.
  const [firstPageKey] = useState(pageKey)

  useEffect(() => {
    setSoundMode(mode)
  }, [mode])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activeTab, mode, pageTitle])

  return (
    <TooltipProvider delayDuration={200}>
      <div className={mode === 'student' ? 'min-h-dvh bg-indigo-50/40' : 'min-h-dvh bg-slate-50'}>
        <div className="flex">
          <Sidebar
            mode={mode}
            onOpenMode={onOpenMode}
            household={household}
            items={items}
            activeTab={activeItem.id}
            onTabChange={onTabChange}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            student={student}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopAppBar title={pageTitle ?? activeItem.label} mode={mode} onOpenMode={onOpenMode} student={student} household={household} onBack={onBack} />
            <main
              className={
                onBack
                  ? 'mx-auto w-full max-w-6xl px-4 pt-5 pb-6 md:px-8 md:pt-10 md:pb-12'
                  : 'mx-auto w-full max-w-6xl px-4 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-8 md:pt-10 md:pb-12'
              }
            >
              {/*
                Enter animation only: `children` always renders the current route, so an
                exiting copy would mount the next page twice and drop what was typed meanwhile.
              */}
              <motion.div
                key={pageKey}
                variants={mode === 'student' ? studentPage(reduced) : parentPage}
                initial={pageKey === firstPageKey ? false : 'initial'}
                animate="animate"
              >
                {children}
              </motion.div>
            </main>
          </div>
        </div>
        {!onBack && <BottomTabBar mode={mode} items={items} activeTab={activeItem.id} onTabChange={onTabChange} />}
      </div>
    </TooltipProvider>
  )
}
