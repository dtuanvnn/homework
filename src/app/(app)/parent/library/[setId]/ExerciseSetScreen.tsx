"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import ExerciseSetDetail from "@/components/pages/ExerciseSetDetail"
import { useLibrary } from "@/state/library-store"
import type { Attachment, ExerciseSet, Question } from "@/lib/types"

/** Seeds the library cache with the server-loaded set and renders the editor. */
export default function ExerciseSetScreen({
  set,
  questions,
  attachments,
}: {
  set: ExerciseSet
  questions: Question[]
  attachments: Attachment[]
}) {
  const router = useRouter()
  const { registerLeaveGuard } = useAppNavigation()
  const { primeSet } = useLibrary()

  useEffect(() => primeSet(set.id, questions, attachments), [primeSet, set.id, questions, attachments])

  return (
    <ExerciseSetDetail
      initialSet={set}
      initialQuestions={questions}
      initialAttachments={attachments}
      onClose={() => router.push(TAB_PATHS.library)}
      registerLeaveGuard={registerLeaveGuard}
    />
  )
}
