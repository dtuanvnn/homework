import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import AppShell from "@/components/layout/AppShell"
import {
  MODE_LABELS,
  NAV_BY_MODE,
  type ParentTabId,
  type StudentTabId,
  type TabId,
} from "@/components/layout/nav-config"
import ExerciseLibrary from "@/components/pages/ExerciseLibrary"
import ExerciseSetDetail, {
  type LeaveGuard,
} from "@/components/pages/ExerciseSetDetail"
import UploadFlow from "@/components/pages/UploadFlow"
import AIGenerate from "@/components/pages/AIGenerate"
import ParentDashboard from "@/components/pages/ParentDashboard"
import Schedule from "@/components/pages/Schedule"
import Grading from "@/components/pages/Grading"
import Reports from "@/components/pages/Reports"
import StudentToday from "@/components/pages/StudentToday"
import StudentResults from "@/components/pages/StudentResults"
import StudentAssignments from "@/components/pages/StudentAssignments"
import PlaceholderPage from "@/components/pages/PlaceholderPage"
import { Toaster } from "@/components/ui/sonner"
import type { AppMode } from "@/lib/types"
import { LibraryProvider } from "@/state/library-store"

export default function App() {
  const [mode, setMode] = useState<AppMode>("parent")
  const [parentTab, setParentTab] = useState<ParentTabId>("dashboard")
  const [studentTab, setStudentTab] = useState<StudentTabId>("today")
  /** Exercise set open in the library detail view (sub-page of "Kho bài tập"). */
  const [openSetId, setOpenSetId] = useState<string | null>(null)
  /** "Tải lên tài liệu" flow (sub-page of "Kho bài tập"). */
  const [uploadOpen, setUploadOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const leaveGuard = useRef<LeaveGuard | null>(null)
  const registerLeaveGuard = useCallback((guard: LeaveGuard | null) => {
    leaveGuard.current = guard
  }, [])

  /** Runs `next`, first asking the open detail page to confirm unsaved changes. */
  const leaveDetail = (next: () => void) => {
    const go = () => {
      setOpenSetId(null)
      setUploadOpen(false)
      setAiOpen(false)
      next()
    }
    if ((openSetId || uploadOpen || aiOpen) && leaveGuard.current)
      leaveGuard.current(go)
    else go()
  }

  const items = NAV_BY_MODE[mode]
  const activeTab: TabId = mode === "parent" ? parentTab : studentTab
  const activeItem = items.find((i) => i.id === activeTab) ?? items[0]

  // Student mode bumps the root font size (see index.css) so all rem-based UI scales up.
  useEffect(() => {
    document.documentElement.dataset.mode = mode
  }, [mode])

  const handleModeChange = (next: AppMode) => {
    if (next === mode) return
    leaveDetail(() => switchMode(next))
  }

  const switchMode = (next: AppMode) => {
    setMode(next)
    toast.success(`Đã chuyển sang chế độ ${MODE_LABELS[next]}`, {
      description:
        next === "student"
          ? "Chúc Minh An học vui nhé!"
          : "Quản lý bài tập của con.",
    })
  }

  const handleTabChange = (tab: TabId) => {
    leaveDetail(() => {
      if (mode === "parent") setParentTab(tab as ParentTabId)
      else setStudentTab(tab as StudentTabId)
    })
  }

  const inLibrary = mode === "parent" && activeItem.id === "library"
  const showSetDetail = inLibrary && openSetId !== null
  const showUpload = inLibrary && !showSetDetail && uploadOpen
  const showAI = inLibrary && !showSetDetail && !showUpload && aiOpen
  const subPageTitle = showSetDetail
    ? "Chi tiết bộ bài tập"
    : showUpload
      ? "Tải lên tài liệu"
      : showAI
        ? "Tạo bằng AI"
        : undefined

  return (
    <LibraryProvider>
      <AppShell
        mode={mode}
        onModeChange={handleModeChange}
        items={items}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pageTitle={subPageTitle}
        onBack={subPageTitle ? () => leaveDetail(() => {}) : undefined}
      >
        {mode === "parent" && activeItem.id === "dashboard" ? (
          <ParentDashboard onNavigate={setParentTab} />
        ) : mode === "parent" && activeItem.id === "schedule" ? (
          <Schedule />
        ) : mode === "parent" && activeItem.id === "grading" ? (
          <Grading />
        ) : mode === "parent" && activeItem.id === "reports" ? (
          <Reports />
        ) : mode === "student" && activeItem.id === "today" ? (
          <StudentToday />
        ) : mode === "student" && activeItem.id === "assignments" ? (
          <StudentAssignments />
        ) : mode === "student" && activeItem.id === "results" ? (
          <StudentResults onHome={() => setStudentTab("today")} />
        ) : showSetDetail ? (
          <ExerciseSetDetail
            key={openSetId}
            setId={openSetId}
            onClose={() => setOpenSetId(null)}
            registerLeaveGuard={registerLeaveGuard}
          />
        ) : showUpload ? (
          <UploadFlow
            onClose={() => setUploadOpen(false)}
            onOpenSet={(id) => {
              setUploadOpen(false)
              setOpenSetId(id)
            }}
            registerLeaveGuard={registerLeaveGuard}
          />
        ) : showAI ? (
          <AIGenerate
            onClose={() => setAiOpen(false)}
            registerLeaveGuard={registerLeaveGuard}
          />
        ) : inLibrary ? (
          <ExerciseLibrary
            onOpenSet={setOpenSetId}
            onUpload={() => setUploadOpen(true)}
            onGenerate={() => setAiOpen(true)}
          />
        ) : (
          <PlaceholderPage
            key={`${mode}-${activeItem.id}`}
            item={activeItem}
            mode={mode}
          />
        )}
      </AppShell>
      <Toaster position="top-center" />
    </LibraryProvider>
  )
}
