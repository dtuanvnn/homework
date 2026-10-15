"use client"

/** Called before leaving a page with unsaved changes; runs `next` once the user confirms. */

/** Navigates within the app, first asking the open page's leave guard. */

/** The (only) student, loaded by the app layout. */

// Student mode bumps the root font size (see globals.css) so all rem-based UI scales up.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"

import { usePathname, useRouter } from "next/navigation"

import type { Route } from "next"

import { Toaster } from "@/components/ui/sonner"

import { LibraryProvider } from "@/state/library-store"

import AppShell from "./AppShell"

import { navFor, type NavCounts, type TabId } from "./nav-config"

import { MODE_HOME, TAB_PATHS, resolveRoute } from "./routes"

import type { AppMode, Assignment, ChildOption, ExerciseSet, Student } from "@/lib/types"

export type LeaveGuard = (next: () => void) => void

interface NavigationContext {
  navigate: (path: Route) => void

  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

const NavContext = createContext<NavigationContext | null>(null)

const StudentContext = createContext<Student | null>(null)

const HouseholdContext = createContext<ChildOption[]>([])

export function useStudent(): Student {
  const ctx = useContext(StudentContext)

  if (!ctx) throw new Error("useStudent must be used inside <AppFrame>")

  return ctx
}

export function useHousehold(): ChildOption[] {
  return useContext(HouseholdContext)
}

export function useAppNavigation(): NavigationContext {
  const ctx = useContext(NavContext)

  if (!ctx) throw new Error("useAppNavigation must be used inside <AppFrame>")

  return ctx
}

const NO_STUDENT: Student = { id: "", householdId: "", name: "Chưa có học sinh", grade: 1, schoolYear: 0, avatarEmoji: "👤", totalStars: 0 }

interface AppFrameProps {
  student: Student | null

  navCounts: NavCounts

  sets: ExerciseSet[]

  assignments: Assignment[]

  household: ChildOption[]

  children: React.ReactNode
}

export default function AppFrame({
  student,
  navCounts,
  sets,
  assignments,
  household,
  children,
}: AppFrameProps) {
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

  useEffect(() => {
    document.documentElement.dataset.mode = mode
  }, [mode])

  const openMode = (next: AppMode) => {
    if (next === mode) return

    // Full page load: each mode has its own PIN (proxy.ts asks for it), and
    // the other mode's pages must not linger in the client router cache. On a
    // device with a student token and a parent PIN set, the proxy turns
    // `/parent` into the parent PIN page.
    const go = () => window.location.assign(MODE_HOME[next])

    if (leaveGuard.current) leaveGuard.current(go)
    else go()
  }

  const nav = useMemo(
    () => ({ navigate, registerLeaveGuard }),
    [navigate, registerLeaveGuard],
  )

  return (
    <NavContext.Provider value={nav}>
      <StudentContext.Provider value={student ?? NO_STUDENT}>
        <HouseholdContext.Provider value={household}>
          <LibraryProvider initialSets={sets} initialAssignments={assignments}>
            <AppShell
              student={student ?? NO_STUDENT}
              mode={mode}
              onOpenMode={openMode}
              household={household}
              items={navFor(mode, navCounts)}
              activeTab={route.tab}
              onTabChange={(tab: TabId) => navigate(TAB_PATHS[tab])}
              pageTitle={route.subPageTitle}
              onBack={
                route.parentPath ? () => navigate(route.parentPath!) : undefined
              }
            >
              {children}
            </AppShell>
            {/* Phone: keep toasts below the app bar so they never cover the header buttons. */}
            <Toaster position="top-center" mobileOffset={{ top: "calc(env(safe-area-inset-top) + 72px)" }} />
          </LibraryProvider>
        </HouseholdContext.Provider>
      </StudentContext.Provider>
    </NavContext.Provider>
  )
}
