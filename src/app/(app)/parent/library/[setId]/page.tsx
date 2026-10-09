"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import ExerciseSetDetail from "@/components/pages/ExerciseSetDetail"

export default function ExerciseSetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = use(params)
  const router = useRouter()
  const { registerLeaveGuard } = useAppNavigation()
  return (
    <ExerciseSetDetail
      key={setId}
      setId={decodeURIComponent(setId)}
      onClose={() => router.push(TAB_PATHS.library)}
      registerLeaveGuard={registerLeaveGuard}
    />
  )
}
