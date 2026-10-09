"use client"

import { useState } from "react"
import {
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquarePlus,
  Minus,
  Monitor,
  Plus,
  RotateCcw,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAppNavigation, useStudent } from "@/components/layout/AppFrame"
import { TAB_PATHS } from "@/components/layout/routes"
import { gradeAttempt } from "@/server/actions/grading"
import { unwrap } from "@/lib/action-result"
import { scoreOutOf10 } from "@/lib/grading"
import { QUESTION_TYPES } from "@/lib/questions"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import {
  correctAnswerText,
  essayDrawing,
  markedTotals,
  responseText,
  stepPoints,
  type GradingAnswer,
  type GradingDetail,
} from "@/lib/views/grading"
import ScanViewer from "./ScanViewer"
import { fmt, scoreTone, submittedLabel } from "./format"

const QUICK_COMMENTS = ["Giỏi lắm!", "Trình bày rõ ràng", "Con đọc kỹ đề nhé", "Kiểm tra lại phép tính", "Viết cẩn thận hơn nhé", "Cần giải thích thêm"]

interface Mark {
  isCorrect: boolean | null
  pointsAwarded: number | null
  comment: string
}

const markOf = (a: GradingAnswer): Mark => ({ isCorrect: a.isCorrect, pointsAwarded: a.pointsAwarded, comment: a.comment ?? "" })

