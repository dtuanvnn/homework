"use client"

import { useRouter } from "next/navigation"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS, libraryPaths } from "@/components/layout/routes"
import UploadFlow from "@/components/pages/UploadFlow"

export default function UploadPage() {
  const router = useRouter()
  const { registerLeaveGuard } = useAppNavigation()
  return (
    <UploadFlow
      onClose={() => router.push(TAB_PATHS.library)}
      onOpenSet={(id) => router.push(libraryPaths.set(id))}
      registerLeaveGuard={registerLeaveGuard}
    />
  )
}
