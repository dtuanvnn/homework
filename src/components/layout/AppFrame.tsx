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

import NoStudents from "@/components/students/NoStudents"

import AppShell from "./AppShell"

import { navFor, type NavCounts, type TabId } from "./nav-config"

import { MODE_HOME, parentPaths, TAB_PATHS, resolveRoute } from "./routes"

import type { AppMode, Assignment, ChildOption, ExerciseSet, Student } from "@/lib/types"

export type LeaveGuard = (next: () => void) => void

interface NavigationContext {
  navigate: (path: Route) => void

  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

const NavContext = createContext<NavigationContext | null>(null)

const StudentContext = createContext<Student | null>(null)

const HouseholdContext = createContext<ChildOption[]>([])

export function useStudent(): Student | null {
  return useContext(StudentContext)
}

/** For pages that only render with a child (everything except the Students page and the empty state). */
export function useRequiredStudent(): Student {
  const student = useStudent()
  if (!student) throw new Error("useRequiredStudent needs a child")
  return student
}

export function useHousehold(): ChildOption[] {
  return useContext(HouseholdContext)
}

export function useAppNavigation(): NavigationContext {
  const ctx = useContext(NavContext)

  if (!ctx) throw new Error("useAppNavigation must be used inside <AppFrame>")

  return ctx
}

interface AppFrameProps {
  student: Student | null

  navCounts: NavCounts

  sets: ExerciseSet[]

  assignments: Assignment[]

  household: ChildOption[]

  now: string

  children: React.ReactNode
}

export default function AppFrame({
  student,
  navCounts,
  sets,
  assignments,
  household,
  now,
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

  // Student mode: check for lock every minute, on focus, and on visibility change.
  useEffect(() => {
    if (mode !== "student") return
    const check = () => router.refresh()
    const timer = window.setInterval(check, 60_000)
    const onFocus = () => check()
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [mode, router])

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

  const showEmptyState = student === null && pathname !== parentPaths.students

  return (
    <NavContext.Provider value={nav}>
      <StudentContext.Provider value={student}>
        <HouseholdContext.Provider value={household}>
          <LibraryProvider initialSets={sets} initialAssignments={assignments}>
            <AppShell
              student={student}
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
              {showEmptyState ? <NoStudents now={now} /> : children}
            </AppShell>
            {/* Phone: keep toasts below the app bar so they never cover the header buttons. */}
            <Toaster position="top-center" mobileOffset={{ top: "calc(env(safe-area-inset-top) + 72px)" }} />
          </LibraryProvider>
        </HouseholdContext.Provider>
      </StudentContext.Provider>
    </NavContext.Provider>
  )
}
