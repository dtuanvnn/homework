import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { list, listItem, pressable } from "@/lib/animations"
import { play } from "@/hooks/useSound"
import { ArrowUp, ChevronRight, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import ResultDetail, { fmtScore } from "@/components/results/ResultDetail"
import TakeAssignment from "@/components/take/TakeAssignment"
import { results, type StudentResult } from "@/data/student-results"
import { takeQuestions } from "@/data/student-today"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"

export function scoreBadge(score: number) {
  if (score >= 8) return "bg-emerald-100 text-emerald-700"
  if (score >= 6.5) return "bg-indigo-100 text-indigo-700"
  if (score >= 5) return "bg-amber-100 text-amber-800"
  return "bg-red-100 text-red-700"
}

export default function StudentResults({ onHome }: { onHome: () => void }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState<StudentResult | null>(null)
  const [taking, setTaking] = useState<StudentResult | null>(null)
  const [retried, setRetried] = useState<string[]>([])
  const totalStars = results.reduce((s, r) => s + r.stars, 0)

  if (taking)
    return (
      <TakeAssignment
        title={taking.title}
        subject={taking.subject}
        questions={takeQuestions}
        onExit={() => setTaking(null)}
        onSubmit={() => {
          setRetried((p) => [...p, taking.id])
          setTaking(null)
          setOpen(null)
          toast.success("Em đã nộp lần 2! Bố mẹ sẽ chấm sớm nhé 🎉")
        }}
      />
    )

  if (open)
    return (
      <ResultDetail
        result={open}
        retryUsed={retried.includes(open.id)}
        onRetry={() => setTaking(open)}
        onHome={() => { setOpen(null); onHome() }}
      />
    )

  return (
    <div className="flex flex-col gap-6 pb-16 text-lg">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Kết quả của em</h1>
          <p className="mt-1 text-lg text-slate-500">{results.length} bài đã được bố mẹ chấm</p>
        </div>
        <span className="rounded-2xl bg-amber-100 px-4 py-2 text-lg font-extrabold text-amber-700">⭐ +{totalStars} sao</span>
      </div>
      <motion.ul className="grid gap-3 md:grid-cols-2" variants={list} initial="initial" animate="animate">
        {results.map((r) => {
          const s = SUBJECTS[r.subject]
          const waiting = retried.includes(r.id)
          return (
            <motion.li key={r.id} variants={listItem(reduced)}>
              <motion.button
                type="button"
                {...pressable(reduced)}
                onClick={() => { play("tap"); setOpen(r) }}
                className={cn("flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 text-left md:p-5", s.border)}
              >
                <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl text-white", s.bg)}>
                  <s.icon className="size-7" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn("text-sm font-bold", s.text)}>
                    {s.name} · {new Date(r.gradedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                  <p className="text-xl leading-snug font-extrabold text-slate-900">{r.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">Lần {r.attempt}</span>
                    {r.previousScore !== undefined && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600">
                        <ArrowUp className="size-4" />
                        {fmtScore(r.previousScore)} → {fmtScore(r.score)}
                      </span>
                    )}
                    {waiting ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-violet-700">Lần 2 chờ chấm</span>
                    ) : r.attempt < r.maxAttempts && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-indigo-700">
                        <RotateCcw className="size-3.5" />
                        Được làm lại
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn("rounded-2xl px-3 py-1.5 text-2xl font-black tabular-nums", scoreBadge(r.score))}>{fmtScore(r.score)}</span>
                  <span className="text-sm" aria-label={`${r.stars} sao`}>{"⭐".repeat(r.stars)}</span>
                </div>
                <ChevronRight className="size-6 shrink-0 text-slate-300" />
              </motion.button>
            </motion.li>
          )
        })}
      </motion.ul>
    </div>
  )
}
