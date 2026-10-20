import { Layers } from "lucide-react"
import BlankText, { type BlankSlotProps } from "@/components/question/BlankText"
import Passage from "@/components/question/Passage"
import PassageListen from "@/components/question/PassageListen"
import { usePassageReader } from "@/components/question/use-passage-reader"
import type { SpeechLang } from "@/lib/speech"
import { formatPoints, formatScoreValue } from "@/lib/format"
import type { QuestionGroup } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * A bài above its câu on the grading and result screens: "Part 3 · 8/10", then
 * the shared prompt and figure. `passage` (split passage) fills each blank;
 * `speech` (the child's result only) reads a formatted passage aloud.
 */
export default function GroupHeader({
  group,
  title,
  awarded,
  max,
  passage,
  speech,
  className,
}: {
  group: QuestionGroup
  title: string
  awarded: number
  max: number
  passage?: (index: number) => BlankSlotProps
  speech?: SpeechLang | null
  className?: string
}) {
  const reader = usePassageReader(group, speech ?? null)
  return (
    <div className={cn("space-y-3 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5", className)}>
      <p className="flex items-center gap-2 font-bold text-slate-900">
        <Layers className="size-5 text-indigo-600" aria-hidden />
        {title}
        <span className="ml-auto tabular-nums text-indigo-700">
          {formatScoreValue(Math.round(awarded * 100) / 100)}/{formatPoints(max)}
        </span>
      </p>
      {reader.available && speech && (
        <div className="flex justify-end">
          <PassageListen reader={reader} lang={speech} />
        </div>
      )}
      <Passage
        group={group}
        textClassName="leading-relaxed text-slate-800"
        pictureClassName="max-h-72"
        reading={reader.reading}
        onReadBlock={reader.available && reader.hasVoice ? reader.playBlock : undefined}
        renderPieces={passage ? (pieces) => <BlankText pieces={pieces} slot={passage} /> : undefined}
      />
    </div>
  )
}
