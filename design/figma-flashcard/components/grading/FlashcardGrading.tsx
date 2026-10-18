import { useMemo, useState } from "react"
import { ArrowLeft, Check, CheckCheck, CheckCircle2, RotateCcw, X, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { FlashcardItem } from "@/lib/types"

export const QUICK_COMMENTS = ["Sai chính tả", "Thiếu chữ", "Viết chưa rõ"] as const

export interface FlashcardGradeRow {
  card: FlashcardItem
  written: string | null
  correct: boolean
  comment?: string
}

type Filter = "all" | "pending" | "wrong"

const fmt1 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })

/** Lined-paper snippet rendering the child's handwriting. */
function Handwriting({ text, large }: { text: string; large?: boolean }) {
  const h = large ? 180 : 76
  const gap = large ? 44 : 24
  return (
    <svg viewBox={`0 0 240 ${h}`} className="block h-full w-full" role="img" aria-label={`Chữ viết tay: ${text}`}>
      <rect width="240" height={h} fill="#fffdf5" />
      {Array.from({ length: Math.floor(h / gap) }, (_, i) => (
        <line key={i} x1="0" x2="240" y1={(i + 1) * gap - 4} y2={(i + 1) * gap - 4} stroke="#c7d2fe" strokeWidth="1.2" />
      ))}
      <line x1="22" x2="22" y1="0" y2={h} stroke="#fda4af" strokeWidth="1" />
      <text
        x="32"
        y={large ? h / 2 + 18 : h / 2 + 10}
        fill="#1e1b4b"
        fontFamily='"Patrick Hand", "Comic Sans MS", cursive'
        fontSize={large ? 52 : 30}
        transform={`rotate(-2 120 ${h / 2})`}
      >
        {text}
      </text>
    </svg>
  )
}

