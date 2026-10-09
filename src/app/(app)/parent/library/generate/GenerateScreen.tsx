"use client"

import { useRouter } from "next/navigation"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import AIGenerate from "@/components/pages/AIGenerate"

export default function GenerateScreen({ skillsBySet }: { skillsBySet: Record<string, string[]> }) {
  const router = useRouter()
  const { registerLeaveGuard } = useAppNavigation()
  return (
    <AIGenerate
      skillsBySet={skillsBySet}
      onClose={() => router.push(TAB_PATHS.library)}
      registerLeaveGuard={registerLeaveGuard}
    />
  )
}
