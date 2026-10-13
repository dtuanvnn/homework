"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LOW_CONFIDENCE, type AiPaperMark } from "@/lib/ai/grading"
import { cn } from "@/lib/utils"
import RichText from "@/components/question/RichText"

/** Seconds since `running` became true, for the progress note of slow AI calls. */
function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) return
    const started = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => {
      clearInterval(id)
      setSeconds(0)
    }
  }, [running])
  return seconds
}

/** The prominent "let AI grade" card above the questions, with a progress note while it works. */
export function AiAssistCard({
  heading,
  title,
  description,
  busyText,
  busy,
  disabled,
  onRun,
}: {
  heading: string
  title: string
  description: string
  busyText: string
  busy: boolean
  disabled?: boolean
  onRun: () => void
}) {
  const seconds = useElapsed(busy)
  return (
    <Card className="gap-3 border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 md:flex-row md:items-center md:p-5">
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white md:flex">
        <Sparkles className="size-5" />
      </span>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="font-semibold text-slate-900">{busy ? busyText : heading}</p>
        <p className="text-sm text-slate-500">
          {busy ? `Đã ${seconds} giây · thường mất 1–2 phút, đừng đóng trang nhé.` : description}
        </p>
      </div>
      <Button size="lg" className="h-12 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700" disabled={busy || disabled} onClick={onRun}>
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "AI đang chấm…" : title}
      </Button>
    </Card>
  )
}

/** What AI read from the scan for one question, flagged when it is unsure. */
export function AiReadout({ read }: { read: Pick<AiPaperMark, "studentAnswer" | "note" | "confidence"> }) {
  const unsure = read.confidence < LOW_CONFIDENCE
  return (
    <div className={cn("mt-2 rounded-lg border bg-white/80 p-2", unsure ? "border-amber-300" : "border-violet-100")}>
      <p className="text-xs font-semibold text-violet-700">AI đọc được</p>
      <p className="break-words whitespace-pre-wrap text-slate-800">
        <RichText text={read.studentAnswer || "(không tìm thấy câu trả lời)"} />
      </p>
      {read.note && <p className="mt-1 text-xs text-slate-500">{read.note}</p>}
      {unsure && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
          <AlertTriangle className="size-3.5" />
          AI chưa chắc – kiểm tra lại
        </p>
      )}
    </div>
  )
}
