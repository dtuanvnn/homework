"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import FlashcardBuilder from "@/components/pages/FlashcardBuilder"
import { useLibrary } from "@/state/library-store"
import type { ExerciseSet, Question } from "@/lib/types"

/** The flashcard builder for a new set, or a saved one (seeded into the library cache). */
export default function FlashcardScreen({ set, questions }: { set?: ExerciseSet; questions?: Question[] }) {
  const router = useRouter()
  const { registerLeaveGuard } = useAppNavigation()
  const { primeSet } = useLibrary()

  useEffect(() => {
    if (set && questions) primeSet(set.id, questions, [])
  }, [primeSet, set, questions])

  return <FlashcardBuilder initialSet={set} initialQuestions={questions} onClose={() => router.push(TAB_PATHS.library)} registerLeaveGuard={registerLeaveGuard} />
}
