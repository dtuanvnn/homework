"use client"

import { useCallback, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Monitor,
  Plus,
  Printer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import AssignSheet from "@/components/schedule/AssignSheet"
import EditAssignmentSheet from "@/components/schedule/EditAssignmentSheet"
import PrintableExercise from "@/components/schedule/PrintableExercise"
import { useLibrary } from "@/state/library-store"
import { useStudent } from "@/components/layout/AppFrame"
import { addDays, startOfWeek } from "@/lib/dates"
import { DAY_LABELS, DAY_SHORT, dateInput, shortDate, timeLabel } from "@/lib/schedule"
import { SUBJECT_LIST, SUBJECTS, STATUSES } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { Assignment } from "@/lib/types"

export default function Schedule({ now }: { now: string }) {
  const library = useLibrary()
  const student = useStudent()
  const todayKey = dateInput(new Date(now))
  const [view, setView] = useState("week")
  const [date, setDate] = useState(() => new Date(now))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [printing, setPrinting] = useState<Assignment | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = library.assignments.find((a) => a.id === editingId)
  const finishPrint = useCallback(() => setPrinting(null), [])
  const days = Array.from({ length: 7 }, (_, i) =>
    addDays(startOfWeek(date), i),
  )
  const forDay = (day: Date) =>
    library.assignments
      .filter((a) => dateInput(new Date(a.assignedDate)) === dateInput(day))
      .sort(
        (a, b) =>
          a.assignedDate.localeCompare(b.assignedDate) ||
          a.dueDate.localeCompare(b.dueDate),
      )
  const total = (view === "week" ? days : [date]).reduce(
    (sum, day) => sum + forDay(day).length,
    0,
  )
  const printSet = printing ? library.getSet(printing.exerciseSetId) : undefined
  // Questions load lazily: the "In đề" click starts the fetch, printing waits for it.
  const printReady = printSet ? library.questionsLoaded(printSet.id) : false
  const startPrint = (assignment: Assignment) => {
    library.getQuestions(assignment.exerciseSetId)
    setPrinting(assignment)
  }

  const assignmentCard = (assignment: Assignment, compact = false) => {
    const set = library.getSet(assignment.exerciseSetId)
    const tone = set ? SUBJECTS[set.subject] : null
    const Mode = assignment.mode === "paper" ? FileText : Monitor
    return (
      <Card
        key={assignment.id}
        className={cn(
          "relative gap-2 p-3 shadow-none transition-shadow hover:shadow-md",
          tone?.softBg,
          tone?.border,
          !compact && "md:p-5",
        )}
      >
        {/* The whole card opens the editor; "In đề" sits above this layer. */}
        <button
          type="button"
          className="absolute inset-0 rounded-[inherit] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`Sửa bài giao: ${set?.title ?? "Bài tập"}`}
          onClick={() => setEditingId(assignment.id)}
        />
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold",
            tone?.text,
          )}
        >
          {tone && <tone.icon className="size-4 shrink-0" />}
          <span className={compact ? "md:sr-only" : undefined}>
            {tone?.name ?? "Bài tập"}
          </span>
          <Mode
            className="ml-auto size-4 shrink-0"
            aria-label={
              assignment.mode === "paper" ? "Làm trên giấy" : "Làm trên web"
            }
          />
        </div>
        <CardTitle
          className={cn(
            "break-words text-sm leading-relaxed",
            !compact && "md:text-base",
          )}
        >
          {set?.title ?? "Bộ bài đã bị xóa"}
        </CardTitle>
        <Badge
          variant="outline"
          className={cn(
            "w-fit max-w-full whitespace-normal text-xs",
            STATUSES[assignment.status].badge,
          )}
        >
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              STATUSES[assignment.status].dot,
            )}
          />
          {STATUSES[assignment.status].label}
        </Badge>
        {!compact && (
          <>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4" />
                Mở {timeLabel(assignment.assignedDate)}
              </span>
              <span>
                Hạn {timeLabel(assignment.dueDate)} ·{" "}
                {shortDate(new Date(assignment.dueDate))}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {assignment.mode === "paper" ? "Làm trên giấy" : "Làm trên web"} ·
              Tối đa {assignment.maxAttempts ?? 2} lần
            </p>
            {assignment.parentNote && (
              <p className="mt-1 rounded-lg bg-white/70 p-3 text-sm text-slate-600">
                “{assignment.parentNote}”
              </p>
            )}
          </>
        )}
        {assignment.mode === "paper" && set && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "relative w-fit px-0 text-slate-600",
              compact && "gap-1 text-xs",
            )}
            onClick={() => startPrint(assignment)}
          >
            {printing?.id === assignment.id && !printReady ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Printer className="size-3.5" />
            )}
            In đề
          </Button>
        )}
      </Card>
    )
  }
  const openAssign = (day?: Date) => {
    if (day) setDate(day)
    setSheetOpen(true)
  }
  const dayAgenda = () => {
    const items = forDay(date)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {dateInput(date) === todayKey ? "Hôm nay" : DAY_LABELS[(date.getDay() + 6) % 7]}
            </CardTitle>
            <p className="text-sm text-slate-500">
              {date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} · {items.length} bài
            </p>
          </div>
          {items.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => openAssign(date)}>
              <Plus />
              Thêm
            </Button>
          )}
        </div>
        {items.length ? (
          <ol className="relative space-y-4 border-l-2 border-indigo-100 pl-5 md:pl-8">
            {items.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-7 top-1 size-3 rounded-full border-2 border-white bg-indigo-500 md:-left-10" />
                <p className="mb-2 text-sm font-semibold tabular-nums text-slate-500">
                  {timeLabel(a.assignedDate)}
                </p>
                {assignmentCard(a)}
              </li>
            ))}
          </ol>
        ) : (
          <Card className="items-center gap-3 border-dashed py-10 text-center shadow-none">
            <div className="flex size-14 items-center justify-center rounded-full bg-indigo-50">
              <CalendarDays className="size-7 text-indigo-500" />
            </div>
            <CardTitle>Ngày trống, con học gì nhỉ?</CardTitle>
            <p className="max-w-xs text-sm text-slate-500">
              Thêm một bài nhẹ nhàng cho {student.name}, chỉ mất chưa đến một phút.
            </p>
            <Button className="rounded-full" onClick={() => openAssign(date)}>
              <Plus />
              Giao bài cho ngày này
            </Button>
          </Card>
        )}
      </div>
    )
  }

  const weekItems = days.flatMap(forDay)
  const stats = [
    { label: "Bài trong tuần", value: weekItems.length, tone: "text-indigo-700 bg-indigo-50" },
    { label: "Cần làm", value: weekItems.filter((a) => a.status === "chua-lam" || a.status === "dang-lam").length, tone: "text-amber-700 bg-amber-50" },
    { label: "Chờ chấm", value: weekItems.filter((a) => a.status === "cho-cham").length, tone: "text-violet-700 bg-violet-50" },
    { label: "Đã xong", value: weekItems.filter((a) => a.status === "da-cham").length, tone: "text-emerald-700 bg-emerald-50" },
  ]
  const selectedKey = dateInput(date)

  return (
    <div className="flex flex-col gap-5 pb-28 md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <CardTitle
            role="heading"
            aria-level={1}
            className="hidden text-3xl font-bold tracking-tight md:block"
          >
            Lịch giao bài
          </CardTitle>
          <p className="text-slate-500 md:mt-2">
            Một chút mỗi ngày, tiến bộ mỗi tuần.
          </p>
        </div>
        <Button size="lg" className="hidden rounded-xl md:inline-flex" onClick={() => openAssign()}>
          <Plus />
          Giao bài mới
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
        {stats.map((s) => (
          <div key={s.label} className={cn("rounded-2xl px-4 py-3", s.tone)}>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <Card className="gap-3 p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              aria-label="Tuần trước"
              onClick={() => setDate(addDays(date, -7))}
            >
              <ChevronLeft />
            </Button>
            <div className="min-w-28 text-center">
              <p className="text-sm font-semibold tabular-nums text-slate-800">
                {shortDate(days[0])} – {shortDate(days[6])}
              </p>
              <p className="text-xs text-slate-400">Năm {date.getFullYear()}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              aria-label="Tuần sau"
              onClick={() => setDate(addDays(date, 7))}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setDate(new Date(now))}>
              Hôm nay
            </Button>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v)}
              aria-label="Chế độ xem lịch"
              className="hidden md:flex"
            >
              <ToggleGroupItem value="week">Tuần</ToggleGroupItem>
              <ToggleGroupItem value="day">Ngày</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const items = forDay(day)
            const key = dateInput(day)
            const isToday = key === todayKey
            const selected = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDate(day)
                  setView("day")
                }}
                aria-pressed={selected}
                aria-label={`${DAY_LABELS[i]}, ${shortDate(day)}, ${items.length} bài`}
                className={cn(
                  "flex min-h-18 flex-col items-center gap-1 rounded-2xl py-2 transition-colors active:scale-95",
                  selected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : isToday
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className={cn("text-[11px] font-medium", !selected && "text-slate-400", isToday && !selected && "text-indigo-500")}>
                  {DAY_SHORT[i]}
                </span>
                <span className="text-base font-bold tabular-nums">{day.getDate()}</span>
                <span className="flex h-1.5 gap-0.5">
                  {items.slice(0, 3).map((a) => {
                    const set = library.getSet(a.exerciseSetId)
                    return (
                      <span
                        key={a.id}
                        className={cn("size-1.5 rounded-full", selected ? "bg-white" : set ? SUBJECTS[set.subject].bg : "bg-slate-300")}
                      />
                    )
                  })}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3">
          {SUBJECT_LIST.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn("size-2 rounded-full", s.bg)} />
              {s.name}
            </span>
          ))}
          <span className="ml-auto text-xs text-slate-400">{total} bài tập</span>
        </div>
      </Card>

      {view === "week" ? (
        <>
          {/* Mobile: agenda of the selected day; desktop: full week grid */}
          <div className="md:hidden">{dayAgenda()}</div>
          <div className="hidden md:grid md:grid-cols-7 md:overflow-hidden md:rounded-2xl md:border md:bg-white">
            {days.map((day, i) => {
              const items = forDay(day)
              const isToday = dateInput(day) === todayKey
              return (
                <section key={dateInput(day)} className={cn("group min-w-0 border-r border-slate-100 last:border-r-0", isToday && "bg-indigo-50/40")}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 py-3 hover:bg-slate-50"
                    onClick={() => {
                      setDate(day)
                      setView("day")
                    }}
                    aria-label={`Xem ${DAY_LABELS[i]}, ${shortDate(day)}`}
                  >
                    <span className={cn("text-xs text-slate-500", isToday && "font-semibold text-indigo-600")}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className={cn("flex size-8 items-center justify-center rounded-full text-sm font-semibold", isToday && "bg-indigo-600 text-white")}>
                      {day.getDate()}
                    </span>
                  </button>
                  <div className="flex min-h-80 flex-col gap-2 p-1.5">
                    {items.map((a) => assignmentCard(a, true))}
                    <button
                      type="button"
                      onClick={() => openAssign(day)}
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600",
                        items.length && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                    >
                      <Plus className="size-3.5" />
                      Thêm bài
                    </button>
                  </div>
                </section>
              )
            })}
          </div>
        </>
      ) : (
        dayAgenda()
      )}
      <Button
        size="lg"
        className="fixed right-4 bottom-24 z-30 h-14 rounded-full px-6 text-base shadow-xl shadow-indigo-300 md:hidden"
        onClick={() => openAssign()}
      >
        <Plus className="size-5" />
        Giao bài
      </Button>
      {sheetOpen && (
        <AssignSheet
          date={date}
          onClose={() => setSheetOpen(false)}
          onCreated={setDate}
        />
      )}
      {editing && (
        <EditAssignmentSheet
          key={editing.id}
          assignment={editing}
          onClose={() => setEditingId(null)}
          onSaved={setDate}
        />
      )}
      {printing && printSet && printReady && (
        <PrintableExercise
          set={printSet}
          questions={library.getQuestions(printSet.id)}
          note={printing.parentNote}
          onDone={finishPrint}
        />
      )}
    </div>
  )
}
