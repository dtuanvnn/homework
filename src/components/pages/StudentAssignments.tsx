"use client"

import { useState } from "react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import Press from "@/components/fun/Press"
import { latePulse, listItem, pressable, spring } from "@/lib/animations"
import { play } from "@/hooks/useSound"
import { Camera, Hourglass, Play, RotateCcw, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { OfflineChip } from "@/components/offline/OfflineBanner"
import { useOffline } from "@/components/offline/OfflineSync"
import { studentPaths } from "@/components/layout/routes"
import { fmtScore } from "@/components/results/ResultDetail"
import { scoreBadge } from "@/components/pages/StudentResults"
import { starsFor } from "@/lib/grading"
import { SUBJECT_LIST, SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { SubjectId } from "@/lib/types"
import type { AssignmentGroup, AssignmentsView, MyAssignment } from "@/lib/views/student"

type TabId = "todo" | "waiting" | "retry" | "done"

const TAB_OF = (a: MyAssignment): TabId =>
  a.status === "submitted" ? "waiting" : a.status === "graded" ? (a.canRetry ? "retry" : "done") : "todo"

/** Card entrance + one gentle red pulse for overdue cards. */
const lateVariants = {
  ...listItem(false),
  animate: { opacity: 1, y: 0, scale: 1, boxShadow: latePulse.boxShadow, transition: { ...spring, boxShadow: latePulse.transition } },
}

const EMPTY: Record<TabId, { emoji: string; title: string; text: string }> = {
  todo: { emoji: "🎉", title: "Không còn bài nào cần làm. Giỏi quá! 🎉", text: "Em đi chơi hoặc đọc sách nhé." },
  waiting: { emoji: "📭", title: "Chưa có bài nào chờ chấm", text: "Bài em nộp sẽ hiện ở đây." },
  retry: { emoji: "🌱", title: "Không có bài nào cần làm lại", text: "Em đã cố gắng hết sức rồi!" },
  done: { emoji: "📚", title: "Chưa có bài nào xong", text: "Làm xong bài đầu tiên để thấy ở đây nhé." },
}

export default function StudentAssignments({ items, week }: AssignmentsView) {
  const reduced = useReducedMotion()
  const { navigate } = useAppNavigation()
  const { pending } = useOffline()
  const [tab, setTab] = useState<TabId>("todo")
  const [subject, setSubject] = useState<SubjectId | "all">("all")

  // Weekly summary
  const { done: weekDone, total: weekTotal } = week

  const counts = { todo: 0, waiting: 0, retry: 0, done: 0 } as Record<TabId, number>
  items.forEach((a) => counts[TAB_OF(a)]++)
  const tabs: { id: TabId; label: string }[] = [
    { id: "todo", label: "Cần làm" },
    { id: "waiting", label: "Chờ chấm" },
    { id: "retry", label: "Làm lại" },
    { id: "done", label: "Đã xong" },
  ]

  const visible = items
    .filter((a) => TAB_OF(a) === tab && (subject === "all" || a.subject === subject))
    .sort((a, b) => (tab === "todo" ? a.due.localeCompare(b.due) : b.due.localeCompare(a.due)))
  const groups: (AssignmentGroup & { items: MyAssignment[] })[] = []
  for (const a of visible) {
    const g = a.group
    const last = groups.find((x) => x.key === g.key)
    if (last) last.items.push(a)
    else groups.push({ ...g, items: [a] })
  }

  const startRetry = (a: MyAssignment) => navigate(a.mode === "paper" ? studentPaths.paper(a.id) : studentPaths.take(a.id))
  const viewResult = (a: MyAssignment) => { if (a.resultId) navigate(studentPaths.result(a.resultId)) }
  const open = (a: MyAssignment) => {
    if (a.status === "submitted" || pending.has(a.id)) return
    if (a.status === "graded") return viewResult(a)
    navigate(a.mode === "paper" ? studentPaths.paper(a.id) : studentPaths.take(a.id))
  }

  const action = (a: MyAssignment) => <Press>{actionButton(a)}</Press>
  const actionButton = (a: MyAssignment) => {
    const big = "h-14 w-full rounded-2xl text-lg font-bold [&_svg]:size-6"
    const go = (e: React.MouseEvent, fn: () => void) => { e.stopPropagation(); fn() }
    if (pending.has(a.id))
      return <Button disabled className={cn(big, "bg-violet-100 text-violet-700 disabled:opacity-100")}><Hourglass />Đã nộp – chờ gửi khi có mạng</Button>
    if (a.status === "submitted")
      return <Button disabled className={cn(big, "bg-violet-100 text-violet-700 disabled:opacity-100")}><Hourglass />Đang chờ bố mẹ chấm</Button>
    if (a.status === "graded")
      return a.canRetry ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className={big} onClick={(e) => go(e, () => startRetry(a))}><RotateCcw />Làm lại lần 2</Button>
          <Button variant="outline" className={cn(big, "border-2 bg-white")} onClick={(e) => go(e, () => viewResult(a))}><Trophy />Xem kết quả</Button>
        </div>
      ) : (
        <Button className={cn(big, "bg-emerald-600 hover:bg-emerald-700")} onClick={(e) => go(e, () => viewResult(a))}><Trophy />Xem kết quả</Button>
      )
    if (a.mode === "paper") return <Button className={big} onClick={(e) => go(e, () => open(a))}><Camera />Nộp bài giấy</Button>
    if (a.status === "in-progress")
      return <Button className={cn(big, "bg-amber-500 hover:bg-amber-600")} onClick={(e) => go(e, () => open(a))}><Play className="fill-current" />Làm tiếp</Button>
    return <Button className={big} onClick={(e) => go(e, () => open(a))}><Play className="fill-current" />Bắt đầu</Button>
  }

  return (
    <div className="flex flex-col gap-5 pb-16 text-lg">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Bài của em</h1>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-lg font-bold text-slate-700">
            Tuần này: <span className="text-indigo-600">{weekDone}/{weekTotal}</span> bài đã xong {weekTotal > 0 && weekDone === weekTotal && "🎉"}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={weekDone} aria-valuemax={weekTotal}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${weekTotal ? (weekDone / weekTotal) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="tablist" aria-label="Trạng thái bài" className="inline-flex min-w-full gap-1 rounded-2xl bg-slate-100 p-1.5 md:min-w-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => { if (tab !== t.id) play("tap"); setTab(t.id) }}
              className={cn("relative h-12 flex-1 shrink-0 rounded-xl px-4 text-base font-extrabold whitespace-nowrap transition-colors", tab === t.id ? "text-indigo-700" : "text-slate-500")}
            >
              {tab === t.id && (
                <motion.span layoutId="my-tab-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={reduced ? { duration: 0 } : spring} />
              )}
              <span className="relative">{t.label} ({counts[t.id]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subject chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Lọc theo môn">
        <button type="button" aria-pressed={subject === "all"} onClick={() => { play("tap"); setSubject("all") }} className={cn("h-12 shrink-0 rounded-full border-2 px-5 text-base font-bold", subject === "all" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600")}>
          Tất cả
        </button>
        {SUBJECT_LIST.map((s) => (
          <button key={s.id} type="button" aria-pressed={subject === s.id} onClick={() => { play("tap"); setSubject(s.id) }} className={cn("inline-flex h-12 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-base font-bold", subject === s.id ? cn(s.bg, "border-transparent text-white") : cn("bg-white", s.border, s.text))}>
            <s.icon className="size-5" />
            {s.name}
          </button>
        ))}
      </div>

      {/* List */}
      <LayoutGroup>
      <AnimatePresence mode="popLayout" initial={false}>
      {groups.length === 0 ? (
        <motion.div key={`empty-${tab}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring} className="flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <motion.span initial={reduced ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.1 }} className="flex size-24 items-center justify-center rounded-full bg-indigo-50 text-6xl" aria-hidden>{EMPTY[tab].emoji}</motion.span>
          <p className="text-2xl font-extrabold text-slate-800">{EMPTY[tab].title}</p>
          <p className="text-lg text-slate-500">{EMPTY[tab].text}</p>
        </motion.div>
      ) : (
        groups.map((g) => (
          <motion.section key={`${tab}-${g.key}`} layout={!reduced} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className="space-y-3">
            <h2 className={cn("sticky top-16 z-10 -mx-1 rounded-2xl px-4 py-2 text-lg font-extrabold backdrop-blur", g.late ? "bg-red-50/95 text-red-600" : "bg-slate-50/95 text-slate-700")}>
              {g.late && "⏰ "}{g.label} <span className="text-base font-bold opacity-60">· {g.items.length} bài</span>
            </h2>
            <motion.div className="grid gap-4 md:grid-cols-2" initial="initial" animate="animate" variants={{ animate: { transition: { staggerChildren: 0.04 } } }}>
              <AnimatePresence mode="popLayout">
              {g.items.map((a) => {
                const s = SUBJECTS[a.subject]
                const due = { text: a.dueText, late: a.late }
                return (
                  <motion.article
                    key={a.id}
                    layout={!reduced}
                    variants={due.late && !reduced ? lateVariants : listItem(reduced)}
                    exit="exit"
                    {...pressable(reduced)}
                    onClick={() => { play("tap"); open(a) }}
                    className={cn("relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-[28px] border-2 bg-white p-5 pl-7", due.late ? "border-red-200" : s.border)}
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-2", s.bg)} aria-hidden />
                    <div className="flex items-start gap-4">
                      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm", s.bg)}>
                        <s.icon className="size-7" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                          <span className={s.text}>{s.name}</span>
                          <span className={cn("rounded-full px-2.5 py-0.5", a.attempt === 2 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600")}>Lần {a.attempt}</span>
                          <span className="text-slate-500">{a.mode === "web" ? "💻 Làm trên web" : "📄 Làm trên giấy"}</span>
                          {a.timeLimit && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">⏱ {a.timeLimit} phút</span>}
                          <OfflineChip assignmentId={a.id} mode={a.mode} />
                        </div>
                        <h3 className="text-xl leading-snug font-extrabold text-slate-900">{a.title}</h3>
                        <p className="text-base text-slate-600">{a.questions} câu · {a.timeLimit ? `làm trong ${a.timeLimit} phút` : `khoảng ${a.minutes} phút`}</p>
                        {a.status !== "graded" && (
                          <p className={cn("text-base font-bold", due.late ? "text-red-600" : "text-slate-500")}>{due.late ? "⏰ " : ""}{due.text}</p>
                        )}
                      </div>
                      {a.score !== undefined && (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={cn("rounded-2xl px-3 py-1.5 text-xl font-black tabular-nums", scoreBadge(a.score))}>
                            {fmtScore(a.score)}<span className="text-sm font-bold opacity-70">/10</span>
                          </span>
                          <span className="text-sm" aria-label={`${starsFor(a.score)} sao`}>{"⭐".repeat(starsFor(a.score))}</span>
                        </div>
                      )}
                    </div>
                    {a.status === "in-progress" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm font-semibold text-slate-500"><span>Em đã làm</span><span>{a.progress ?? 0}%</span></div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", s.bg)} style={{ width: `${a.progress ?? 0}%` }} /></div>
                      </div>
                    )}
                    <div className="mt-auto">{action(a)}</div>
                  </motion.article>
                )
              })}
              </AnimatePresence>
            </motion.div>
          </motion.section>
        ))
      )}
      </AnimatePresence>
      </LayoutGroup>
    </div>
  )
}
