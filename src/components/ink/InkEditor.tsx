"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { Eraser, Hand, PenLine, Plus, Redo2, Trash2, Undo2 } from "lucide-react"
import { eraseStrokes, INK_COLOR, MAX_PAGES, PAGE_H, PAGE_W, quantizePoint, strokePath, type Ink } from "@/lib/ink"
import { cn } from "@/lib/utils"
import { InkPaper } from "./InkPage"

/*
 * Handwriting on notebook pages (vector strokes, see lib/ink.ts). Apple Pencil
 * and the mouse write; fingers scroll unless "Viết bằng ngón tay" is on, so a
 * palm resting on the iPad leaves no marks.
 */

export type Tool = "pen" | "eraser"

export const HISTORY = 50
/** Eraser radius in page units. */
export const ERASER_R = 14
const FINGER_KEY = "hh-ink-finger"

/* ---------- "Viết bằng ngón tay" (remembered on the device) ---------- */

const fingerListeners = new Set<() => void>()
/** "Viết bằng ngón tay" and its setter, shared by every handwriting area on the device. */
export function useFingerMode(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribeFinger, readFinger, () => false), writeFinger]
}

function readFinger(): boolean {
  try {
    return localStorage.getItem(FINGER_KEY) === "1"
  } catch {
    return false
  }
}
function writeFinger(on: boolean) {
  try { localStorage.setItem(FINGER_KEY, on ? "1" : "0") } catch { /* private mode */ }
  fingerListeners.forEach((l) => l())
}
function subscribeFinger(l: () => void) {
  fingerListeners.add(l)
  return () => fingerListeners.delete(l)
}

/* ---------- Editor ---------- */

export function InkEditor({ ink, onChange }: { ink: Ink; onChange: (ink: Ink) => void }) {
  // Latest ink, also between a change and the re-render it causes (fast eraser drags).
  const current = useRef(ink)
  useLayoutEffect(() => {
    current.current = ink
  }, [ink])
  const undo = useRef<Ink[]>([])
  const redo = useRef<Ink[]>([])
  const erasing = useRef({ recorded: false })
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const [scrollTo, setScrollTo] = useState<{ page: number } | null>(null)
  const [history, setHistory] = useState({ undo: 0, redo: 0 })
  const [tool, setTool] = useState<Tool>("pen")
  const [finger] = useFingerMode()

  const apply = (next: Ink, record = true) => {
    if (record) {
      undo.current.push(current.current)
      if (undo.current.length > HISTORY) undo.current.shift()
      redo.current = []
    }
    current.current = next
    onChange(next)
    setHistory({ undo: undo.current.length, redo: redo.current.length })
  }
  const setPage = (page: number, strokes: number[][], record = true) => {
    const now = current.current
    apply({ ...now, pages: now.pages.map((p, i) => (i === page ? { strokes } : p)) }, record)
  }
  const step = (from: React.RefObject<Ink[]>, to: React.RefObject<Ink[]>) => {
    const target = from.current.pop()
    if (!target) return
    to.current.push(current.current)
    apply(target, false)
  }

  useEffect(() => {
    if (scrollTo === null) return
    pageRefs.current[scrollTo.page]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [scrollTo])

  const addPage = () => {
    const now = current.current
    if (now.pages.length >= MAX_PAGES) return
    apply({ ...now, pages: [...now.pages, { strokes: [] }] })
    setScrollTo({ page: now.pages.length })
  }
  const deletePage = (page: number) => {
    const now = current.current
    const n = now.pages.length
    if (now.pages[page].strokes.length && !window.confirm(n > 1 ? `Xóa trang ${page + 1}?` : "Xóa hết chữ trên trang này?")) return
    if (n > 1) apply({ ...now, pages: now.pages.filter((_, i) => i !== page) })
    else setPage(page, [])
  }

  const n = ink.pages.length
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToolBtn on={tool === "pen"} onClick={() => setTool("pen")} icon={PenLine} label="Bút" />
        <ToolBtn on={tool === "eraser"} onClick={() => setTool("eraser")} icon={Eraser} label="Tẩy" />
        <ToolBtn onClick={() => step(undo, redo)} disabled={!history.undo} icon={Undo2} label="Hoàn tác" />
        <ToolBtn onClick={() => step(redo, undo)} disabled={!history.redo} icon={Redo2} label="Làm lại" />
        <ToolBtn on={finger} onClick={() => writeFinger(!finger)} icon={Hand} label="Viết bằng ngón tay" className="ml-auto" />
      </div>
      {ink.pages.map((p, i) => (
        <div
          key={i}
          ref={(el) => {
            pageRefs.current[i] = el
          }}
          className="space-y-1.5"
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-slate-500">
              Trang {i + 1}/{n}
            </span>
            <button
              type="button"
              onClick={() => deletePage(i)}
              aria-label={n > 1 ? `Xóa trang ${i + 1}` : "Xóa hết"}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-4" />
              {n > 1 ? "Xóa trang" : "Xóa hết"}
            </button>
          </div>
          <InkCanvasPage
            label={`Trang ${i + 1} – khung viết tay`}
            paper={ink.paper}
            strokes={p.strokes}
            tool={tool}
            finger={finger}
            onStroke={(stroke) => setPage(i, [...current.current.pages[i].strokes, stroke])}
            onErase={(x, y) => {
              const strokes = current.current.pages[i].strokes
              const next = eraseStrokes(strokes, x, y, ERASER_R)
              if (next === strokes) return
              // One undo step per eraser drag, recorded once something is erased.
              setPage(i, next, !erasing.current.recorded)
              erasing.current.recorded = true
            }}
            onEraseEnd={() => {
              erasing.current.recorded = false
            }}
          />
        </div>
      ))}
      {n < MAX_PAGES && (
        <button
          type="button"
          onClick={addPage}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-lg font-bold text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus className="size-5" />
          Thêm trang
        </button>
      )}
      <p className="text-base text-slate-500">
        {finger ? "Viết bằng ngón tay hoặc bút. Kéo ở ngoài trang giấy để cuộn." : "Dùng Apple Pencil để viết, dùng ngón tay để cuộn trang."}
      </p>
    </div>
  )
}

