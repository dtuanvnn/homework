"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ChevronLeft, Loader2, Play } from "lucide-react"
import Press from "@/components/fun/Press"
import { Button } from "@/components/ui/button"
import { pop } from "@/lib/animations"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { SubjectId } from "@/lib/types"

/** The card before an exam-mode assignment: the clock only starts on "Bắt đầu". */
export default function StartTimed({
  title,
  subject,
  questionCount,
  limitMinutes,
  onBack,
  onStart,
}: {
  title: string
  subject: SubjectId
  questionCount: number
  limitMinutes: number
  onBack: () => void
  onStart: () => Promise<void>
}) {
  const tone = SUBJECTS[subject]
  const reduced = useReducedMotion()
  const [starting, setStarting] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50" role="dialog" aria-modal aria-label={`Bắt đầu: ${title}`}>
      <header className="px-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:px-6">
        <Button variant="ghost" className="h-12 rounded-full text-base [&_svg]:size-6" onClick={onBack}>
          <ChevronLeft />
          Để sau
        </Button>
      </header>
      <main className="flex flex-1 items-center justify-center overflow-y-auto px-4 pb-10">
        <motion.div variants={pop} initial="initial" animate="animate" className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <motion.span
            className="text-8xl"
            aria-hidden
            animate={reduced ? undefined : { rotate: [0, -8, 8, -5, 5, 0] }}
            transition={{ duration: 1.2, delay: 0.4, repeat: Infinity, repeatDelay: 2.5 }}
          >
            ⏱️
          </motion.span>
          <div className="space-y-2">
            <p className={cn("text-base font-bold", tone.text)}>{tone.name}</p>
            <h1 className="text-2xl leading-snug font-extrabold text-slate-900 md:text-3xl">{title}</h1>
          </div>
          <div className="w-full rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-5xl font-extrabold text-slate-900 tabular-nums">
              {limitMinutes} <span className="text-2xl">phút</span>
            </p>
            <p className="mt-1 text-base text-slate-500">{questionCount} câu</p>
            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              Hết giờ bài sẽ <b>tự nộp</b>. Đồng hồ vẫn chạy nếu em thoát ra giữa chừng.
            </p>
          </div>
          <p className="text-base text-slate-500">Em chuẩn bị sẵn sàng rồi bấm Bắt đầu nhé!</p>
          <Press className="max-w-sm" sound={null}>
            <Button
              className="h-16 w-full rounded-2xl bg-emerald-600 text-xl font-extrabold hover:bg-emerald-700 [&_svg]:size-6"
              disabled={starting}
              onClick={async () => {
                setStarting(true)
                await onStart()
                setStarting(false)
              }}
            >
              {starting ? <Loader2 className="animate-spin" /> : <Play />}
              Bắt đầu
            </Button>
          </Press>
        </motion.div>
      </main>
    </div>
  )
}
