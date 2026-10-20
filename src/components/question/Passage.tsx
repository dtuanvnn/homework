import type { ReactNode } from "react"
import { Volume2 } from "lucide-react"
import QuestionPicture from "@/components/question/QuestionPicture"
import RichText from "@/components/question/RichText"
import { passagePieces, type PassagePiece } from "@/lib/blanks"
import { parsePassage, readable } from "@/lib/passage"
import type { QuestionGroup } from "@/lib/types"
import { cn } from "@/lib/utils"

const plainPieces = (pieces: PassagePiece[]) =>
  pieces.map((p, i) =>
    p.kind === "blank" ? <span key={i}>___</span> : p.bold ? <strong key={i}><RichText text={p.text} /></strong> : <RichText key={i} text={p.text} />,
  )

/**
 * A bài's shared prompt and figure. Without `layout` it is the prompt as typed
 * (one block, line breaks kept) with the figure below, as it always was. With
 * a layout it follows the paper (lib/passage.ts): instruction, centred title,
 * indented paragraphs or dialogue turns, the figure beside the text on iPad.
 * `renderPieces` draws text and blanks (split passages fill their blanks);
 * `reading` highlights the block being read aloud and `onReadBlock` gives each
 * paragraph or turn its own speaker button.
 */
export default function Passage({
  group,
  renderPieces = plainPieces,
  reading,
  onReadBlock,
  textClassName,
  pictureClassName,
}: {
  group: QuestionGroup
  renderPieces?: (pieces: PassagePiece[]) => ReactNode
  reading?: number
  onReadBlock?: (index: number) => void
  textClassName?: string
  pictureClassName?: string
}) {
  if (!group.layout) {
    return (
      <>
        {group.prompt && <p className={cn("break-words whitespace-pre-line", textClassName)}>{renderPieces(passagePieces(group.prompt))}</p>}
        <QuestionPicture question={group} className={pictureClassName} />
      </>
    )
  }
  const blocks = parsePassage(group.prompt, group.layout)
  return (
    <div className={cn("flow-root break-words", textClassName)}>
      {group.image && (
        <div className="mb-3 md:float-right md:mb-2 md:ml-4 md:w-2/5">
          <QuestionPicture question={group} className={cn("mx-auto", pictureClassName)} />
        </div>
      )}
      <div className="space-y-2">
        {blocks.map((block, i) => {
          const speaker = onReadBlock && readable(block) && block.kind !== "title" && (
            <button
              type="button"
              onClick={() => onReadBlock(i)}
              aria-label="Nghe đoạn này"
              className="ml-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-white align-middle indent-0 text-indigo-600 hover:bg-indigo-50"
            >
              <Volume2 className="size-4" aria-hidden />
            </button>
          )
          const highlight = reading === i && "rounded-lg bg-yellow-100 ring-4 ring-yellow-100"
          if (block.kind === "turn") {
            return (
              <div key={i} data-block={i} className={cn("grid grid-cols-[auto_1fr] gap-x-2", highlight)}>
                <span className="font-bold text-indigo-800">{block.speaker}:</span>
                <span className="whitespace-pre-line">
                  {renderPieces(block.pieces)}
                  {speaker}
                </span>
              </div>
            )
          }
          return (
            <p
              key={i}
              data-block={i}
              className={cn(
                "whitespace-pre-line",
                block.kind === "instruction" && "font-bold",
                block.kind === "title" && "text-center font-extrabold",
                block.kind === "paragraph" && group.layout === "doan-van" && "indent-8",
                highlight,
              )}
            >
              {renderPieces(block.pieces)}
              {speaker}
            </p>
          )
        })}
      </div>
    </div>
  )
}
