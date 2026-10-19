"use client"

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
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppNavigation, useRequiredStudent } from "@/components/layout/AppFrame"
import { gradingPaths } from "@/components/layout/routes"
import ScanThumb from "@/components/grading/ScanThumb"
import { fmt, scoreTone, submittedLabel } from "@/components/grading/format"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { GradingQueueItem } from "@/lib/views/grading"

export default function Grading({ items, now }: { items: GradingQueueItem[]; now: string }) {
  const { navigate } = useAppNavigation()
  const student = useRequiredStudent()
  const [tab, setTab] = useState("pending")
  // `items` arrive sorted newest first.
  const pending = items.filter((s) => s.awaiting)
  const graded = items.filter((s) => !s.awaiting)

  const card = (s: GradingQueueItem) => {
    const tone = SUBJECTS[s.subject]
    const done = !s.awaiting && s.score !== null
    const st = done ? scoreTone(s.score!) : null
    const total = Math.max(1, s.totalQuestions)
    return (
      <Card key={s.attemptId} className="gap-0 overflow-hidden p-0">
        <div className="flex gap-3 p-4 md:p-5">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone.softBg, tone.text)}>
            <tone.icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn("text-xs font-semibold", tone.text)}>{tone.name}</span>
              <Badge variant="outline" className={cn("text-xs", s.attemptNo === 2 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
                Lần {s.attemptNo}
              </Badge>
              {s.submittedOffline && (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-xs text-sky-700">
                  Nộp offline
                </Badge>
              )}
            </div>
            <h3 className="font-semibold leading-snug text-slate-900 md:text-lg">{s.title}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{submittedLabel(s.submittedAt, now)}</span>
              <span className="inline-flex items-center gap-1">
                {s.mode === "web" ? <Monitor className="size-3.5" /> : <ScanLine className="size-3.5" />}
                {s.mode === "web" ? "Web" : "Giấy scan"}
              </span>
            </div>
          </div>
          {s.mode === "paper" && <ScanThumb url={s.scanUrl} className="h-14 w-11 md:h-16 md:w-12" />}
        </div>

        {done ? (
          <div className="flex flex-wrap items-center gap-3 border-t bg-slate-50/60 px-4 py-3 md:px-5">
            <p className={cn("text-3xl font-bold tabular-nums", st!.text)}>
              {fmt(s.score!)}<span className="text-base font-medium text-slate-400">/10</span>
            </p>
            <Badge variant="outline" className={st!.cls}>{st!.label}</Badge>
            <div className="ml-auto flex items-center gap-2 text-right text-xs">
              {s.retryPending ? (
                <span className="inline-flex items-center gap-1 font-medium text-violet-700"><RotateCcw className="size-3.5" />Chờ con làm lại lần 2</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500"><CheckCircle2 className="size-3.5 text-emerald-500" />Hoàn tất</span>
              )}
              <Button variant="ghost" size="sm" className="h-9 text-slate-600" onClick={() => navigate(gradingPaths.attempt(s.attemptId))}>
                <PenLine />
                Xem lại
              </Button>
            </div>
            {s.feedback && <p className="w-full text-sm text-slate-600">“{s.feedback}”</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t bg-amber-50/40 px-4 py-3 sm:flex-row sm:items-center md:px-5">
            <div className="flex-1 space-y-1.5">
              <p className="text-sm text-slate-700">
                {s.flashcard ? (
                  <span className="font-semibold">{s.totalQuestions} từ viết tay · chờ chấm</span>
                ) : s.mode === "paper" && s.autoCorrect + s.autoWrong === 0 ? (
                  <span className="font-semibold">Chấm từ ảnh scan: {s.ungraded} câu</span>
                ) : (
                  <>
                    <span className="font-semibold">Tự chấm: {s.autoCorrect}/{s.totalQuestions} câu</span>
                    {s.ungraded > 0 && <span className="text-amber-700"> · còn {s.ungraded} câu {s.mode === "paper" ? "cần chấm" : "tự luận"}</span>}
                  </>
                )}
              </p>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200">
                <span className="bg-emerald-500" style={{ width: `${(s.autoCorrect / total) * 100}%` }} />
                <span className="bg-red-300" style={{ width: `${(s.autoWrong / total) * 100}%` }} />
              </div>
            </div>
            <Button size="lg" className="h-11 rounded-xl" onClick={() => navigate(gradingPaths.attempt(s.attemptId))}>
              <PenLine />
              Chấm ngay
            </Button>
          </div>
        )}
      </Card>
    )
  }

  const list = (data: GradingQueueItem[], empty: string) =>
    data.length ? (
      <div className="grid gap-3 lg:grid-cols-2">{data.map(card)}</div>
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
          {pending.length ? `${student.name} đang chờ bố mẹ chấm ${pending.length} bài.` : "Đã chấm xong tất cả, tuyệt vời!"}
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
    </div>
  )
}
