import { Layers } from "lucide-react"
import BlankText, { type BlankSlotProps } from "@/components/question/BlankText"
import Passage from "@/components/question/Passage"
import { formatPoints, formatScoreValue } from "@/lib/format"
import type { QuestionGroup } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * A bài above its câu on the grading and result screens: "Part 3 · 8/10", then
 * the shared prompt and figure. `passage` (split passage) fills each blank.
 */
export default function GroupHeader({
  group,
  title,
  awarded,
  max,
  passage,
  className,
}: {
  group: QuestionGroup
  title: string
  awarded: number
  max: number
  passage?: (index: number) => BlankSlotProps
  className?: string
}) {
  return (
    <div className={cn("space-y-3 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5", className)}>
      <p className="flex items-center gap-2 font-bold text-slate-900">
        <Layers className="size-5 text-indigo-600" aria-hidden />
        {title}
        <span className="ml-auto tabular-nums text-indigo-700">
          {formatScoreValue(Math.round(awarded * 100) / 100)}/{formatPoints(max)}
        </span>
      </p>
      <Passage
        group={group}
        textClassName="leading-relaxed text-slate-800"
        pictureClassName="max-h-72"
        renderPieces={passage ? (pieces) => <BlankText pieces={pieces} slot={passage} /> : undefined}
      />
    </div>
  )
}
