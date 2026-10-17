"use client"

import { useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"
import CountUp from "@/components/fun/CountUp"
import Mascot from "@/components/fun/Mascot"
import Press from "@/components/fun/Press"
import CelebrationCard from "@/components/rewards/CelebrationCard"
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
import { Button } from "@/components/ui/button"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { OfflineChip } from "@/components/offline/OfflineBanner"
import { useOffline } from "@/components/offline/OfflineSync"
import { studentPaths } from "@/components/layout/routes"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { Celebration } from "@/lib/rewards/badges"
import type { TodayItem, TodayView } from "@/lib/views/student"

const STATUS_CHIP: Record<TodayItem["status"], { label: string; cls: string }> = {
  "not-started": { label: "Chưa làm", cls: "bg-white text-slate-600" },
  "in-progress": { label: "Đang làm", cls: "bg-amber-100 text-amber-800" },
  submitted: { label: "Đã nộp", cls: "bg-violet-100 text-violet-700" },
  graded: { label: "Đã chấm", cls: "bg-emerald-100 text-emerald-700" },
}

const isDone = (i: TodayItem) => i.status === "submitted" || i.status === "graded"

export default function StudentToday({
  studentName,
  stars,
  dateLabel,
  items,
  upcoming,
  streak,
  celebrations,
}: TodayView & { studentName: string; stars: number; celebrations: Celebration[] }) {
  const reduced = useReducedMotion()
  const { navigate } = useAppNavigation()
  const { pending } = useOffline()
  const remaining = items.filter((i) => !isDone(i))
  const allDone = remaining.length === 0
  const celebrateDone = allDone && items.length > 0
  useEffect(() => {
    if (!celebrateDone) return
    play("celebrate")
    celebrate("big")
  }, [celebrateDone])
  const ordered = [...remaining, ...items.filter(isDone)]

  const action = (item: TodayItem) => <Press>{actionButton(item)}</Press>
  const actionButton = (item: TodayItem) => {
    const big = "h-14 w-full rounded-2xl text-lg font-bold [&_svg]:size-6"
    if (pending.has(item.id))
      return (
        <Button disabled className={cn(big, "bg-violet-100 text-violet-700 opacity-100 disabled:opacity-100")}>
          <Hourglass />
          Đã nộp – chờ gửi khi có mạng
        </Button>
      )
    if (item.status === "submitted")
      return (
        <Button disabled className={cn(big, "bg-violet-100 text-violet-700 opacity-100 disabled:opacity-100")}>
          <Hourglass />
          Đã nộp – chờ bố mẹ chấm
        </Button>
      )
    if (item.status === "graded")
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-2">
          <Button className={cn(big, "bg-emerald-600 hover:bg-emerald-700")} onClick={() => item.resultId && navigate(studentPaths.result(item.resultId))}>
            <Trophy />
            Xem kết quả
          </Button>
          {item.canRetry && (
            <Button variant="outline" className={cn(big, "border-2 border-indigo-200 bg-white text-indigo-700")} onClick={() => navigate(item.mode === "paper" ? studentPaths.paper(item.id) : studentPaths.take(item.id))}>
              <RotateCcw />
              Làm lại lần 2
            </Button>
          )}
        </div>
      )
    if (item.mode === "paper")
      return (
        <Button className={big} onClick={() => navigate(studentPaths.paper(item.id))}>
          <Camera />
          Nộp bài giấy
        </Button>
      )
    if (item.status === "in-progress")
      return (
        <Button className={cn(big, "bg-amber-500 hover:bg-amber-600")} onClick={() => navigate(studentPaths.take(item.id))}>
          <Play className="fill-current" />
          Làm tiếp
        </Button>
      )
    return (
      <Button className={big} onClick={() => navigate(studentPaths.take(item.id))}>
        <Play className="fill-current" />
        Bắt đầu
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-16 text-lg">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg shadow-indigo-600/20 md:p-8">
        <div className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 right-20 size-32 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-medium text-indigo-100">{dateLabel}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Chào {studentName}!{" "}
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
            {streak > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-400/90 px-3 py-1.5 text-sm font-bold text-white">
              <motion.span
                className="inline-block origin-bottom"
                animate={reduced ? {} : { scaleY: [1, 1.12, 0.94, 1.06, 1], rotate: [0, -3, 2, -1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                🔥
              </motion.span>
              {streak} ngày liên tiếp
            </span>}
          </div>
        </div>
      </section>

      <CelebrationCard items={celebrations} />

      {/* Today */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-slate-900">Bài hôm nay</h2>
        {!items.length && (
          <div className="flex flex-col items-center gap-2 rounded-[28px] border-2 border-dashed border-indigo-200 bg-white px-6 py-10 text-center">
            <Mascot mood="cheer" />
            <p className="text-2xl font-extrabold text-slate-800">Hôm nay em không có bài nào 🌈</p>
            <p className="text-lg text-slate-600">Đọc sách hoặc chơi thật vui nhé!</p>
          </div>
        )}
        {celebrateDone && (
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
                  "flex min-w-0 flex-col gap-4 rounded-[28px] border-2 p-5 md:p-6",
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
                      {item.overdue && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-700">Trễ hạn</span>}
                      {item.attempt === 2 && <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-bold text-indigo-700">Lần 2</span>}
                      {item.timeLimit && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">⏱ {item.timeLimit} phút</span>}
                      <OfflineChip assignmentId={item.id} mode={item.mode} />
                    </div>
                    <h3 className="mt-1 text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">{item.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-base text-slate-600">
                      <span>{item.questions} câu · {item.timeLimit ? `làm trong ${item.timeLimit} phút` : `khoảng ${item.minutes} phút`}</span>
                      <span className={cn("inline-flex items-center gap-1 text-sm", item.overdue ? "font-bold text-red-600" : "text-slate-500")}><Clock3 className="size-4" />Hạn {item.due}</span>
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
      {upcoming.length > 0 && <section className="space-y-3">
        <h2 className="text-2xl font-extrabold text-slate-900">Sắp tới</h2>
        <motion.div variants={list} initial="initial" animate="animate" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {upcoming.map((u) => {
            const s = SUBJECTS[u.subject]
            return (
              <motion.div key={u.id} variants={listItem(reduced)} className="flex w-56 shrink-0 snap-start flex-col gap-2 rounded-3xl border-2 border-slate-100 bg-white p-4 md:w-auto">
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
      </section>}
    </div>
  )
}
