"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Eraser, Hand, PenLine, Trash2, Undo2 } from "lucide-react"
import { eraseStrokes, newInk, pageHeight, type Ink, type Paper } from "@/lib/ink"
import { ERASER_R, HISTORY, InkCanvasPage, ToolBtn, useFingerMode, type Tool } from "./InkEditor"

/**
 * One wide handwriting strip (a written word, `size: "strip"`): pen, eraser,
 * undo and "Xóa hết". Same strokes and Pencil/finger rules as InkEditor.
 */
export default function InkStrip({ ink, paper, label, onChange }: { ink: Ink | undefined; paper: Paper; label: string; onChange: (ink: Ink) => void }) {
  const value = ink ?? newInk(paper, "strip")
  const current = useRef(value)
  useLayoutEffect(() => {
    current.current = value
  })
  const undo = useRef<number[][][]>([])
  const erasing = useRef(false)
  const [undoCount, setUndoCount] = useState(0)
  const [tool, setTool] = useState<Tool>("pen")
  const [finger, setFinger] = useFingerMode()

  const setStrokes = (strokes: number[][], record = true) => {
    if (record) {
      undo.current.push(current.current.pages[0].strokes)
      if (undo.current.length > HISTORY) undo.current.shift()
      setUndoCount(undo.current.length)
    }
    const next: Ink = { ...current.current, pages: [{ strokes }] }
    current.current = next
    onChange(next)
  }
  const strokes = value.pages[0]?.strokes ?? []

  return (
    <div className="space-y-2">
      <InkCanvasPage
        label={label}
        height={pageHeight(value)}
        paper={value.paper}
        strokes={strokes}
        tool={tool}
        finger={finger}
        onStroke={(s) => setStrokes([...current.current.pages[0].strokes, s])}
        onErase={(x, y) => {
          const before = current.current.pages[0].strokes
          const after = eraseStrokes(before, x, y, ERASER_R)
          if (after === before) return
          setStrokes(after, !erasing.current)
          erasing.current = true
        }}
        onEraseEnd={() => {
          erasing.current = false
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ToolBtn on={tool === "pen"} onClick={() => setTool("pen")} icon={PenLine} label="Bút" />
        <ToolBtn on={tool === "eraser"} onClick={() => setTool("eraser")} icon={Eraser} label="Tẩy" />
        <ToolBtn
          onClick={() => {
            const prev = undo.current.pop()
            if (!prev) return
            setUndoCount(undo.current.length)
            setStrokes(prev, false)
          }}
          disabled={!undoCount}
          icon={Undo2}
          label="Hoàn tác"
        />
        <ToolBtn onClick={() => setStrokes([])} disabled={!strokes.length} icon={Trash2} label="Xóa hết" />
        <ToolBtn on={finger} onClick={() => setFinger(!finger)} icon={Hand} label="Viết bằng ngón tay" className="ml-auto" />
      </div>
    </div>
  )
}
