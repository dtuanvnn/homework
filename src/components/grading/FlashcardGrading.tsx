"use client"

import { useState } from "react"
import { Check, CheckCheck, CheckCircle2, Clock3, Loader2, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import HandwritingView from "@/components/ink/HandwritingView"
import { useAppNavigation, useRequiredStudent } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import { unwrap } from "@/lib/action-result"
import { scoreOutOf10 } from "@/lib/grading"
import { cn } from "@/lib/utils"
import { essayInk, type GradingDetail } from "@/lib/views/grading"
import { gradeAttempt } from "@/server/actions/grading"
import { fmt, scoreTone, submittedLabel } from "./format"

/*
 * Grading a handwritten word list: one row per word with the correct
 * spelling next to the child's handwriting and one tap for ✓ or ✗. Saved
 * with the usual gradeAttempt action (1 point or 0 per word).
 */

export const QUICK_COMMENTS = ["Sai chính tả", "Thiếu chữ", "Viết chưa rõ"] as const
/** Quick comments that also mark the word wrong. */
const MARKS_WRONG = new Set<string>(["Sai chính tả", "Thiếu chữ"])

type Filter = "all" | "pending" | "wrong"

export default function FlashcardGrading({ detail: d, now }: { detail: GradingDetail; now: string }) {
  const { navigate } = useAppNavigation()
  const student = useRequiredStudent()
  const rows = d.answers.flatMap((a) => (a.question.type === "tu-vung" ? [{ answer: a, word: a.question.word, ink: essayInk(a.response) }] : []))
  // Saved marks when re-grading; otherwise blank words start as wrong and written ones unmarked.
  const [marks, setMarks] = useState<Record<string, boolean | undefined>>(() =>
    Object.fromEntries(rows.map((r) => [r.answer.id, r.answer.isCorrect ?? (r.ink ? undefined : false)])),
  )
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.answer.id, r.answer.comment ?? ""])))
  const [filter, setFilter] = useState<Filter>("all")
  const [feedback, setFeedback] = useState(d.feedback)
  const canRetry = d.attemptNo < d.maxAttempts && !d.retryUsed
  const [retry, setRetry] = useState(canRetry && d.retryAllowed)
  const [saving, setSaving] = useState(false)

  const total = rows.length
  const correct = rows.filter((r) => marks[r.answer.id] === true).length
  const pending = rows.filter((r) => marks[r.answer.id] === undefined).length
  const wrong = rows.filter((r) => marks[r.answer.id] === false).length
  const written = rows.filter((r) => r.ink).length
  const points = rows.reduce((sum, r) => sum + r.answer.question.points, 0)
  const awarded = rows.reduce((sum, r) => sum + (marks[r.answer.id] ? r.answer.question.points : 0), 0)
  const score = scoreOutOf10(awarded, points)
  const st = scoreTone(score)
  const visible = rows.filter((r) => (filter === "pending" ? marks[r.answer.id] === undefined : filter === "wrong" ? marks[r.answer.id] === false : true))

  const mark = (id: string, value: boolean) => setMarks((m) => ({ ...m, [id]: value }))

  const finish = async () => {
    if (pending) {
      toast.error(`Còn ${pending} từ chưa chấm`)
      return
    }
    setSaving(true)
    try {
      const result = unwrap(
        await gradeAttempt(d.attemptId, {
          answers: rows.map((r) => ({
            answerId: r.answer.id,
            isCorrect: marks[r.answer.id] === true,
            pointsAwarded: marks[r.answer.id] ? r.answer.question.points : 0,
            comment: comments[r.answer.id]?.trim() || null,
          })),
          feedback: feedback.trim() || undefined,
          retryAllowed: canRetry && retry,
        }),
      )
      toast.success(`Đã chấm: ${fmt(result.score)}/10`, { description: canRetry && retry ? "Con sẽ được làm lại lần 2." : `Kết quả đã gửi tới ${student.name}.` })
      navigate(TAB_PATHS.grading)
    } catch (e) {
      toast.error("Không lưu được kết quả chấm", { description: e instanceof Error ? e.message : "Vui lòng thử lại." })
      setSaving(false)
    }
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: `Tất cả (${total})` },
    { id: "pending", label: `Chưa chấm (${pending})` },
    { id: "wrong", label: `Sai (${wrong})` },
  ]

  return (
    <div className="flex flex-col gap-5 pb-8">
      <Card className="gap-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-green-700">Chấm từ vựng · Flashcard</span>
          <Badge variant="outline" className={cn("text-xs", d.attemptNo === 2 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
            Lần {d.attemptNo}
          </Badge>
          {d.gradedAt && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
              Đã chấm · đang sửa
            </Badge>
          )}
          {d.submittedOffline && (
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-xs text-sky-700">
              Nộp offline
            </Badge>
          )}
        </div>
        <h1 className="text-xl leading-snug font-bold text-slate-900 md:text-2xl">{d.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" />
            {submittedLabel(d.submittedAt, now)}
          </span>
          {d.durationSeconds !== null && <span>Làm trong {Math.max(1, Math.round(d.durationSeconds / 60))} phút</span>}
          <span>
            {written}/{total} từ đã viết
          </span>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Lọc từ">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
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
        <Button
          variant="outline"
          className="h-11 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => setMarks((m) => Object.fromEntries(rows.map((r) => [r.answer.id, r.ink ? true : (m[r.answer.id] ?? false)])))}
        >
          <CheckCheck />
          Đánh dấu tất cả đúng
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white py-10 text-center text-slate-500">{filter === "pending" ? "Đã chấm hết các từ." : "Không có từ nào sai."}</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((r) => {
            const id = r.answer.id
            const m = marks[id]
            const n = rows.indexOf(r) + 1
            return (
              <li
                key={id}
                className={cn("flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 transition-colors", m === true ? "border-emerald-200" : m === false ? "border-red-200" : "border-slate-200")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-400">Từ {n}</p>
                    <p className="text-2xl font-bold break-words text-emerald-600" lang="en">
                      {r.word}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500" lang="en">
                      {r.answer.question.prompt}
                    </p>
                  </div>
                  {!r.ink && (
                    <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">
                      Chưa viết
                    </Badge>
                  )}
                </div>
                {r.ink && <HandwritingView handwriting={{ ink: r.ink }} label={`Chữ viết từ ${n}`} />}

                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Chấm từ ${n}`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={m === true}
                    disabled={!r.ink}
                    onClick={() => mark(id, true)}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition disabled:opacity-40",
                      m === true ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-600 hover:border-emerald-300",
                    )}
                  >
                    <Check className="size-5" strokeWidth={3} /> Đúng
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={m === false}
                    onClick={() => mark(id, false)}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition",
                      m === false ? "border-red-500 bg-red-500 text-white" : "border-slate-200 text-slate-600 hover:border-red-300",
                    )}
                  >
                    <X className="size-5" strokeWidth={3} /> Sai
                  </button>
                </div>

                {r.ink && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Nhận xét nhanh từ ${n}`}>
                    {QUICK_COMMENTS.map((q) => {
                      const on = comments[id] === q
                      return (
                        <button
                          key={q}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setComments((c) => ({ ...c, [id]: on ? "" : q }))
                            if (!on && MARKS_WRONG.has(q)) mark(id, false)
                          }}
                          className={cn(
                            "min-h-9 rounded-full border px-3 text-xs font-medium transition",
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

      <Card className="gap-4 p-4 md:p-5">
        <div className="space-y-2">
          <Label htmlFor="fc-feedback">Nhận xét chung</Label>
          <Textarea id="fc-feedback" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Con viết đẹp lắm! Nhớ luyện lại các từ sai nhé." />
        </div>
        {canRetry && (
          <button
            type="button"
            role="switch"
            aria-checked={retry}
            onClick={() => setRetry((v) => !v)}
            className="flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <RotateCcw className="size-5 shrink-0 text-violet-600" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-800">Cho phép làm lại lần 2</span>
              <span className="block text-xs text-slate-500">Con học lại thẻ từ rồi viết lại cả bộ.</span>
            </span>
            <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", retry ? "bg-indigo-600" : "bg-slate-300")}>
              <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-[left]", retry ? "left-6" : "left-1")} />
            </span>
          </button>
        )}
      </Card>

      <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700">
            Đúng <span className="text-emerald-600 tabular-nums">{correct}/{total}</span> từ
            {pending > 0 && <span className="font-normal text-amber-700"> · còn {pending} từ chưa chấm</span>}
          </p>
          <p className={cn("text-2xl font-bold tabular-nums", pending ? "text-slate-400" : st.text)}>
            {fmt(score)}
            <span className="text-sm font-medium text-slate-400">/10</span>
          </p>
        </div>
        <Button size="lg" className="h-12 rounded-xl" disabled={saving || pending > 0} onClick={finish}>
          {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Hoàn tất chấm bài
        </Button>
      </div>
    </div>
  )
}
