import { useEffect, useRef } from "react"
import { Layers } from "lucide-react"
import BlankText from "@/components/question/BlankText"
import Passage from "@/components/question/Passage"
import PassageListen from "@/components/question/PassageListen"
import { usePassageReader } from "@/components/question/use-passage-reader"
import type { SpeechLang } from "@/lib/speech"
import type { QuestionGroup } from "@/lib/types"

/** A split passage's blanks: câu number and what the child wrote, keyed by blank index; `current` is being answered. */
export interface PassageBlanks {
  slots: Map<number, { number: number; given?: string }>
  current?: number
}

/**
 * A bài's shared prompt and figure above each of its câu. Scrolls inside its
 * own box so a long passage never pushes the câu off screen; mount it keyed by
 * the bài so the scroll position survives moving between its câu. A split
 * passage shows each blank's câu number and answer, the current one highlighted.
 */
export default function SharedPromptBox({
  group,
  title,
  blanks,
  speech,
}: {
  group: QuestionGroup
  title: string
  blanks?: PassageBlanks
  speech?: SpeechLang | null
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const reader = usePassageReader(group, speech ?? null)
  const current = blanks?.current
  useEffect(() => {
    if (current === undefined) return
    scroller.current?.querySelector("[aria-current='true']")?.scrollIntoView({ block: "nearest" })
  }, [current])
  const reading = reader.reading
  useEffect(() => {
    if (reading === undefined) return
    scroller.current?.querySelector(`[data-block='${reading}']`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [reading])
  return (
    <section aria-label={title} className="mb-6 rounded-3xl border border-indigo-100 bg-indigo-50/60">
      <p className="flex items-center gap-2 px-5 pt-4 text-sm font-bold tracking-wide text-indigo-700 uppercase md:px-6">
        <Layers className="size-4" aria-hidden />
        {title}
        {reader.available && speech && (
          <span className="ml-auto">
            <PassageListen reader={reader} lang={speech} />
          </span>
        )}
      </p>
      {(group.prompt || group.image) && (
        <div ref={scroller} className="max-h-[30vh] space-y-4 overflow-y-auto px-5 pt-2 pb-5 md:max-h-[40vh] md:px-6" tabIndex={0}>
          <Passage
            group={group}
            textClassName="text-lg leading-relaxed font-medium text-slate-800 md:text-xl"
            pictureClassName="mx-auto max-h-80"
            reading={reader.reading}
            onReadBlock={reader.available && reader.hasVoice ? reader.playBlock : undefined}
            renderPieces={
              blanks
                ? (pieces) => (
                    <BlankText
                      pieces={pieces}
                      slot={(index) => {
                        const s = blanks.slots.get(index)
                        return { label: s ? String(s.number) : undefined, given: s?.given, current: index === blanks.current }
                      }}
                    />
                  )
                : undefined
            }
          />
        </div>
      )}
    </section>
  )
}