export default function FlashcardGrading({
  title,
  subtitle,
  cards,
  handwriting,
  canRetry,
  onBack,
  onFinish,
}: {
  title: string
  subtitle: string
  cards: FlashcardItem[]
  handwriting: Record<string, string | null>
  canRetry: boolean
  onBack: () => void
  onFinish: (result: { score: number; correct: number; total: number; feedback: string; retry: boolean; rows: FlashcardGradeRow[] }) => void
}) {
  // undefined = not graded yet; blank rows default to wrong.
  const [marks, setMarks] = useState<Record<string, boolean | undefined>>(() =>
    Object.fromEntries(cards.map((c) => [c.id, handwriting[c.id] ? undefined : false])),
  )
  const [comments, setComments] = useState<Record<string, string | undefined>>({})
  const [filter, setFilter] = useState<Filter>("all")
  const [feedback, setFeedback] = useState("")
  const [retry, setRetry] = useState(false)
  const [zoom, setZoom] = useState<FlashcardItem | null>(null)

  const total = cards.length
  const correct = cards.filter((c) => marks[c.id] === true).length
  const pendingCount = cards.filter((c) => marks[c.id] === undefined).length
  const wrongCount = cards.filter((c) => marks[c.id] === false).length
  const score = Math.round((correct / Math.max(1, total)) * 100) / 10
  const ready = pendingCount === 0

  const visible = useMemo(
    () =>
      cards.filter((c) => (filter === "pending" ? marks[c.id] === undefined : filter === "wrong" ? marks[c.id] === false : true)),
    [cards, marks, filter],
  )

  const markAllCorrect = () =>
    setMarks((m) => Object.fromEntries(cards.map((c) => [c.id, handwriting[c.id] ? true : m[c.id] ?? false])))

  const finish = () =>
    onFinish({
      score,
      correct,
      total,
      feedback,
      retry: canRetry && retry,
      rows: cards.map((c) => ({ card: c, written: handwriting[c.id] ?? null, correct: marks[c.id] === true, comment: comments[c.id] })),
    })

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: `Tất cả (${total})` },
    { id: "pending", label: `Chưa chấm (${pendingCount})` },
    { id: "wrong", label: `Sai (${wrongCount})` },
  ]

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Quay lại" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-600">Chấm từ vựng · Flashcard</p>
          <h1 className="text-xl leading-snug font-bold text-slate-900 md:text-2xl">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Lọc">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition sm:flex-none",
                filter === f.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="outline" className="h-11 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={markAllCorrect}>
          <CheckCheck />
          Đánh dấu tất cả đúng
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white py-10 text-center text-slate-500">
          {filter === "pending" ? "Đã chấm hết các từ." : "Không có từ nào sai."}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((c) => {
            const written = handwriting[c.id]
            const mark = marks[c.id]
            const n = cards.indexOf(c) + 1
            return (
              <li
                key={c.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 transition-colors",
                  mark === true ? "border-emerald-200" : mark === false ? "border-red-200" : "border-slate-200",
                )}
              >
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-400">Từ {n}</p>
                    <p className="text-xl font-bold text-emerald-600" lang="en">{c.word}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500" lang="en">{c.definition}</p>
                  </div>
                  {written ? (
                    <button
                      onClick={() => setZoom(c)}
                      aria-label={`Phóng to chữ viết của từ ${c.word}`}
                      className="group relative h-[76px] w-36 shrink-0 overflow-hidden rounded-lg border border-slate-200 shadow-sm sm:w-40"
                    >
                      <Handwriting text={written} />
                      <span className="absolute right-1 bottom-1 rounded-md bg-white/90 p-1 text-slate-500 shadow-sm group-hover:text-indigo-600">
                        <ZoomIn className="size-3.5" />
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-[76px] w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 sm:w-40">
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Chưa viết</Badge>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Chấm từ ${c.word}`}>
                  <button
                    role="radio"
                    aria-checked={mark === true}
                    disabled={!written}
                    onClick={() => setMarks((m) => ({ ...m, [c.id]: true }))}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition disabled:opacity-40",
                      mark === true ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-600 hover:border-emerald-300",
                    )}
                  >
                    <Check className="size-5" strokeWidth={3} /> Đúng
                  </button>
                  <button
                    role="radio"
                    aria-checked={mark === false}
                    onClick={() => setMarks((m) => ({ ...m, [c.id]: false }))}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition",
                      mark === false ? "border-red-500 bg-red-500 text-white" : "border-slate-200 text-slate-600 hover:border-red-300",
                    )}
                  >
                    <X className="size-5" strokeWidth={3} /> Sai
                  </button>
                </div>

                {written && (
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_COMMENTS.map((q) => {
                      const on = comments[c.id] === q
                      return (
                        <button
                          key={q}
                          aria-pressed={on}
                          onClick={() => {
                            setComments((m) => ({ ...m, [c.id]: on ? undefined : q }))
                            if (!on && q !== "Viết chưa rõ") setMarks((m) => ({ ...m, [c.id]: false }))
                          }}
                          className={cn(
                            "min-h-8 rounded-full border px-3 text-xs font-medium transition",
                            on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300",
                          )}
                        >
                          {q}
                        </button>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 space-y-3 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur md:bottom-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-slate-800">
            Đúng <span className="text-emerald-600 tabular-nums">{correct}/{total}</span> từ ·{" "}
            <span className="text-2xl font-bold text-indigo-600 tabular-nums">{fmt1(score)}</span>
            <span className="text-slate-400">/10</span>
          </p>
          {!ready && <p className="text-sm text-amber-700">Còn {pendingCount} từ chưa chấm</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fc-feedback">Nhận xét chung</Label>
          <Textarea id="fc-feedback" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Con viết đẹp lắm! Nhớ luyện lại các từ sai nhé." />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className={cn("flex min-h-11 flex-1 cursor-pointer items-center gap-3", !canRetry && "cursor-not-allowed opacity-50")}>
            <button
              type="button"
              role="switch"
              aria-checked={retry}
              disabled={!canRetry}
              onClick={() => setRetry((v) => !v)}
              className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", retry ? "bg-indigo-600" : "bg-slate-300")}
            >
              <span className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform", retry && "translate-x-5")} />
            </button>
            <span className="text-sm font-medium text-slate-700">
              <RotateCcw className="mr-1 inline size-4 text-violet-600" />
              Cho phép làm lại lần 2
            </span>
          </label>
          <Button size="lg" className="h-12 rounded-xl text-base" disabled={!ready} onClick={finish}>
            <CheckCircle2 />
            Hoàn tất chấm bài
          </Button>
        </div>
      </div>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Từ đúng: <span className="text-emerald-600" lang="en">{zoom?.word}</span>
            </DialogTitle>
            <DialogDescription>Chữ viết tay của Minh An</DialogDescription>
          </DialogHeader>
          {zoom && handwriting[zoom.id] && (
            <div className="overflow-hidden rounded-xl border">
              <Handwriting text={handwriting[zoom.id]!} large />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
