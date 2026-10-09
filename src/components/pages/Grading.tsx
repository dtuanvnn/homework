import { useState } from "react"
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Monitor,
  PenLine,
  RotateCcw,
  ScanLine,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useLibrary } from "@/state/library-store"
import { TODAY } from "@/data/mock-data"
import { submissions as seed, type Submission } from "@/data/grading-data"
import { dateInput, timeLabel } from "@/lib/schedule"
import { addDays } from "@/lib/dates"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })

function submittedLabel(iso: string) {
  const d = new Date(iso)
  const key = dateInput(d)
  const day =
    key === dateInput(TODAY)
      ? "hôm nay"
      : key === dateInput(addDays(TODAY, -1))
        ? "hôm qua"
        : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
  return `Nộp lúc ${timeLabel(iso)}, ${day}`
}

function scoreTone(score: number) {
  if (score >= 8) return { label: "Giỏi", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600" }
  if (score >= 6.5) return { label: "Khá", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", text: "text-indigo-600" }
  if (score >= 5) return { label: "Đạt", cls: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600" }
  return { label: "Cần cố gắng", cls: "bg-red-50 text-red-700 border-red-200", text: "text-red-600" }
}

const totalQuestions = (s: Submission) => s.autoTotal + s.essays.length
const roundHalf = (n: number) => Math.round(n * 2) / 2

/** Stylised mini page standing in for the scanned photo. */
function ScanThumb({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex shrink-0 rotate-[-3deg] flex-col gap-1 rounded-md border border-slate-200 bg-[#fffdf6] p-1.5 shadow-sm",
        className,
      )}
    >
      {[80, 60, 90, 50, 75, 65].map((w, i) => (
        <span key={i} className="h-0.5 rounded bg-slate-300" style={{ width: `${w}%` }} />
      ))}
      <span className="absolute right-1 bottom-1 size-2.5 rounded-full border border-red-400" />
    </div>
  )
}

export default function Grading() {
  const library = useLibrary()
  const [items, setItems] = useState(seed)
  const [tab, setTab] = useState("pending")
  const [grading, setGrading] = useState<Submission | null>(null)
  const pending = items.filter((s) => s.finalScore === undefined)
  const graded = items.filter((s) => s.finalScore !== undefined)
  const sorted = (list: Submission[]) =>
    [...list].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const card = (s: Submission) => {
    const set = library.getSet(s.exerciseSetId)
    const tone = set ? SUBJECTS[set.subject] : null
    const done = s.finalScore !== undefined
    const st = done ? scoreTone(s.finalScore!) : null
    return (
      <Card key={s.id} className="gap-0 overflow-hidden p-0">
        <div className="flex gap-3 p-4 md:p-5">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone?.softBg, tone?.text)}>
            {tone && <tone.icon className="size-5" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn("text-xs font-semibold", tone?.text)}>{tone?.name}</span>
              <Badge variant="outline" className={cn("text-xs", s.attempt === 2 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
                Lần {s.attempt}
              </Badge>
            </div>
            <h3 className="font-semibold leading-snug text-slate-900 md:text-lg">{set?.title ?? "Bộ bài đã bị xóa"}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{submittedLabel(s.submittedAt)}</span>
              <span className="inline-flex items-center gap-1">
                {s.mode === "web" ? <Monitor className="size-3.5" /> : <ScanLine className="size-3.5" />}
                {s.mode === "web" ? "Web" : "Giấy scan"}
              </span>
            </div>
          </div>
          {s.mode === "paper" && <ScanThumb className="h-14 w-11 md:h-16 md:w-12" />}
        </div>

        {done ? (
          <div className="flex flex-wrap items-center gap-3 border-t bg-slate-50/60 px-4 py-3 md:px-5">
            <p className={cn("text-3xl font-bold tabular-nums", st!.text)}>
              {fmt(s.finalScore!)}<span className="text-base font-medium text-slate-400">/10</span>
            </p>
            <Badge variant="outline" className={st!.cls}>{st!.label}</Badge>
            <div className="ml-auto text-right text-xs">
              {s.retryPending ? (
                <span className="inline-flex items-center gap-1 font-medium text-violet-700"><RotateCcw className="size-3.5" />Chờ con làm lại lần 2</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500"><CheckCircle2 className="size-3.5 text-emerald-500" />Hoàn tất</span>
              )}
            </div>
            {s.feedback && <p className="w-full text-sm text-slate-600">“{s.feedback}”</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t bg-amber-50/40 px-4 py-3 sm:flex-row sm:items-center md:px-5">
            <div className="flex-1 space-y-1.5">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Tự chấm: {s.autoCorrect}/{totalQuestions(s)} câu</span>
                {s.essays.length > 0 && <span className="text-amber-700"> · còn {s.essays.length} câu tự luận</span>}
              </p>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200">
                <span className="bg-emerald-500" style={{ width: `${(s.autoCorrect / totalQuestions(s)) * 100}%` }} />
                <span className="bg-red-300" style={{ width: `${((s.autoTotal - s.autoCorrect) / totalQuestions(s)) * 100}%` }} />
              </div>
            </div>
            <Button size="lg" className="h-11 rounded-xl" onClick={() => setGrading(s)}>
              <PenLine />
              Chấm ngay
            </Button>
          </div>
        )}
      </Card>
    )
  }

  const list = (data: Submission[], empty: string) =>
    data.length ? (
      <div className="grid gap-3 lg:grid-cols-2">{sorted(data).map(card)}</div>
    ) : (
      <Card className="items-center gap-3 border-dashed py-12 text-center shadow-none">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
          <ClipboardCheck className="size-7 text-emerald-500" />
        </div>
        <p className="font-semibold text-slate-800">{empty}</p>
      </Card>
    )

  return (
    <div className="flex flex-col gap-5 pb-16">
      <div>
        <h1 className="hidden text-3xl font-bold tracking-tight text-slate-900 md:block">Chấm bài</h1>
        <p className="text-slate-500 md:mt-1.5">
          {pending.length ? `Minh An đang chờ bố mẹ chấm ${pending.length} bài.` : "Đã chấm xong tất cả, tuyệt vời!"}
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="pending">Chờ chấm ({pending.length})</TabsTrigger>
          <TabsTrigger value="graded">Đã chấm</TabsTrigger>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{list(pending, "Không còn bài nào chờ chấm")}</TabsContent>
        <TabsContent value="graded">{list(graded, "Chưa có bài nào được chấm")}</TabsContent>
        <TabsContent value="all">{list(items, "Chưa có bài nộp")}</TabsContent>
      </Tabs>
      {grading && (
        <GradeDialog
          submission={grading}
          title={library.getSet(grading.exerciseSetId)?.title ?? ""}
          onClose={() => setGrading(null)}
          onSave={(score, feedback, retry) => {
            setItems((prev) => prev.map((s) => (s.id === grading.id ? { ...s, finalScore: score, feedback, retryPending: retry } : s)))
            setGrading(null)
            toast.success(`Đã chấm: ${fmt(score)}/10`, { description: retry ? "Con sẽ được làm lại lần 2." : "Kết quả đã gửi tới Minh An." })
          }}
        />
      )}
    </div>
  )
}

function GradeDialog({
  submission: s,
  title,
  onClose,
  onSave,
}: {
  submission: Submission
  title: string
  onClose: () => void
  onSave: (score: number, feedback: string, retry: boolean) => void
}) {
  const [points, setPoints] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState("")
  const total = totalQuestions(s)
  const earned = s.autoCorrect + s.essays.reduce((sum, e) => sum + (points[e.id] ?? 0), 0)
  const score = roundHalf((earned / total) * 10)
  const ready = s.essays.every((e) => points[e.id] !== undefined)
  const canRetry = s.attempt < s.maxAttempts
  const tone = scoreTone(score)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chấm bài: {title}</DialogTitle>
          <DialogDescription>
            Lần {s.attempt} · {submittedLabel(s.submittedAt)} · Tự chấm {s.autoCorrect}/{s.autoTotal} câu trắc nghiệm
          </DialogDescription>
        </DialogHeader>
        {s.mode === "paper" && (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <ScanThumb className="h-20 w-16" />
            Ảnh scan bài làm trên giấy. Đối chiếu bài làm của con với câu hỏi bên dưới.
          </div>
        )}
        <div className="space-y-3">
          {s.essays.map((e, i) => (
            <div key={e.id} className="space-y-2 rounded-xl border p-3">
              <p className="text-xs font-semibold text-amber-700">Câu tự luận {i + 1}</p>
              <p className="text-sm font-medium text-slate-800">{e.prompt}</p>
              <p className="rounded-lg bg-indigo-50/60 p-2.5 text-sm text-slate-700">{e.answer}</p>
              <div className="flex gap-2" role="radiogroup" aria-label={`Điểm câu ${i + 1}`}>
                {[
                  { v: 0, label: "Sai" },
                  { v: e.maxPoints / 2, label: "Đúng một phần" },
                  { v: e.maxPoints, label: "Đúng" },
                ].map((o) => (
                  <Button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={points[e.id] === o.v}
                    variant={points[e.id] === o.v ? "default" : "outline"}
                    className="h-10 flex-1 text-xs sm:text-sm"
                    onClick={() => setPoints((p) => ({ ...p, [e.id]: o.v }))}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="fb">Lời nhắn cho con</Label>
          <Textarea id="fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Con làm tốt lắm! Lần sau nhớ..." />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <span className="text-sm text-slate-600">Điểm cuối cùng</span>
          <span className={cn("text-2xl font-bold tabular-nums", ready ? tone.text : "text-slate-300")}>
            {ready ? fmt(score) : "–"}<span className="text-sm font-medium text-slate-400">/10</span>
          </span>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {canRetry && (
            <Button variant="outline" disabled={!ready} onClick={() => onSave(score, feedback, true)}>
              <RotateCcw />
              Lưu & cho làm lại
            </Button>
          )}
          <Button disabled={!ready} onClick={() => onSave(score, feedback, false)}>
            <CheckCircle2 />
            Hoàn tất chấm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
