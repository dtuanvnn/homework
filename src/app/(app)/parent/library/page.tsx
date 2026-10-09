"use client"

import { useAppNavigation } from "@/components/layout/AppFrame"
import { libraryPaths } from "@/components/layout/routes"
import ExerciseLibrary from "@/components/pages/ExerciseLibrary"

export default function LibraryPage() {
  const { navigate } = useAppNavigation()
  return (
    <ExerciseLibrary
      onOpenSet={(id) => navigate(libraryPaths.set(id))}
      onUpload={() => navigate(libraryPaths.upload)}
      onGenerate={() => navigate(libraryPaths.generate)}
    />
  )
}
