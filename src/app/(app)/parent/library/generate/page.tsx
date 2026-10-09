import { getQuestions, listExerciseSets } from "@/server/queries"
import GenerateScreen from "./GenerateScreen"

// generateSet() waits for Claude, which can take a minute or two.
export const maxDuration = 300

export default async function GeneratePage() {
  const sets = await listExerciseSets()
  // Skill tags per set, offered as topic chips next to the sets' topics.
  const entries = await Promise.all(
    sets
      .filter((s) => s.questionCount > 0)
      .map(async (s) => [s.id, [...new Set((await getQuestions(s.id)).flatMap((q) => q.skills))]] as [string, string[]]),
  )
  return <GenerateScreen skillsBySet={Object.fromEntries(entries)} />
}
