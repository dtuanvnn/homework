import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import CountUp from "@/components/fun/CountUp"
import Mascot from "@/components/fun/Mascot"
import Press from "@/components/fun/Press"
import { celebrate, list, listItem, pressable } from "@/lib/animations"
import { play } from "@/hooks/useSound"
import {
  Camera,
  CheckCircle2,
  Clock3,
  Hourglass,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { TODAY, student } from "@/data/mock-data"
import { takeQuestions, todayItems, upcoming, type TodayItem } from "@/data/student-today"
import TakeAssignment from "@/components/take/TakeAssignment"
import PaperSubmit from "@/components/paper/PaperSubmit"
import ResultDetail from "@/components/results/ResultDetail"
import { resultForTitle } from "@/data/student-results"
import { formatVietnameseDate } from "@/lib/format"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"

const STARS = 46
const STREAK = 5

const STATUS_CHIP: Record<TodayItem["status"], { label: string; cls: string }> = {
  "not-started": { label: "Chưa làm", cls: "bg-white text-slate-600" },
  "in-progress": { label: "Đang làm", cls: "bg-amber-100 text-amber-800" },
  submitted: { label: "Đã nộp", cls: "bg-violet-100 text-violet-700" },
  graded: { label: "Đã chấm", cls: "bg-emerald-100 text-emerald-700" },
}

const isDone = (i: TodayItem) => i.status === "submitted" || i.status === "graded"

export default function StudentToday() {
  const reduced = useReducedMotion()
  const [items, setItems] = useState(todayItems)
  const [stars, setStars] = useState(STARS)
  const [taking, setTaking] = useState<TodayItem | null>(null)
  const [paper, setPaper] = useState<TodayItem | null>(null)
  const [viewing, setViewing] = useState<TodayItem | null>(null)
  const [saved, setSaved] = useState<Record<string, Record<string, unknown>>>({})
  const update = (id: string, patch: Partial<TodayItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const remaining = items.filter((i) => !isDone(i))
  const allDone = remaining.length === 0
  useEffect(() => {
    if (!allDone) return
    play("celebrate")
    celebrate("big")
  }, [allDone])
  const ordered = [...remaining, ...items.filter(isDone)]

  const action = (item: TodayItem) => <Press>{actionButton(item)}</Press>
  const actionButton = (item: TodayItem) => {
    const big = "h-14 w-full rounded-2xl text-lg font-bold [&_svg]:size-6"
    if (item.status === "submitted")
      return (
        <Button disabled className={cn(big, "bg-violet-100 text-violet-700 opacity-100 disabled:opacity-100")}>
          <Hourglass />
          Đã nộp – chờ bố mẹ chấm
        </Button>
      )
    if (item.status === "graded")
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className={cn(big, "bg-emerald-600 hover:bg-emerald-700")} onClick={() => setViewing(item)}>
            <Trophy />
            Xem kết quả
          </Button>
          {item.attempt < item.maxAttempts && (
            <Button variant="outline" className={cn(big, "border-2 border-indigo-200 bg-white text-indigo-700")} onClick={() => { update(item.id, { status: "in-progress", progress: 0, attempt: 2 }); setSaved((p) => ({ ...p, [item.id]: {} })); setTaking({ ...item, attempt: 2 }) }}>
              <RotateCcw />
              Làm lại lần 2
            </Button>
          )}
        </div>
      )
    if (item.mode === "paper")
      return (
        <Button className={big} onClick={() => setPaper(item)}>
          <Camera />
          Nộp bài giấy
        </Button>
      )
    if (item.status === "in-progress")
      return (
        <Button className={cn(big, "bg-amber-500 hover:bg-amber-600")} onClick={() => setTaking(item)}>
          <Play className="fill-current" />
          Làm tiếp
        </Button>
      )
    return (
      <Button className={big} onClick={() => { update(item.id, { status: "in-progress", progress: item.progress ?? 0 }); setTaking(item) }}>
        <Play className="fill-current" />
        Bắt đầu
      </Button>
    )
  }

  if (paper)
    return (
      <PaperSubmit
        title={paper.title}
        subject={paper.subject}
        onClose={() => setPaper(null)}
        onSubmitted={() => {
          update(paper.id, { status: "submitted" })
          setStars((n) => n + 1)
          setPaper(null)
        }}
      />
    )

  if (viewing) {
    const base = resultForTitle(viewing.title)
    const score = viewing.score ?? base.score
    return (
      <ResultDetail
        result={{ ...base, title: viewing.title, subject: viewing.subject, score, attempt: viewing.attempt, maxAttempts: viewing.maxAttempts, previousScore: viewing.attempt === 2 ? base.previousScore : undefined, stars: score >= 9 ? 3 : score >= 7 ? 2 : 1, parentComment: viewing.note ?? base.parentComment }}
        onRetry={() => {
          const item = viewing
          setViewing(null)
          update(item.id, { status: "in-progress", progress: 0, attempt: 2 })
          setSaved((p) => ({ ...p, [item.id]: {} }))
          setTaking({ ...item, attempt: 2 })
        }}
        onHome={() => setViewing(null)}
      />
    )
  }

  if (taking)
    return (
      <TakeAssignment
        title={taking.title}
        subject={taking.subject}
        questions={takeQuestions}
        initialAnswers={saved[taking.id]}
        onExit={(answers, progress) => {
          setSaved((p) => ({ ...p, [taking.id]: answers }))
          update(taking.id, { status: "in-progress", progress })
          setTaking(null)
          toast("Đã lưu bài làm. Em làm tiếp sau nhé!")
        }}
        onSubmit={() => {
          update(taking.id, { status: "submitted" })
          setStars((n) => n + 1)
          setTaking(null)
          toast.success("Em đã nộp bài, giỏi quá! 🎉")
        }}
      />
    )

  return (
    <div className="flex flex-col gap-6 pb-16 text-lg">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg shadow-indigo-600/20 md:p-8">
        <div className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 right-20 size-32 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-medium text-indigo-100">{formatVietnameseDate(TODAY)}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Chào {student.name}!{" "}
              <motion.span
                className="inline-block origin-[70%_80%]"
                initial={{ rotate: 0 }}
                animate={reduced ? {} : { rotate: [0, 18, -10, 18, -4, 0] }}
                transition={{ duration: 1, delay: 0.3 }}
                aria-hidden
              >
                👋
              </motion.span>
            </h1>
            <p className="mt-2 text-base text-indigo-50 md:text-lg">
              {allDone ? "Em đã làm xong hết bài hôm nay rồi!" : <>Hôm nay em còn <strong className="text-white">{remaining.length} bài</strong>. Cố lên nhé!</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xl font-extrabold text-amber-600 shadow-sm">
              <motion.span key={stars} initial={reduced ? false : { scale: 1.5, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 12 }} aria-hidden>⭐</motion.span>
              <span><CountUp value={stars} /> sao</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-400/90 px-3 py-1.5 text-sm font-bold text-white">
              <motion.span
                className="inline-block origin-bottom"
                animate={reduced ? {} : { scaleY: [1, 1.12, 0.94, 1.06, 1], rotate: [0, -3, 2, -1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                🔥
              </motion.span>
              {STREAK} ngày liên tiếp
            </span>
          </div>
        </div>
      </section>

      {/* Today */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-slate-900">Bài hôm nay</h2>
        {allDone && (
          <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex flex-col items-center gap-2 rounded-[28px] border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-amber-50 px-6 py-10 text-center">
            <Mascot mood="cheer" />
            <p className="text-3xl font-extrabold text-emerald-700">Hoàn thành hết rồi! 🎉</p>
            <p className="text-lg text-slate-600">Em giỏi quá! Nghỉ ngơi và chơi thật vui nhé.</p>
            <p className="mt-1 text-4xl" aria-hidden>🏆 ⭐ 🌈</p>
          </motion.div>
        )}
        <motion.div className="grid gap-4 md:grid-cols-2" variants={list} initial="initial" animate="animate">
          {ordered.map((item) => {
            const s = SUBJECTS[item.subject]
            const chip = STATUS_CHIP[item.status]
            return (
              <motion.article
                key={item.id}
                layout={!reduced}
                variants={listItem(reduced)}
                {...pressable(reduced)}
                className={cn(
                  "flex flex-col gap-4 rounded-[28px] border-2 p-5 md:p-6",
                  s.softBg,
                  s.border,
                  isDone(item) && "opacity-80",
                )}
              >
                <div className="flex items-start gap-4">
                  <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md", s.bg)}>
                    <s.icon className="size-8" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-base font-bold", s.text)}>{s.name}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold", chip.cls)}>{chip.label}</span>
                      {item.attempt === 2 && <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-bold text-indigo-700">Lần 2</span>}
                    </div>
                    <h3 className="mt-1 text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">{item.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-base text-slate-600">
                      <span>{item.questions} câu · khoảng {item.minutes} phút</span>
                      <span className="inline-flex items-center gap-1 text-sm text-slate-500"><Clock3 className="size-4" />Hạn {item.due}</span>
                    </p>
                  </div>
                </div>

                {item.note && (
                  <div className="flex items-end gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm" aria-hidden>👩</span>
                    <p className="relative rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-base font-medium text-slate-700 shadow-sm">
                      <span className="sr-only">Lời nhắn của bố mẹ: </span>
                      {item.note}
                    </p>
                  </div>
                )}

                {item.status === "in-progress" && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm font-semibold text-slate-600">
                      <span>Em đã làm</span>
                      <span>{item.progress ?? 0}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={item.progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
                      <div className={cn("h-full rounded-full transition-all", s.bg)} style={{ width: `${item.progress ?? 0}%` }} />
                    </div>
                  </div>
                )}

                {item.status === "graded" && item.score !== undefined && (
                  <p className="flex items-center gap-2 text-base font-semibold text-emerald-700">
                    <CheckCircle2 className="size-5" />
                    Bố mẹ đã chấm xong!
                  </p>
                )}

                <div className="mt-auto">{action(item)}</div>
              </motion.article>
            )
          })}
        </motion.div>
      </section>

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold text-slate-900">Sắp tới</h2>
        <motion.div variants={list} initial="initial" animate="animate" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {upcoming.map((u) => {
            const s = SUBJECTS[u.subject]
            return (
              <motion.div key={u.title} variants={listItem(reduced)} className="flex w-56 shrink-0 snap-start flex-col gap-2 rounded-3xl border-2 border-slate-100 bg-white p-4 md:w-auto">
                <div className="flex items-center gap-2">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", s.softBg, s.text)}>
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-sm font-bold text-slate-500">{u.day} · {u.date}</span>
                </div>
                <p className="text-base font-bold leading-snug text-slate-800">{u.title}</p>
                <p className="text-sm text-slate-500">khoảng {u.minutes} phút</p>
              </motion.div>
            )
          })}
        </motion.div>
      </section>
    </div>
  )
}
