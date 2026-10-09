import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Eraser, Keyboard, PenLine, Trash2, Undo2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { SubjectStyle } from "@/lib/subjects"
import type { TakeQuestion } from "@/lib/views/student"

type Q<T extends TakeQuestion["type"]> = Extract<TakeQuestion, { type: T }>

interface Props<Q, A> {
  q: Q
  value: A | undefined
  onChange: (v: A) => void
  tone: SubjectStyle
}

const LETTERS = ["A", "B", "C", "D", "E", "F"]

/** Press + bounce-when-selected for answer buttons. */
function useChoiceMotion() {
  const reduced = useReducedMotion()
  return (on: boolean) =>
    reduced
      ? {}
      : {
          whileTap: { scale: 0.95 },
          animate: on ? { scale: [1, 1.07, 0.98, 1] } : { scale: 1 },
          transition: { duration: 0.35 },
        }
}

export function MultipleChoice({ q, value, onChange, tone }: Props<Q<"trac-nghiem">, number>) {
  const choice = useChoiceMotion()
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
      {q.options.map((o, i) => {
        const on = value === i
        return (
          <motion.button
            key={i}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(i)}
            {...choice(on)}
            className={cn(
              "flex min-h-20 items-center gap-4 rounded-3xl border-2 p-4 text-left text-2xl font-bold transition-colors duration-200",
              on ? cn(tone.bg, "border-transparent text-white shadow-lg") : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
            )}
          >
            <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold", on ? "bg-white/25" : cn(tone.softBg, tone.text))}>
              {LETTERS[i]}
            </span>
            {o}
          </motion.button>
        )
      })}
    </div>
  )
}

export function TrueFalse({ value, onChange }: Props<Q<"dung-sai">, boolean>) {
  const choice = useChoiceMotion()
  const opts = [
    { v: true, label: "Đúng ✓", on: "bg-emerald-500 text-white border-transparent shadow-lg", off: "text-emerald-700" },
    { v: false, label: "Sai ✗", on: "bg-red-500 text-white border-transparent shadow-lg", off: "text-red-600" },
  ]
  return (
    <div className="grid grid-cols-2 gap-4" role="radiogroup">
      {opts.map((o) => (
        <motion.button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          {...choice(value === o.v)}
          className={cn(
            "min-h-36 rounded-[28px] border-2 text-3xl font-extrabold transition-colors duration-200 md:min-h-44 md:text-4xl",
            value === o.v ? o.on : cn("border-slate-200 bg-white", o.off),
          )}
        >
          {o.label}
        </motion.button>
      ))}
    </div>
  )
}

export function FillBlank({ q, value = [], onChange, tone }: Props<Q<"dien-cho-trong">, string[]>) {
  const parts = q.prompt.split("___")
  return (
    <p className="rounded-3xl bg-white p-6 text-2xl leading-[2.4] font-semibold text-slate-800 md:text-3xl">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <input
              aria-label={`Chỗ trống ${i + 1}`}
              value={value[i] ?? ""}
              onChange={(e) => {
                const next = [...value]
                next[i] = e.target.value
                onChange(next)
              }}
              style={{ width: `${Math.max(6, (value[i]?.length ?? 0) + 2)}ch` }}
              className={cn("mx-1 inline-block h-14 rounded-xl border-2 border-dashed bg-slate-50 px-3 text-center align-middle font-bold outline-none focus:border-solid", tone.border, tone.text, "focus:bg-white")}
            />
          )}
        </span>
      ))}
    </p>
  )
}

export function ShortAnswer({ value = "", onChange, tone, math }: Props<Q<"tra-loi-ngan">, string> & { math: boolean }) {
  return (
    <div className="space-y-3">
      <input
        aria-label="Câu trả lời"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={math ? "decimal" : "text"}
        placeholder="Nhập câu trả lời…"
        className={cn("h-20 w-full rounded-3xl border-2 bg-white px-6 text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:ring-4", tone.border, tone.ring)}
      />
      {math && (
        <p className="flex items-center gap-2 text-base text-slate-500">
          <Keyboard className="size-5" />
          Bàn phím số sẽ hiện ra. Nhớ ghi cả đơn vị nếu có (ví dụ: 24 kg).
        </p>
      )}
    </div>
  )
}

