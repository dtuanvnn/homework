import { useMemo } from "react"
import { INK_COLOR, MARGIN_X, PAGE_H, PAGE_W, PAPER_COLORS, paperLineStyle, paperLines, strokePath, type Paper } from "@/lib/ink"
import { cn } from "@/lib/utils"

/** Notebook paper of a handwriting page: ô li or ruled lines and the red margin. */
export function InkPaper({ paper }: { paper: Paper }) {
  return (
    <>
      <rect width={PAGE_W} height={PAGE_H} fill="#ffffff" />
      {paperLines(paper).map((l) => {
        const { color, width } = paperLineStyle(paper, l.main)
        return <line key={l.y} x1={0} y1={l.y} x2={PAGE_W} y2={l.y} stroke={color} strokeWidth={width} />
      })}
      <line x1={MARGIN_X} y1={0} x2={MARGIN_X} y2={PAGE_H} stroke={PAPER_COLORS.margin} strokeWidth={1.5} />
    </>
  )
}

/** One handwriting page as SVG, drawn exactly like the take canvas and the AI image (lib/ink.ts). */
export function InkPageSvg({ paper, strokes, label, className }: { paper: Paper; strokes: number[][]; label: string; className?: string }) {
  const paths = useMemo(() => strokes.map((s) => strokePath(s)).filter(Boolean), [strokes])
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} role="img" aria-label={label} className={cn("block h-auto w-full", className)}>
      <InkPaper paper={paper} />
      {paths.map((d, i) => (
        <path key={i} d={d} fill={INK_COLOR} />
      ))}
    </svg>
  )
}
