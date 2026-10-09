"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Route } from "next"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { LibraryProvider } from "@/state/library-store"
import AppShell from "./AppShell"
import { MODE_LABELS, NAV_BY_MODE, type TabId } from "./nav-config"
import { MODE_HOME, TAB_PATHS, resolveRoute } from "./routes"
import type { AppMode } from "@/lib/types"

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

export default function AppFrame({ children }: { children: React.ReactNode }) {
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
        description: next === "student" ? "Chúc Minh An học vui nhé!" : "Quản lý bài tập của con.",
      })
    }
    if (leaveGuard.current) leaveGuard.current(go)
    else go()
  }

  const nav = useMemo(() => ({ navigate, registerLeaveGuard }), [navigate, registerLeaveGuard])

  return (
    <NavContext.Provider value={nav}>
      <LibraryProvider>
        <AppShell
          mode={mode}
          onModeChange={handleModeChange}
          items={NAV_BY_MODE[mode]}
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
