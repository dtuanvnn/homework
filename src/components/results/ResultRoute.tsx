"use client"

import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS, studentPaths } from "@/components/layout/routes"
import type { ResultView } from "@/lib/views/student"
import ResultDetail from "./ResultDetail"

export default function ResultRoute({ result }: { result: ResultView }) {
  const { navigate } = useAppNavigation()
  return (
    <ResultDetail
      result={result}
      onRetry={() => navigate(studentPaths.take(result.assignmentId))}
      onHome={() => navigate(TAB_PATHS.today)}
    />
  )
}
