import { passagePieces, type PassagePiece } from "./blanks"
import { splitRichText } from "./rich-text"
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
  pieces: PassagePiece[]
}

const TURN = /^([^:$_]{1,30}):\s+(.*)$/u
const WHOLE_BOLD = /^\*\*(.+)\*\*$/u

/** Text with "**…**" pairs as bold pieces and blanks numbered after `offset`; an unpaired "**" stays literal. */
function inline(text: string, offset: number): PassagePiece[] {
  const parts = text.split("**")
  if (parts.length % 2 === 0) parts.splice(-2, 2, `${parts.at(-2)}**${parts.at(-1)}`)
  let blanks = offset
  return parts.flatMap((part, i) => {
    const pieces = passagePieces(part, blanks).map((p) => (i % 2 === 1 && p.kind === "text" ? { ...p, bold: true } : p))
    blanks += pieces.filter((p) => p.kind === "blank").length
    return pieces
  })
}

const blankCount = (pieces: PassagePiece[]) => pieces.filter((p) => p.kind === "blank").length

export function parsePassage(prompt: string, layout: PassageLayout): PassageBlock[] {
  const blocks: PassageBlock[] = []
  let offset = 0
  for (const raw of prompt.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    let block: PassageBlock
    const bold = WHOLE_BOLD.exec(line)
    const turn = layout === "hoi-thoai" ? TURN.exec(line) : null
    if (line.startsWith("# ")) block = { kind: "title", pieces: inline(line.slice(2).trim(), offset) }
    else if (bold && !bold[1].includes("**")) block = { kind: "instruction", pieces: inline(bold[1], offset) }
    else if (turn) block = { kind: "turn", speaker: turn[1].trim(), pieces: inline(turn[2], offset) }
    else block = { kind: "paragraph", pieces: inline(line, offset) }
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
        : splitRichText(p.text)
            .map((s) => (s.kind === "text" ? s.text : ""))
            .join(""),
    )
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim()
  return block.speaker ? `${block.speaker}. ${text}` : text
}
