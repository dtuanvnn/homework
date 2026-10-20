import { Layers } from "lucide-react"
import QuestionPicture from "@/components/question/QuestionPicture"
import RichText from "@/components/question/RichText"
import type { QuestionGroup } from "@/lib/types"

/**
 * A bài's shared prompt and figure above each of its câu. Scrolls inside its
 * own box so a long passage never pushes the câu off screen; mount it keyed by
 * the bài so the scroll position survives moving between its câu.
 */
export default function SharedPromptBox({ group, title }: { group: QuestionGroup; title: string }) {
  return (
    <section aria-label={title} className="mb-6 rounded-3xl border border-indigo-100 bg-indigo-50/60">
      <p className="flex items-center gap-2 px-5 pt-4 text-sm font-bold tracking-wide text-indigo-700 uppercase md:px-6">
        <Layers className="size-4" aria-hidden />
        {title}
      </p>
      {(group.prompt || group.image) && (
        <div className="max-h-[30vh] space-y-4 overflow-y-auto px-5 pt-2 pb-5 md:max-h-[40vh] md:px-6" tabIndex={0}>
          {group.prompt && (
            <p className="text-lg leading-relaxed font-medium break-words whitespace-pre-line text-slate-800 md:text-xl">
              <RichText text={group.prompt} />
            </p>
          )}
          <QuestionPicture question={group} className="mx-auto max-h-80" />
        </div>
      )}
    </section>
  )
}
