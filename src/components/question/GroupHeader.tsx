import { Layers } from "lucide-react"
import QuestionPicture from "@/components/question/QuestionPicture"
import RichText from "@/components/question/RichText"
import { formatPoints, formatScoreValue } from "@/lib/format"
import type { QuestionGroup } from "@/lib/types"
import { cn } from "@/lib/utils"

/** A bài above its câu on the grading and result screens: "Part 3 · 8/10", then the shared prompt and figure. */
export default function GroupHeader({ group, title, awarded, max, className }: { group: QuestionGroup; title: string; awarded: number; max: number; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5", className)}>
      <p className="flex items-center gap-2 font-bold text-slate-900">
        <Layers className="size-5 text-indigo-600" aria-hidden />
        {title}
        <span className="ml-auto tabular-nums text-indigo-700">
          {formatScoreValue(Math.round(awarded * 100) / 100)}/{formatPoints(max)}
        </span>
      </p>
      {group.prompt && (
        <p className="leading-relaxed break-words whitespace-pre-line text-slate-800">
          <RichText text={group.prompt} />
        </p>
      )}
      <QuestionPicture question={group} className="max-h-72" />
    </div>
  )
}
