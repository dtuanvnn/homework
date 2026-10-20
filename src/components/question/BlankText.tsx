import { Check } from "lucide-react"
import RichText from "@/components/question/RichText"
import type { PassagePiece } from "@/lib/blanks"
import { cn } from "@/lib/utils"

/** How one blank shows: "(label) given", coloured by `correct`, the key after a wrong word. */
export interface BlankSlotProps {
  label?: string
  given?: string
  correct?: boolean | null
  answer?: string
  /** The blank being answered on the take screen. */
  current?: boolean
}

/**
 * A sentence or passage with its blanks filled in: green ✓ when right, red
 * struck-through then the right word when wrong, neutral otherwise, "___" when
 * empty. Inline content: put it inside a <p> with whitespace-pre-line.
 */
export default function BlankText({ pieces, slot }: { pieces: PassagePiece[]; slot: (index: number) => BlankSlotProps }) {
  return (
    <>
      {pieces.map((piece, i) => {
        if (piece.kind === "text") return <RichText key={i} text={piece.text} />
        const s = slot(piece.index)
        const label = s.label ? `(${s.label}) ` : ""
        return (
          <span key={i} className="inline-flex flex-wrap items-baseline gap-1 align-baseline">
            <span
              aria-current={s.current ? "true" : undefined}
              className={cn(
                "rounded-md px-1.5 font-semibold",
                s.current && "border-2 border-yellow-500 bg-yellow-200 text-slate-900",
                !s.current && s.correct === true && "bg-emerald-100 text-emerald-800",
                !s.current && s.correct === false && "bg-red-100 text-red-700 line-through",
                !s.current && (s.correct === null || s.correct === undefined) && (s.given ? "bg-slate-100 text-slate-800" : "text-slate-500"),
              )}
            >
              {label}
              {s.given ? <RichText text={s.given} /> : "___"}
              {s.correct === true && <Check className="ml-0.5 inline size-3.5" aria-label="đúng" />}
              {s.correct === false && <span className="sr-only"> (sai)</span>}
            </span>
            {s.correct === false && s.answer && (
              <span className="rounded-md bg-emerald-100 px-1.5 font-semibold text-emerald-800">
                <span className="sr-only">đáp án: </span>
                <RichText text={s.answer} />
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}
