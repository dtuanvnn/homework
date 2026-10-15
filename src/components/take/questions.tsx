import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Keyboard, PenLine } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { InkEditor } from "@/components/ink/InkEditor"
import { useStudent } from "@/components/layout/AppFrame"
import { Textarea } from "@/components/ui/textarea"
import type { EssayValue } from "@/lib/grading"
import { isInkEmpty, newInk, paperFor } from "@/lib/ink"
import { isLongPrompt } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { SubjectStyle } from "@/lib/subjects"
import type { TakeQuestion } from "@/lib/views/student"
import RichText from "@/components/question/RichText"
import MathAnswerInput from "./MathAnswerInput"

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
            <RichText text={o} />
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
    <p
      className={cn(
        "rounded-3xl bg-white p-6 font-semibold break-words whitespace-pre-line text-slate-800",
        isLongPrompt(q.prompt) ? "text-xl leading-[2.4] md:text-2xl md:leading-[2.4]" : "text-2xl leading-[2.4] md:text-3xl md:leading-[2.4]",
      )}
    >
      {parts.map((p, i) => (
        <span key={i}>
          <RichText text={p} />
          {i < parts.length - 1 &&
            (q.math ? (
              <MathAnswerInput
                size="inline"
                ariaLabel={`Chỗ trống ${i + 1}`}
                value={value[i] ?? ""}
                onChange={(latex) => {
                  const next = [...value]
                  next[i] = latex
                  onChange(next)
                }}
                tone={tone}
              />
            ) : (
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
            ))}
        </span>
      ))}
    </p>
  )
}

export function ShortAnswer({ q, value = "", onChange, tone, math }: Props<Q<"tra-loi-ngan">, string> & { math: boolean }) {
  return (
    <div className="space-y-3">
      {q.math ? (
        <MathAnswerInput value={value} onChange={onChange} ariaLabel="Câu trả lời" tone={tone} />
      ) : math ? (
        <input
          aria-label="Câu trả lời"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="Nhập câu trả lời…"
          className={cn("h-20 w-full rounded-3xl border-2 bg-white px-6 text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:ring-4", tone.border, tone.ring)}
        />
      ) : (
        // Answers in words are often a whole sentence: let them wrap.
        <Textarea
          aria-label="Câu trả lời"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập câu trả lời…"
          className={cn("min-h-28 rounded-3xl border-2 bg-white px-6 py-4 text-2xl leading-relaxed font-bold text-slate-900 placeholder:text-slate-300 focus-visible:ring-4 md:text-2xl", tone.border, tone.ring)}
        />
      )}
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
            <RichText text={p.left} />
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
            <RichText text={q.pairs[r].right} />
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
            <RichText text={q.tokens[t]} />
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
            <RichText text={q.tokens[t]} />
          </motion.button>
        ))}
      </div>
      <p className="text-base text-slate-500">Kéo các từ đã chọn để đổi chỗ. Chạm vào từ để bỏ ra.</p>
    </div>
  )
}

/* ---------- Essay ---------- */

export type { EssayValue }

export function Essay({ value = { text: "" }, onChange, tone }: Props<Q<"tu-luan">, EssayValue>) {
  const student = useStudent()
  const [hand, setHand] = useState(Boolean(value.drawing || !isInkEmpty(value.ink)) && !value.text)
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
        value.drawing && !value.ink ? (
          // A draft from the old single canvas: show it until the child starts over on pages.
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
            <img src={value.drawing} alt="Bài viết tay cũ" className="w-full rounded-3xl border-2 border-slate-200 bg-white" />
            <button
              type="button"
              onClick={() => onChange({ text: value.text, ink: newInk(paperFor(student.grade)) })}
              className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-5 text-lg font-bold text-indigo-700"
            >
              <PenLine className="size-5" />
              Viết lại trên giấy mới
            </button>
          </div>
        ) : (
          <InkEditor ink={value.ink ?? newInk(paperFor(student.grade))} onChange={(ink) => onChange({ text: value.text, ink })} />
        )
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
