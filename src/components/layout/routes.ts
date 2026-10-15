import type { Route } from "next"
import type { AppMode } from "@/lib/types"
import type { TabId } from "./nav-config"

export const TAB_PATHS: Record<TabId, Route> = {
  dashboard: "/parent",
  library: "/parent/library",
  schedule: "/parent/schedule",
  grading: "/parent/grading",
  reports: "/parent/reports",
  today: "/student",
  assignments: "/student/assignments",
  results: "/student/results",
  rewards: "/student/rewards",
}

export const MODE_HOME: Record<AppMode, Route> = {
  parent: TAB_PATHS.dashboard,
  student: TAB_PATHS.today,
}

export const studentPaths = {
  /** Full-screen take-assignment flow (starts or resumes the current attempt). */
  take: (assignmentId: string) => `/student/assignments/${encodeURIComponent(assignmentId)}/do` as Route,
  /** Paper submission: photograph pages and hand in. */
  paper: (assignmentId: string) => `/student/assignments/${encodeURIComponent(assignmentId)}/paper` as Route,
  result: (attemptId: string) => `/student/results/${encodeURIComponent(attemptId)}` as Route,
}

export const gradingPaths = {
  attempt: (attemptId: string) => `/parent/grading/${encodeURIComponent(attemptId)}` as Route,
}

export const parentPaths = {
  rewards: "/parent/rewards" as Route,
  students: "/parent/students" as Route,
  student: (id: string) => `/parent/students/${encodeURIComponent(id)}` as Route,
}

export const libraryPaths = {
  set: (id: string) => `/parent/library/${encodeURIComponent(id)}` as Route,
  upload: "/parent/library/upload" as Route,
  generate: "/parent/library/generate" as Route,
}

/** Sub-pages of a tab: title shown in the phone app bar, plus a back button and no tab bar. */
const SUB_PAGE_TITLES: [RegExp, string][] = [
  [/^\/parent\/library\/upload$/, "Tải lên tài liệu"],
  [/^\/parent\/library\/generate$/, "Tạo bằng AI"],
  [/^\/parent\/library\/[^/]+$/, "Chi tiết bộ bài tập"],
  [/^\/parent\/grading\/[^/]+$/, "Chấm bài"],
  [/^\/parent\/rewards$/, "Phần thưởng"],
  [/^\/parent\/students$/, "Học sinh"],
  [/^\/parent\/students\/[^/]+$/, "Chi tiết học sinh"],
  [/^\/student\/assignments\/[^/]+\/do$/, "Làm bài"],
  [/^\/student\/assignments\/[^/]+\/paper$/, "Nộp bài giấy"],
  [/^\/student\/results\/[^/]+$/, "Kết quả"],
]

export interface RouteInfo {
  mode: AppMode
  tab: TabId
  subPageTitle?: string
  /** Where the sub-page back button goes. */
  parentPath?: Route
}

export function resolveRoute(pathname: string): RouteInfo {
  const mode: AppMode = pathname.startsWith("/student") ? "student" : "parent"
  // Longest matching tab path wins, so /parent/library beats /parent.
  const tab = (Object.entries(TAB_PATHS) as [TabId, string][])
    .filter(([, path]) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? (mode === "parent" ? "dashboard" : "today")
  const sub = SUB_PAGE_TITLES.find(([re]) => re.test(pathname))
  return sub ? { mode, tab, subPageTitle: sub[1], parentPath: TAB_PATHS[tab] } : { mode, tab }
}
