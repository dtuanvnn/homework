import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Eraser, PenLine, RotateCcw, Send, Snail, Turtle, Volume2, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { play } from "@/hooks/useSound"
import { celebrate } from "@/lib/animations"
import { speakEnglishWord } from "@/lib/flashcards"
import { cn } from "@/lib/utils"
import type { FlashcardItem } from "@/lib/types"

const SPEEDS = [
  { id: "fast", label: "Bình thường", rate: 1, icon: Zap },
  { id: "slow", label: "Chậm", rate: 0.7, icon: Turtle },
  { id: "very-slow", label: "Rất chậm", rate: 0.45, icon: Snail },
] as const

type Phase = "learn" | "write"

export default function TakeFlashcardAssignment({
  title,
  cards,
  onExit,
  onSubmit,
}: {
  title: string
  cards: FlashcardItem[]
  onExit: (progress: number) => void
  onSubmit: () => void
}) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>("learn")
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [learned, setLearned] = useState<Set<string>>(() => new Set())
  const [written, setWritten] = useState<Set<string>>(() => new Set())
  const [dir, setDir] = useState(1)
  const card = cards[index]
  const total = cards.length

  const doneCount = phase === "learn" ? learned.size : written.size
  const progress = Math.round(((learned.size + written.size) / Math.max(1, total * 2)) * 100)

  const speak = (rate: number, id: string) =>
    speakEnglishWord(card.word, { rate, onStart: () => setSpeaking(id), onEnd: () => setSpeaking(null) })

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    },
    [],
  )

  const go = (delta: number) => {
    const next = index + delta
    if (next < 0 || next >= total) return
    play("next")
    setDir(delta)
    setFlipped(false)
    setIndex(next)
  }

  const markLearned = () => {
    play("correct")
    setLearned((s) => new Set(s).add(card.id))
    if (index < total - 1) go(1)
  }

  const startWriting = () => {
    play("star")
    setPhase("write")
    setIndex(0)
    setFlipped(false)
  }

  const submit = () => {
    play("submit")
    if (!reduced) celebrate("big")
    window.setTimeout(onSubmit, reduced ? 600 : 1400)
  }

  const allLearned = learned.size === total
  const allWritten = written.size === total

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-indigo-50 to-white">
      <header className="sticky top-0 z-20 border-b border-indigo-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button aria-label="Thoát và lưu" onClick={() => onExit(progress)} className="grid size-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
            <X className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-900">{title}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-indigo-100">
              <motion.div className="h-full rounded-full bg-indigo-500" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
            </div>
          </div>
        </div>
        <div className="mx-auto mt-3 grid max-w-3xl grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          {(["learn", "write"] as const).map((p) => {
            const locked = p === "write" && !allLearned
            return (
              <button
                key={p}
                disabled={locked}
                onClick={() => {
                  if (p === phase) return
                  if (p === "write") startWriting()
                  else {
                    setPhase("learn")
                    setIndex(0)
                  }
                }}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
                  phase === p ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500",
                  locked && "opacity-50",
                )}
              >
                {p === "learn" ? <BookOpen className="size-4" /> : <PenLine className="size-4" />}
                {p === "learn" ? "1. Học từ" : "2. Viết từ"}
              </button>
            )
          })}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5">
        <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-500">
          <span>
            Thẻ {index + 1}/{total}
          </span>
          <span className="text-indigo-600">
            {phase === "learn" ? "Đã thuộc" : "Đã viết"} {doneCount}/{total}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase + card.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40 * dir }}
            transition={{ duration: 0.22 }}
          >
            {phase === "learn" ? (
              <FlipCard
                card={card}
                flipped={flipped}
                reduced={!!reduced}
                learned={learned.has(card.id)}
                onFlip={() => {
                  play("tap")
                  setFlipped((f) => !f)
                }}
              />
            ) : (
              <WritingPad
                card={card}
                done={written.has(card.id)}
                onDone={() => {
                  play("correct")
                  setWritten((s) => new Set(s).add(card.id))
                  if (index < total - 1) window.setTimeout(() => go(1), 350)
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {SPEEDS.map((s) => {
            const Icon = s.icon
            const active = speaking === s.id
            return (
              <button
                key={s.id}
                onClick={() => speak(s.rate, s.id)}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border-2 bg-white text-sm font-semibold transition",
                  active ? "border-indigo-500 text-indigo-700" : "border-slate-200 text-slate-700 hover:border-indigo-300",
                )}
              >
                {active && !reduced && (
                  <motion.span className="absolute inset-0 bg-indigo-100" animate={{ opacity: [0.8, 0.2, 0.8] }} transition={{ repeat: Infinity, duration: 1 }} />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Volume2 className="size-4" />
                  <Icon className="size-4" />
                </span>
                <span className="relative">{s.label}</span>
              </button>
            )
          })}
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button variant="outline" size="lg" className="size-12 rounded-2xl p-0" aria-label="Thẻ trước" disabled={index === 0} onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          {phase === "learn" ? (
            allLearned ? (
              <Button size="lg" className="h-12 flex-1 rounded-2xl bg-indigo-600 text-base" onClick={startWriting}>
                Sang phần Viết từ <PenLine className="size-5" />
              </Button>
            ) : (
              <Button size="lg" className="h-12 flex-1 rounded-2xl bg-indigo-600 text-base" onClick={markLearned}>
                <Check className="size-5" /> {learned.has(card.id) ? "Đã thuộc" : "Em thuộc rồi"}
              </Button>
            )
          ) : (
            <Button size="lg" className="h-12 flex-1 rounded-2xl bg-emerald-600 text-base hover:bg-emerald-700" disabled={!allWritten} onClick={submit}>
              <Send className="size-5" /> {allWritten ? "Nộp bài" : `Viết thêm ${total - written.size} từ`}
            </Button>
          )}
          <Button variant="outline" size="lg" className="size-12 rounded-2xl p-0" aria-label="Thẻ sau" disabled={index === total - 1} onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </footer>
    </div>
  )
}

function FlipCard({
  card,
  flipped,
  onFlip,
  reduced,
  learned,
}: {
  card: FlashcardItem
  flipped: boolean
  onFlip: () => void
  reduced: boolean
  learned: boolean
}) {
  const face = "absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-6 text-center shadow-lg [backface-visibility:hidden]"
  return (
    <button onClick={onFlip} aria-label={flipped ? "Xem từ" : "Xem giải thích"} className="block w-full [perspective:1200px]">
      <motion.div
        className="relative h-72 w-full [transform-style:preserve-3d] md:h-80"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className={cn(face, "bg-gradient-to-br from-indigo-500 to-violet-600 text-white")}>
          {learned && (
            <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              <Check className="size-3.5" /> Đã thuộc
            </span>
          )}
          <p className="text-4xl font-bold tracking-tight md:text-5xl" lang="en">
            {card.word}
          </p>
          <p className="mt-6 flex items-center gap-1.5 text-sm text-indigo-100">
            <RotateCcw className="size-4" /> Chạm để lật thẻ
          </p>
        </div>
        <div className={cn(face, "border-2 border-indigo-100 bg-white [transform:rotateY(180deg)]")}>
          <p className="text-sm font-semibold tracking-wide text-indigo-500 uppercase" lang="en">
            {card.word}
          </p>
          <p className="mt-3 text-xl leading-relaxed font-medium text-slate-800 md:text-2xl" lang="en">
            {card.definition}
          </p>
        </div>
      </motion.div>
    </button>
  )
}

const LINE_GAP = 56

function WritingPad({ card, done, onDone }: { card: FlashcardItem; done: boolean; onDone: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)
  const [showWord, setShowWord] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const { width, height } = wrap.getBoundingClientRect()
      const w = Math.round(width * dpr)
      const h = Math.round(height * dpr)
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineWidth = 4
      ctx.strokeStyle = "#1e1b4b"
      setHasInk(false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasInk) setHasInk(true)
  }
  const up = () => {
    drawing.current = false
    last.current = null
  }
  const clear = () => {
    const c = canvasRef.current
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
    play("tap")
  }

  return (
    <div className="rounded-3xl border-2 border-indigo-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">Nghe, nhìn và viết lại từ:</p>
          <p className={cn("mt-1 text-3xl font-bold text-indigo-700 transition", !showWord && "blur-md select-none")} lang="en">
            {card.word}
          </p>
        </div>
        <button onClick={() => setShowWord((v) => !v)} className="min-h-11 shrink-0 rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-indigo-700">
          {showWord ? "Che từ" : "Hiện từ"}
        </button>
      </div>
      <div
        ref={wrapRef}
        className="relative mt-3 h-56 overflow-hidden rounded-2xl border border-slate-200 bg-[#fffdf5] md:h-64"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE_GAP - 2}px, #c7d2fe ${LINE_GAP - 2}px, #c7d2fe ${LINE_GAP}px)`,
          backgroundPosition: "0 12px",
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-10 w-px bg-rose-300" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Bảng viết tay"
        />
        {!hasInk && <p className="pointer-events-none absolute inset-0 grid place-items-center text-base text-slate-400">Dùng ngón tay hoặc bút để viết</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="h-11 rounded-xl" onClick={clear} disabled={!hasInk}>
          <Eraser className="size-4" /> Xoá
        </Button>
        <Button
          className={cn("h-11 flex-1 rounded-xl", done ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600")}
          disabled={!hasInk && !done}
          onClick={onDone}
        >
          <Check className="size-4" /> {done ? "Đã viết xong" : "Em viết xong rồi"}
        </Button>
      </div>
    </div>
  )
}