/* ---------- One page ---------- */

/** Path2D per committed stroke; strokes are never mutated, so the array is the key. */
const pathCache = new WeakMap<number[], Path2D>()
function pathOf(stroke: number[]): Path2D {
  let p = pathCache.get(stroke)
  if (!p) {
    p = new Path2D(strokePath(stroke))
    pathCache.set(stroke, p)
  }
  return p
}

interface PageProps {
  label: string
  /** Page height in ink units (pageHeight() of the ink). */
  height?: number
  paper: Ink["paper"]
  strokes: number[][]
  tool: Tool
  finger: boolean
  onStroke: (stroke: number[]) => void
  onErase: (x: number, y: number) => void
  onEraseEnd: () => void
}

export function InkCanvasPage({ label, height = PAGE_H, paper, strokes, tool, finger, onStroke, onErase, onEraseEnd }: PageProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLCanvasElement>(null)
  const live = useRef<HTMLCanvasElement>(null)
  /** The pointer drawing now; points in page units, pressure 0–10 like stored strokes. */
  const active = useRef<{ id: number; tool: Tool; points: number[] } | null>(null)
  const frame = useRef(0)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    // iPadOS scrolls on Pencil drags despite the pointer handlers; stop that for the stylus only.
    const stopStylus = (e: TouchEvent) => {
      if (Array.from(e.touches).some((t) => (t as Touch & { touchType?: string }).touchType === "stylus")) e.preventDefault()
    }
    el.addEventListener("touchstart", stopStylus, { passive: false })
    el.addEventListener("touchmove", stopStylus, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener("touchstart", stopStylus)
      el.removeEventListener("touchmove", stopStylus)
      cancelAnimationFrame(frame.current)
    }
  }, [])

  // Committed strokes, redrawn at the current size (rotation, split view) whenever they change.
  useEffect(() => {
    if (!width) return
    const ratio = window.devicePixelRatio || 1
    const w = Math.round(width * ratio)
    const h = Math.round(((width * height) / PAGE_W) * ratio)
    for (const c of [base.current!, live.current!]) {
      if (c.width !== w) c.width = w
      if (c.height !== h) c.height = h
    }
    const g = base.current!.getContext("2d")!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, w, h)
    g.setTransform(w / PAGE_W, 0, 0, w / PAGE_W, 0, 0)
    g.fillStyle = INK_COLOR
    for (const s of strokes) g.fill(pathOf(s))
  }, [strokes, width, height])

  const drawLive = () => {
    frame.current = 0
    const c = live.current
    if (!c) return
    const g = c.getContext("2d")!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, c.width, c.height)
    const a = active.current
    if (!a) return
    g.setTransform(c.width / PAGE_W, 0, 0, c.width / PAGE_W, 0, 0)
    if (a.tool === "pen") {
      g.fillStyle = INK_COLOR
      g.fill(new Path2D(strokePath(a.points, false)))
    } else {
      const [x, y] = a.points.slice(-3)
      g.strokeStyle = "#94a3b8"
      g.lineWidth = 2
      g.beginPath()
      g.arc(x, y, ERASER_R, 0, Math.PI * 2)
      g.stroke()
    }
  }
  const schedule = () => {
    if (!frame.current) frame.current = requestAnimationFrame(drawLive)
  }

  const toPage = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * PAGE_W, ((e.clientY - r.top) / r.height) * height] as const
  }
  const pressureOf = (e: PointerEvent) => (e.pointerType === "pen" ? e.pressure || 0.5 : 0.5) * 10

  const finish = (e: React.PointerEvent) => {
    const a = active.current
    if (!a || a.id !== e.pointerId) return
    active.current = null
    if (a.tool === "pen") {
      const stroke: number[] = []
      for (let i = 0; i < a.points.length; i += 3) {
        const [x, y, p] = quantizePoint(a.points[i], Math.min(a.points[i + 1], height), a.points[i + 2] / 10)
        // Skip repeats of the same quantized point.
        if (stroke.length && stroke[stroke.length - 3] === x && stroke[stroke.length - 2] === y) continue
        stroke.push(x, y, p)
      }
      if (stroke.length) onStroke(stroke)
    } else {
      onEraseEnd()
    }
    schedule()
  }

  return (
    <div
      ref={wrap}
      role="img"
      aria-label={label}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border-2 border-slate-200 select-none [-webkit-touch-callout:none]",
        tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
      )}
      style={{ touchAction: finger ? "none" : "pan-y", aspectRatio: `${PAGE_W} / ${height}` }}
      onPointerDown={(e) => {
        const ok = e.pointerType === "pen" || (e.pointerType === "mouse" && e.button === 0) || (e.pointerType === "touch" && finger)
        if (active.current || !ok) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const [x, y] = toPage(e)
        active.current = { id: e.pointerId, tool, points: [x, y, pressureOf(e.nativeEvent)] }
        if (tool === "eraser") onErase(x, y)
        schedule()
      }}
      onPointerMove={(e) => {
        const a = active.current
        if (!a || a.id !== e.pointerId) return
        const events = e.nativeEvent.getCoalescedEvents?.() ?? []
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const [x, y] = toPage(ev)
          a.points.push(x, y, pressureOf(ev))
          if (a.tool === "eraser") onErase(x, y)
        }
        schedule()
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <svg viewBox={`0 0 ${PAGE_W} ${height}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        <InkPaper paper={paper} height={height} />
      </svg>
      <canvas ref={base} className="pointer-events-none absolute inset-0 size-full" />
      <canvas ref={live} className="pointer-events-none absolute inset-0 size-full" />
    </div>
  )
}

export function ToolBtn({
  on,
  onClick,
  disabled,
  icon: Icon,
  label,
  className,
}: {
  on?: boolean
  onClick: () => void
  disabled?: boolean
  icon: typeof PenLine
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 text-base font-semibold disabled:opacity-40",
        on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600",
        className,
      )}
    >
      <Icon className="size-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