/* ---------- Matching ---------- */

type Pairs = Record<number, number> // left index -> right index
/** Stable default, so `measure` below doesn't change on every render. */
const NO_PAIRS: Pairs = {}

export function Matching({ q, value = NO_PAIRS, onChange, tone }: Props<Q<"noi">, Pairs>) {
  // Shuffle right column deterministically.
  const rightOrder = q.pairs.map((_, i) => i).sort((a, b) => ((a * 7 + 3) % 5) - ((b * 7 + 3) % 5))
  const reduced = useReducedMotion()
  const [picked, setPicked] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; start: { x: number; y: number } } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; l: number }[]>([])
  const anchor = useCallback((side: "l" | "r", i: number) => {
    const root = box.current?.getBoundingClientRect()
    const el = box.current?.querySelector(`[data-${side}="${i}"]`)?.getBoundingClientRect()
    if (!root || !el) return { x: 0, y: 0 }
    return { x: (side === "l" ? el.right : el.left) - root.left, y: el.top + el.height / 2 - root.top }
  }, [])
  const measure = useCallback(() => {
    setLines(
      Object.entries(value).map(([l, r]) => {
        const a = anchor("l", Number(l))
        const b = anchor("r", r)
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, l: Number(l) }
      }),
    )
  }, [value, anchor])
  // Lines follow the rendered layout, so they can only be measured after render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(measure, [measure])
  useEffect(() => {
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  const connect = (l: number, r: number) => {
    const next: Pairs = {}
    for (const [k, v] of Object.entries(value)) if (Number(k) !== l && v !== r) next[Number(k)] = v
    next[l] = r
    onChange(next)
    setPicked(null)
  }
  const unlink = (l: number) => {
    const next = { ...value }
    delete next[l]
    onChange(next)
  }
  const local = (e: React.PointerEvent) => {
    const root = box.current!.getBoundingClientRect()
    return { x: e.clientX - root.left, y: e.clientY - root.top }
  }
  const colors = ["#6366f1", "#f97316", "#10b981", "#ec4899", "#0ea5e9", "#eab308"]

  return (
    <div
      ref={box}
      className="relative grid touch-none grid-cols-2 gap-x-14 gap-y-3 select-none md:gap-x-28"
      onPointerMove={(e) => drag && setDrag({ ...drag, ...local(e) })}
      onPointerUp={(e) => {
        if (!drag) return
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-r]")
        if (el) connect(drag.from, Number(el.getAttribute("data-r")))
        setDrag(null)
      }}
    >
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        {lines.map((ln) => (
          <g key={`${ln.l}-${value[ln.l]}`} stroke={colors[ln.l % colors.length]}>
            <motion.path
              d={`M${ln.x1} ${ln.y1} L${ln.x2} ${ln.y2}`}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              initial={reduced ? { opacity: 0 } : { pathLength: 0 }}
              animate={reduced ? { opacity: 1 } : { pathLength: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
            <circle cx={ln.x1} cy={ln.y1} r={6} fill="white" strokeWidth={3} />
            <motion.circle cx={ln.x2} cy={ln.y2} r={6} fill="white" strokeWidth={3} initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 500, damping: 15 }} />
          </g>
        ))}
        {drag && <line x1={drag.start.x} y1={drag.start.y} x2={drag.x} y2={drag.y} stroke="#a5b4fc" strokeWidth={4} strokeDasharray="8 6" strokeLinecap="round" />}
      </svg>
      {q.pairs.map((p, i) => {
        const r = rightOrder[i]
        const leftLinked = value[i] !== undefined
        const rightLinked = Object.values(value).includes(r)
        return [
          <button
            key={`l${i}`}
            data-l={i}
            type="button"
            onClick={() => (leftLinked ? unlink(i) : setPicked(picked === i ? null : i))}
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return
              setDrag({ from: i, ...local(e), start: anchor("l", i) })
            }}
            className={cn(
              "min-h-18 rounded-2xl border-2 px-4 py-3 text-xl font-bold transition-all",
              picked === i ? cn(tone.bg, "border-transparent text-white shadow-lg") : leftLinked ? "border-slate-300 bg-slate-50 text-slate-700" : "border-slate-200 bg-white text-slate-800",
            )}
            style={leftLinked ? { borderColor: colors[i % colors.length] } : undefined}
          >
            {p.left}
          </button>,
          <button
            key={`r${i}`}
            data-r={r}
            type="button"
            onClick={() => picked !== null && connect(picked, r)}
            className={cn(
              "flex min-h-18 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-xl font-bold transition-all",
              rightLinked ? "border-slate-300 bg-slate-50 text-slate-700" : "border-slate-200 bg-white text-slate-800",
              picked !== null && !rightLinked && "border-dashed border-indigo-300 bg-indigo-50/50",
            )}
          >
            {q.pairs[r].picture && <span className="text-2xl" aria-hidden>{q.pairs[r].picture}</span>}
            {q.pairs[r].right}
          </button>,
        ]
      })}
      <p className="col-span-2 mt-2 text-center text-base text-slate-500">
        Chạm một ô bên trái rồi chạm ô bên phải (hoặc kéo để nối). Chạm lại ô đã nối để xóa.
      </p>
    </div>
  )
}

