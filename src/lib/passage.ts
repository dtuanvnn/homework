import { passagePieces, type PassagePiece } from "./blanks"
import { plainRichText } from "./rich-text"
import type { PassageLayout } from "./types"

/*
 * A bài's shared prompt laid out like the paper (only when `group.layout` is
 * set; otherwise it shows as typed). One line per block:
 *   "# A Giant Rat"         title, centred and read aloud
 *   "**Read the text…**"    instruction (the whole line bold), not read aloud
 *   "Mai: Hi, Tom."         a dialogue turn, only in "hoi-thoai"
 *   anything else           a paragraph
 * "**word**" inside a line is bold. Blanks ("___") keep their index across
 * the whole prompt, so split passages still match their blank câu.
 * Rendering is components/question/Passage.
 */

export interface PassageBlock {
  kind: "instruction" | "title" | "paragraph" | "turn"
  speaker?: string
  speakerPieces?: PassagePiece[]
  pieces: PassagePiece[]
}

const TURN = /^([^:$_]{1,30}):\s+(.*)$/u
const WHOLE_BOLD = /^\*\*(.+)\*\*$/u

const blankCount = (pieces: PassagePiece[]) => pieces.filter((p) => p.kind === "blank").length

function slicePieces(pieces: PassagePiece[], from: number, to = Infinity): PassagePiece[] {
  let position = 0
  return pieces.flatMap((piece): PassagePiece[] => {
    const length = piece.kind === "blank" ? 3 : piece.text.length + (piece.math ? 2 : 0)
    const start = position
    position += length
    if (position <= from || start >= to) return []
    if (piece.kind === "blank" || piece.math) return [piece]
    return [{ ...piece, text: piece.text.slice(Math.max(0, from - start), to - start) }]
  })
}

export function parsePassage(prompt: string, layout: PassageLayout): PassageBlock[] {
  const blocks: PassageBlock[] = []
  let offset = 0
  for (const raw of prompt.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    let block: PassageBlock
    const bold = WHOLE_BOLD.exec(line)
    const plainLine = plainRichText(line)
    const turn = layout === "hoi-thoai" ? TURN.exec(plainLine) : null
    if (line.startsWith("# ")) block = { kind: "title", pieces: passagePieces(line.slice(2).trim(), offset) }
    else if (bold && !bold[1].includes("**")) block = { kind: "instruction", pieces: passagePieces(bold[1], offset) }
    else if (turn) {
      const pieces = passagePieces(line, offset)
      block = {
        kind: "turn",
        speaker: turn[1].trim(),
        speakerPieces: slicePieces(pieces, 0, turn[1].length),
        pieces: slicePieces(pieces, plainLine.length - turn[2].length),
      }
    }
    else block = { kind: "paragraph", pieces: passagePieces(line, offset) }
    offset += blankCount(block.pieces)
    blocks.push(block)
  }
  return blocks
}

/** Instructions are for reading, not for listening. */
export const readable = (block: PassageBlock) => block.kind !== "instruction"

/** What the device says for a block: no formulas, a pause at each blank, the speaker first. */
export function speechText(block: PassageBlock): string {
  const text = block.pieces
    .map((p) =>
      p.kind === "blank"
        ? ", "
        : p.math ? "" : p.text,
    )
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim()
  return block.speaker ? `${block.speaker}. ${text}` : text
}