export default function GradeAttempt({ detail: d, now }: { detail: GradingDetail; now: string }) {
  const { navigate } = useAppNavigation()
  const student = useStudent()
  const [marks, setMarks] = useState<Record<string, Mark>>(() => Object.fromEntries(d.answers.map((a) => [a.id, markOf(a)])))
  const [feedback, setFeedback] = useState(d.feedback)
  const canRetry = d.attemptNo < d.maxAttempts && !d.retryUsed
  const [retry, setRetry] = useState(canRetry && d.retryAllowed)
  const [saving, setSaving] = useState(false)
  const tone = SUBJECTS[d.subject]
  const paper = d.mode === "paper"

  const list = d.answers.map((a) => marks[a.id])
  const { total, awarded, remaining } = markedTotals(d.answers, list)
  const score = scoreOutOf10(awarded, total)
  const st = scoreTone(score)

  const patch = (id: string, value: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { ...m[id], ...value } }))

  const finish = async () => {
    if (remaining > 0) {
      const first = d.answers.find((a) => marks[a.id].isCorrect === null || marks[a.id].pointsAwarded === null)
      if (first) document.getElementById(`answer-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error(`Còn ${remaining} câu chưa chấm`)
      return
    }
    setSaving(true)
    try {
      const result = unwrap(await gradeAttempt(d.attemptId, {
        answers: d.answers.map((a) => ({
          answerId: a.id,
          isCorrect: marks[a.id].isCorrect!,
          pointsAwarded: marks[a.id].pointsAwarded!,
          comment: marks[a.id].comment.trim() || null,
        })),
        feedback: feedback.trim() || undefined,
        retryAllowed: canRetry && retry,
      }))
      toast.success(`Đã chấm: ${fmt(result.score)}/10`, {
        description: canRetry && retry ? "Con sẽ được làm lại lần 2." : `Kết quả đã gửi tới ${student.name}.`,
      })
      navigate(TAB_PATHS.grading)
    } catch (e) {
      toast.error("Không lưu được kết quả chấm", { description: e instanceof Error ? e.message : "Vui lòng thử lại." })
      setSaving(false)
    }
  }

  const questionCard = (a: GradingAnswer, n: number) => {
    const q = a.question
    const m = marks[a.id]
    const initial = markOf(a)
    const changed = initial.isCorrect !== null && (m.isCorrect !== initial.isCorrect || m.pointsAwarded !== initial.pointsAwarded)
    const auto = !paper && q.type !== "tu-luan"
    const essay = q.type === "tu-luan"
    const drawing = essay ? essayDrawing(a.response) : undefined
    const answerText = responseText(q, a.response)
    const ungraded = m.isCorrect === null || m.pointsAwarded === null
    const TypeIcon = QUESTION_TYPES[q.type].icon
    return (
      <Card
        key={a.id}
        id={`answer-${a.id}`}
        className={cn("scroll-mt-24 gap-3 p-4 md:p-5", ungraded ? "border-amber-200" : m.isCorrect ? "border-emerald-100" : "border-red-100")}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Câu {n}</span>
          <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-slate-600">
            <TypeIcon className="size-3" />
            {QUESTION_TYPES[q.type].label}
          </Badge>
          <span className="text-slate-400">{fmt(q.points)} điểm</span>
          {auto && initial.isCorrect !== null && (
            <span className={cn("ml-auto inline-flex items-center gap-1 font-medium", initial.isCorrect ? "text-emerald-600" : "text-red-500")}>
              {initial.isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              Tự chấm{changed ? " · đã sửa" : ""}
            </span>
          )}
          {ungraded && <span className="ml-auto font-medium text-amber-700">Cần chấm</span>}
        </div>
        <p className="font-medium leading-relaxed text-slate-900 md:text-lg">{q.prompt}</p>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50/70 p-3">
            <p className="mb-1 text-xs font-semibold text-emerald-700">{essay ? "Gợi ý chấm" : "Đáp án đúng"}</p>
            <p className="break-words text-slate-800">{correctAnswerText(q)}</p>
          </div>
          <div className="rounded-xl bg-indigo-50/60 p-3">
            <p className="mb-1 text-xs font-semibold text-indigo-700">Con trả lời</p>
            {paper ? (
              <p className="text-slate-600">Bài làm trên giấy · xem ảnh scan</p>
            ) : (
              <>
                {answerText && <p className="break-words whitespace-pre-wrap text-slate-800">{answerText}</p>}
                {drawing && <img src={drawing} alt={`Bài viết tay câu ${n}`} className="mt-2 w-full max-w-md rounded-lg border bg-white" />}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2" role="radiogroup" aria-label={`Kết quả câu ${n}`}>
            <Button
              type="button"
              role="radio"
              aria-checked={m.isCorrect === true}
              variant="outline"
              className={cn("h-11 px-4", m.isCorrect === true && "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white")}
              onClick={() => patch(a.id, { isCorrect: true, pointsAwarded: q.points })}
            >
              <Check />
              Đúng
            </Button>
            <Button
              type="button"
              role="radio"
              aria-checked={m.isCorrect === false}
              variant="outline"
              className={cn("h-11 px-4", m.isCorrect === false && "border-red-400 bg-red-400 text-white hover:bg-red-500 hover:text-white")}
              onClick={() => patch(a.id, { isCorrect: false, pointsAwarded: 0 })}
            >
              <X />
              Sai
            </Button>
          </div>
          <div className="flex items-center gap-1 rounded-xl border bg-white p-1" role="group" aria-label={`Điểm câu ${n}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Bớt điểm"
              disabled={(m.pointsAwarded ?? 0) <= 0 && m.pointsAwarded !== null}
              onClick={() => {
                const p = stepPoints(m.pointsAwarded, q.points, -1)
                patch(a.id, { pointsAwarded: p, isCorrect: p >= q.points / 2 })
              }}
            >
              <Minus />
            </Button>
            <span className="min-w-16 text-center text-sm font-semibold tabular-nums text-slate-800" aria-live="polite">
              {m.pointsAwarded === null ? "–" : fmt(m.pointsAwarded)}
              <span className="font-normal text-slate-400">/{fmt(q.points)}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Thêm điểm"
              disabled={(m.pointsAwarded ?? 0) >= q.points}
              onClick={() => {
                const p = stepPoints(m.pointsAwarded, q.points, 1)
                patch(a.id, { pointsAwarded: p, isCorrect: p >= q.points / 2 })
              }}
            >
              <Plus />
            </Button>
          </div>
          {essay && !paper && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-violet-700"
              title="Tính năng AI sẽ có ở giai đoạn sau"
              onClick={() => toast("Tính năng AI sẽ có ở giai đoạn sau")}
            >
              <Sparkles />
              AI gợi ý
            </Button>
          )}
        </div>

        <CommentField
          id={a.id}
          n={n}
          value={m.comment}
          defaultOpen={essay || paper || m.comment !== ""}
          onChange={(comment) => patch(a.id, { comment })}
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <Card className="gap-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", tone.text)}>
            <tone.icon className="size-4" />
            {tone.name}
          </span>
          <Badge variant="outline" className={cn("text-xs", d.attemptNo === 2 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
            Lần {d.attemptNo}
          </Badge>
          {d.gradedAt && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
              Đã chấm · đang sửa
            </Badge>
          )}
        </div>
        <h1 className="text-xl font-bold leading-snug text-slate-900 md:text-2xl">{d.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{submittedLabel(d.submittedAt, now)}</span>
          <span className="inline-flex items-center gap-1">
            {paper ? <ScanLine className="size-3.5" /> : <Monitor className="size-3.5" />}
            {paper ? "Giấy scan" : "Web"}
          </span>
          {d.durationSeconds !== null && <span>Làm trong {Math.max(1, Math.round(d.durationSeconds / 60))} phút</span>}
          <span>{d.answers.length} câu</span>
        </div>
        {paper && <p className="text-sm text-amber-700">Bài làm trên giấy: đối chiếu ảnh scan và chấm từng câu.</p>}
      </Card>

      <div className={cn("grid grid-cols-1 gap-5", paper && "lg:grid-cols-2 lg:items-start")}>
        {paper && <ScanViewer scans={d.scans} className="min-w-0 h-[60vh] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]" />}
        <div className="flex min-w-0 flex-col gap-3">
          {d.answers.map((a, i) => questionCard(a, i + 1))}

          <Card className="gap-4 p-4 md:p-5">
            <div className="space-y-2">
              <Label htmlFor="grade-feedback">Nhận xét chung</Label>
              <Textarea
                id="grade-feedback"
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Con làm tốt lắm! Lần sau nhớ..."
              />
            </div>
            {canRetry && (
              <button
                type="button"
                role="switch"
                aria-checked={retry}
                onClick={() => setRetry((r) => !r)}
                className="flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <RotateCcw className="size-5 shrink-0 text-violet-600" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-800">Cho phép làm lại lần 2</span>
                  <span className="block text-xs text-slate-500">Con sẽ thấy nút “Làm lại” sau khi xem kết quả.</span>
                </span>
                <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", retry ? "bg-indigo-600" : "bg-slate-300")}>
                  <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-[left]", retry ? "left-6" : "left-1")} />
                </span>
              </button>
            )}
          </Card>
        </div>
      </div>

      <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            {remaining ? `Còn ${remaining} câu chưa chấm` : `Tổng ${fmt(awarded)}/${fmt(total)} điểm`}
          </p>
          <p className={cn("text-2xl font-bold tabular-nums", remaining ? "text-slate-400" : st.text)}>
            {fmt(score)}<span className="text-sm font-medium text-slate-400">/10</span>
            {!remaining && <Badge variant="outline" className={cn("ml-2 align-middle", st.cls)}>{st.label}</Badge>}
          </p>
        </div>
        <Button size="lg" className="h-12 rounded-xl" disabled={saving} onClick={finish}>
          {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Hoàn tất chấm bài
        </Button>
      </div>
    </div>
  )
}

function CommentField({
  id,
  n,
  value,
  defaultOpen,
  onChange,
}: {
  id: string
  n: number
  value: string
  defaultOpen: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-fit px-0 text-slate-500" onClick={() => setOpen(true)}>
        <MessageSquarePlus />
        Thêm nhận xét
      </Button>
    )
  }
  return (
    <div className="space-y-2">
      <Input
        id={`comment-${id}`}
        aria-label={`Nhận xét câu ${n}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nhận xét cho câu này…"
      />
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {QUICK_COMMENTS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value.trim() ? `${value.trim()} ${c}` : c)}
            className="h-9 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