/* ---------- Ordering ---------- */

export function Ordering({ q, value = [], onChange, tone }: Props<Q<"sap-xep">, number[]>) {
  const reduced = useReducedMotion()
  const chipSpring = { type: "spring" as const, stiffness: 500, damping: 30 }
  const pool = q.shuffled.filter((i) => !value.includes(i))
  const [dragging, setDragging] = useState<number | null>(null)
  const move = (from: number, to: number) => {
    const next = [...value]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  return (
    <div className="space-y-5 select-none">
      <div
        className={cn("flex min-h-28 flex-wrap content-start items-center gap-3 rounded-3xl border-2 border-dashed bg-white p-4", value.length ? tone.border : "border-slate-200")}
        aria-label="Câu của em"
      >
        {!value.length && <span className="text-lg text-slate-400">Chạm các từ bên dưới để ghép câu…</span>}
        {value.map((t, pos) => (
          <motion.button
            key={t}
            layoutId={reduced ? undefined : `chip-${q.id}-${t}`}
            layout={!reduced}
            transition={chipSpring}
            data-pos={pos}
            type="button"
            onPointerDown={(e) => {
              ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
              setDragging(pos)
            }}
            onPointerUp={(e) => {
              if (dragging === null) return
              const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pos]")
              const to = el ? Number(el.getAttribute("data-pos")) : dragging
              if (to !== dragging) move(dragging, to)
              else onChange(value.filter((v) => v !== t))
              setDragging(null)
            }}
            onPointerEnter={(e) => {
              if (dragging !== null && e.buttons && dragging !== pos) {
                move(dragging, pos)
                setDragging(pos)
              }
            }}
            animate={{ scale: dragging === pos ? 1.1 : 1 }}
            className={cn("min-h-14 touch-none rounded-2xl px-5 text-2xl font-bold text-white shadow-md", tone.bg, dragging === pos && "ring-4 ring-white")}
          >
            {q.tokens[t]}
          </motion.button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {pool.map((t) => (
          <motion.button
            key={t}
            layoutId={reduced ? undefined : `chip-${q.id}-${t}`}
            layout={!reduced}
            transition={chipSpring}
            whileTap={reduced ? undefined : { scale: 0.92 }}
            type="button"
            onClick={() => onChange([...value, t])}
            className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-5 text-2xl font-bold text-slate-800 shadow-sm"
          >
            {q.tokens[t]}
          </motion.button>
        ))}
      </div>
      <p className="text-base text-slate-500">Kéo các từ đã chọn để đổi chỗ. Chạm vào từ để bỏ ra.</p>
    </div>
  )
}

/* ---------- Essay ---------- */

export interface EssayValue {
  text: string
  drawing?: string
}

export function Essay({ value = { text: "" }, onChange, tone }: Props<Q<"tu-luan">, EssayValue>) {
  const [hand, setHand] = useState(Boolean(value.drawing) && !value.text)
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-2xl bg-slate-100 p-1">
        {[
          { on: false, label: "Gõ chữ", icon: Keyboard },
          { on: true, label: "Viết tay", icon: PenLine },
        ].map((m) => (
          <button
            key={m.label}
            type="button"
            aria-pressed={hand === m.on}
            onClick={() => setHand(m.on)}
            className={cn("inline-flex h-12 items-center gap-2 rounded-xl px-5 text-lg font-bold", hand === m.on ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")}
          >
            <m.icon className="size-5" />
            {m.label}
          </button>
        ))}
      </div>
      {hand ? (
        <DrawingCanvas value={value.drawing} onChange={(drawing) => onChange({ ...value, drawing })} />
      ) : (
        <div className="relative">
          <Textarea
            aria-label="Bài viết của em"
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder="Em viết bài ở đây nhé…"
            className={cn("min-h-64 rounded-3xl border-2 bg-white p-5 text-2xl leading-relaxed md:text-2xl", tone.border)}
          />
          <span className="absolute right-4 bottom-3 text-sm font-semibold text-slate-400">{value.text.length} ký tự</span>
        </div>
      )}
    </div>
  )
}

function DrawingCanvas({ value, onChange }: { value?: string; onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const history = useRef<ImageData[]>([])
  const drawing = useRef(false)
  const [eraser, setEraser] = useState(false)

  useEffect(() => {
    const c = ref.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const ctx = c.getContext("2d")!
    ctx.scale(ratio, ratio)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight)
      img.src = value
    }
    // Only restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ctx = () => ref.current!.getContext("2d")!
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }
  const save = () => onChange(ref.current!.toDataURL("image/png"))

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <ToolBtn on={!eraser} onClick={() => setEraser(false)} icon={PenLine} label="Bút" />
        <ToolBtn on={eraser} onClick={() => setEraser(true)} icon={Eraser} label="Tẩy" />
        <ToolBtn
          onClick={() => {
            const prev = history.current.pop()
            if (prev) { ctx().putImageData(prev, 0, 0); save() }
          }}
          icon={Undo2}
          label="Hoàn tác"
        />
        <ToolBtn
          onClick={() => {
            const c = ref.current!
            history.current.push(ctx().getImageData(0, 0, c.width, c.height))
            ctx().clearRect(0, 0, c.width, c.height)
            save()
          }}
          icon={Trash2}
          label="Xóa hết"
        />
      </div>
      <canvas
        ref={ref}
        aria-label="Khung viết tay"
        className="h-80 w-full touch-none rounded-3xl border-2 border-slate-200 bg-white bg-[linear-gradient(transparent_47px,#e2e8f0_48px)] bg-[length:100%_48px] md:h-[420px]"
        onPointerDown={(e) => {
          const c = ref.current!
          c.setPointerCapture(e.pointerId)
          history.current.push(ctx().getImageData(0, 0, c.width, c.height))
          if (history.current.length > 30) history.current.shift()
          drawing.current = true
          const [x, y] = pos(e)
          ctx().beginPath()
          ctx().moveTo(x, y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const g = ctx()
          const [x, y] = pos(e)
          const pressure = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5
          g.globalCompositeOperation = eraser ? "destination-out" : "source-over"
          g.lineWidth = eraser ? 28 : 1.5 + pressure * 4
          g.lineCap = "round"
          g.lineJoin = "round"
          g.strokeStyle = "#1e293b"
          g.lineTo(x, y)
          g.stroke()
          g.beginPath()
          g.moveTo(x, y)
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          save()
        }}
      />
      <p className="text-base text-slate-500">Dùng Apple Pencil hoặc ngón tay để viết bài.</p>
    </div>
  )
}

function ToolBtn({ on, onClick, icon: Icon, label }: { on?: boolean; onClick: () => void; icon: typeof PenLine; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn("inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 text-base font-semibold", on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600")}
    >
      <Icon className="size-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
