"use client"

import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import ParentDashboard from "@/components/pages/ParentDashboard"

export default function DashboardPage() {
  const { navigate } = useAppNavigation()
  return <ParentDashboard onNavigate={(tab) => navigate(TAB_PATHS[tab])} />
}
