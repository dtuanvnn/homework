"use client"

import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import StudentResults from "@/components/pages/StudentResults"

export default function ResultsPage() {
  const { navigate } = useAppNavigation()
  return <StudentResults onHome={() => navigate(TAB_PATHS.today)} />
}
