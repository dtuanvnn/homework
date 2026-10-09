"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Route } from "next"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { LibraryProvider } from "@/state/library-store"
import AppShell from "./AppShell"
import { MODE_LABELS, navFor, type NavCounts, type TabId } from "./nav-config"
import { MODE_HOME, TAB_PATHS, resolveRoute } from "./routes"
import type { AppMode, Assignment, ExerciseSet, Student } from "@/lib/types"

/** Called before leaving a page with unsaved changes; runs `next` once the user confirms. */
export type LeaveGuard = (next: () => void) => void

interface NavigationContext {
  /** Navigates within the app, first asking the open page's leave guard. */
  navigate: (path: Route) => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

const NavContext = createContext<NavigationContext | null>(null)

export function useAppNavigation(): NavigationContext {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error("useAppNavigation must be used inside <AppFrame>")
  return ctx
}

interface AppFrameProps {
  student: Student
  navCounts: NavCounts
  sets: ExerciseSet[]
  assignments: Assignment[]
  children: React.ReactNode
}

export default function AppFrame({ student, navCounts, sets, assignments, children }: AppFrameProps) {
  const pathname = usePathname()
  const router = useRouter()
  const route = resolveRoute(pathname)
  const { mode } = route
  const leaveGuard = useRef<LeaveGuard | null>(null)

  const registerLeaveGuard = useCallback((guard: LeaveGuard | null) => {
    leaveGuard.current = guard
  }, [])

  const navigate = useCallback(
    (path: Route) => {
      const go = () => router.push(path)
      if (leaveGuard.current) leaveGuard.current(go)
      else go()
    },
    [router],
  )

  // Student mode bumps the root font size (see globals.css) so all rem-based UI scales up.
  useEffect(() => {
    document.documentElement.dataset.mode = mode
  }, [mode])

  const handleModeChange = (next: AppMode) => {
    if (next === mode) return
    const go = () => {
      router.push(MODE_HOME[next])
      toast.success(`Đã chuyển sang chế độ ${MODE_LABELS[next]}`, {
        description: next === "student" ? `Chúc ${student.name} học vui nhé!` : "Quản lý bài tập của con.",
      })
    }
    if (leaveGuard.current) leaveGuard.current(go)
    else go()
  }

  const nav = useMemo(() => ({ navigate, registerLeaveGuard }), [navigate, registerLeaveGuard])

  return (
    <NavContext.Provider value={nav}>
      <LibraryProvider initialSets={sets} initialAssignments={assignments}>
        <AppShell
          student={student}
          mode={mode}
          onModeChange={handleModeChange}
          items={navFor(mode, navCounts)}
          activeTab={route.tab}
          onTabChange={(tab: TabId) => navigate(TAB_PATHS[tab])}
          pageTitle={route.subPageTitle}
          onBack={route.parentPath ? () => navigate(route.parentPath!) : undefined}
        >
          {children}
        </AppShell>
        <Toaster position="top-center" />
      </LibraryProvider>
    </NavContext.Provider>
  )
}
