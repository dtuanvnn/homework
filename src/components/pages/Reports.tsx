"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { toast } from "sonner"
import { useRequiredStudent } from "@/components/layout/AppFrame"
import { buildReport, rangePeriod, summarize, type RangeId, type ReportInput } from "@/lib/analytics"
import { addDays } from "@/lib/dates"
import { formatDayMonth, formatShortDate, formatTime, formatVietnameseDate } from "@/lib/format"
import { unwrap } from "@/lib/action-result"
import type { AiSummary } from "@/lib/ai/summary"
import { summarizeProgress } from "@/server/actions/ai-summary"
import { dateInput } from "@/lib/schedule"
import { SUBJECT_LIST, SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { SubjectId } from "@/lib/types"
import { useLibrary } from "@/state/library-store"
import { schoolYearLabel, type Enrollment } from "@/lib/school-year"
import { yearCustomRange } from "@/lib/report-years"

const fmt = (n: number, digits = 1) =>
  n.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits })

const RANGES: { id: RangeId; label: string }[] = [
  { id: "4w", label: "4 tuần" },
  { id: "3m", label: "3 tháng" },
  { id: "hk", label: "Học kỳ" },
  { id: "custom", label: "Tùy chọn" },
]

/** "+1,5" / "−0,5" / "±0" */
const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmt(Math.abs(n), digits)}`

const deltaOf = (cur: number | null, prev: number | null) => (cur !== null && prev !== null ? cur - prev : null)

/** Lowest y-axis value: 5 unless some score falls below it. */
const scoreFloor = (values: (number | undefined)[]) => (values.some((v) => v !== undefined && v < 5) ? 0 : 5)

const skillColor = (v: number) => (v < 60 ? "#ef4444" : v <= 80 ? "#f59e0b" : "#10b981")

function Section({ title, description, className, children, action }: { title: string; description?: string; className?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className={cn("gap-4 p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function ChartTooltip({ active, payload, label, suffix = "" }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string | number }[]; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label && <p className="mb-1 font-semibold text-slate-700">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}
          <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-900">
            {typeof p.value === "number" ? p.value.toLocaleString("vi-VN") : p.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function Reports({ input, years, now: nowIso }: { input: ReportInput; years: Enrollment[]; now: string }) {
  const student = useRequiredStudent()
  const { assignSet: quickAssign } = useLibrary()
  const now = useMemo(() => new Date(nowIso), [nowIso])
  const [range, setRange] = useState<RangeId>("4w")
  const [subjects, setSubjects] = useState<SubjectId[]>(SUBJECT_LIST.map((s) => s.id))
  const [from, setFrom] = useState(() => dateInput(addDays(now, -55)))
  const [to, setTo] = useState(() => dateInput(now))
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  /** The AI review and the filters it was made for; shown only while those filters stay selected. */
  const [aiReview, setAiReview] = useState<{ key: string; data: AiSummary } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  const today = dateInput(now)
  const yearChips = [...years].reverse().map((y) => ({ year: y.schoolYear, range: yearCustomRange(years, y.schoolYear, today)! }))
  const pickYear = (r: { from: string; to: string }) => {
    setRange("custom")
    setFrom(r.from)
    setTo(r.to)
  }

  const period = useMemo(
    () => rangePeriod(range, now, range === "custom" && from && to ? { from, to } : undefined),
    [range, now, from, to],
  )
  const report = useMemo(() => buildReport(input, period, now, subjects), [input, period, now, subjects])
  const review = useMemo(() => summarize(report, student.name), [report, student.name])
  const custom = range === "custom" && from && to ? { from, to } : undefined
  const filterKey = JSON.stringify([range, custom ?? null, [...subjects].sort()])
  const ai = aiReview?.key === filterKey ? aiReview.data : null

  const generateAiReview = async () => {
    setAiBusy(true)
    try {
      const data = unwrap(await summarizeProgress({ rangeId: range, subjects, custom }))
      setAiReview({ key: filterKey, data })
    } catch (e) {
      toast.error("Chưa tạo được nhận xét bằng AI", { description: e instanceof Error ? e.message : "Vui lòng thử lại." })
    } finally {
      setAiBusy(false)
    }
  }
  const active = SUBJECT_LIST.filter((s) => subjects.includes(s.id))
  const kpi = report.kpis
  const prev = report.previous

  const trend = report.weekly.map((w) => ({
    week: formatDayMonth(w.weekStart),
    toan: w.toan,
    "tieng-viet": w["tieng-viet"],
    "tieng-anh": w["tieng-anh"],
  }))
  const trendFloor = scoreFloor(report.weekly.flatMap((w) => active.map((s) => w[s.id])))
  const averages = active
    .filter((s) => report.subjectAverages[s.id] !== undefined)
    .map((s) => ({ name: s.name, id: s.id, color: s.color, value: report.subjectAverages[s.id]! }))
  const skills = report.skills
  const retries = report.retries.slice(0, 6)
  const heat = report.activity
  const activeDays = heat.flat().filter((d) => d.count > 0).length
  const pastDays = heat.flat().filter((d) => d.count >= 0).length

  const toggleSubject = (id: SubjectId) =>
    setSubjects((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((s) => s !== id) : cur) : [...cur, id]))

  const handleAssign = async (setId: string) => {
    setAssigning(setId)
    const created = await quickAssign(setId)
    setAssigning(null)
    if (!created) return
    setAssigned((cur) => new Set(cur).add(setId))
    const title = input.sets.find((s) => s.id === setId)?.title
    toast.success("Đã giao bài luyện tập", {
      description: `${title ? `“${title}” · ` : ""}Hạn ${formatVietnameseDate(created.dueDate)}`,
    })
  }

  const kpis: { label: string; value: string; unit?: string; delta: number | null; deltaText: (d: number) => string; icon: typeof Star; tone: string }[] = [
    { label: "Bài đã hoàn thành", value: String(kpi.completed), delta: kpi.completed - prev.completed, deltaText: (d) => `${signed(d, 0)} bài`, icon: CheckCircle2, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Điểm trung bình", value: kpi.average === null ? "–" : fmt(kpi.average), delta: deltaOf(kpi.average, prev.average), deltaText: (d) => `${signed(d)} điểm`, icon: Star, tone: "bg-amber-50 text-amber-600" },
    { label: "Tỷ lệ đúng hạn", value: kpi.onTime === null ? "–" : `${kpi.onTime}%`, delta: deltaOf(kpi.onTime, prev.onTime), deltaText: (d) => `${signed(d, 0)}%`, icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Cải thiện lần 2", value: kpi.retryGain === null ? "–" : signed(kpi.retryGain), unit: kpi.retryGain === null ? undefined : "điểm", delta: deltaOf(kpi.retryGain, prev.retryGain), deltaText: (d) => `${signed(d)} điểm`, icon: RotateCcw, tone: "bg-violet-50 text-violet-600" },
  ]

  return (
    <div className="flex flex-col gap-5 pb-16">
      <div>
        <h1 className="hidden text-3xl font-bold tracking-tight text-slate-900 md:block">Báo cáo</h1>
        <p className="text-slate-500 md:mt-1.5">Theo dõi sự tiến bộ của {student.name} qua từng tuần.</p>
      </div>

      {/* Filters */}
      <Card className="gap-3 p-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:p-4">
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => v && setRange(v as RangeId)}
          aria-label="Khoảng thời gian"
          className="w-full md:w-auto"
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r.id} value={r.id} className="flex-1 px-3 md:flex-none">
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {years.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Năm học</span>
            {yearChips.map(({ year, range: r }) => {
              const selected = range === "custom" && from === r.from && to === r.to
              return (
                <button key={year} type="button" aria-pressed={selected} onClick={() => pickYear(r)}
                  className={cn("rounded-full border px-3 py-1 text-sm", selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")}>
                  {schoolYearLabel(year)}
                </button>
              )
            })}
          </div>
        )}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Lọc theo môn">
          {SUBJECT_LIST.map((s) => {
            const on = subjects.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSubject(s.id)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  on ? cn(s.softBg, s.border, s.text) : "border-slate-200 bg-white text-slate-400",
                )}
              >
                <s.icon className="size-4" />
                {s.name}
              </button>
            )
          })}
        </div>
        {range === "custom" && (
          <div className="flex w-full items-center gap-2 border-t pt-3">
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày" className="h-10" />
            <span className="text-slate-400">–</span>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày" className="h-10" />
          </div>
        )}
      </Card>

      {/* 1. KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="gap-3 p-4">
            <div className={cn("flex size-9 items-center justify-center rounded-xl", k.tone)}>
              <k.icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900 md:text-3xl">
                {k.value}
                {k.unit && <span className="ml-1 text-sm font-medium text-slate-400">{k.unit}</span>}
              </p>
              <p className="text-sm text-slate-500">{k.label}</p>
            </div>
            {k.delta === null ? (
              <p className="text-xs font-medium text-slate-400">Chưa có dữ liệu kỳ trước</p>
            ) : (
              <p
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  k.delta > 0 ? "text-emerald-600" : k.delta < 0 ? "text-red-600" : "text-slate-500",
                )}
              >
                {k.delta < 0 ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                {k.deltaText(k.delta)} so với kỳ trước
              </p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2. Trend */}
        <Section title="Xu hướng điểm" description="Điểm trung bình mỗi tuần theo môn (thang 10)" className="lg:col-span-2">
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  {active.map((s) => (
                    <linearGradient key={s.id} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} minTickGap={16} />
                <YAxis domain={[trendFloor, 10]} ticks={trendFloor === 0 ? [0, 2, 4, 6, 8, 10] : [5, 6, 7, 8, 9, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#c7d2fe", strokeDasharray: 4 }} labelFormatter={(l) => `Tuần ${l}`} />
                {active.map((s) => (
                  <Area key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2.5} fill={`url(#grad-${s.id})`} dot={false} connectNulls activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4">
            {active.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-1 w-4 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </Section>

        {/* 3. Subject averages */}
        <Section title="Điểm theo môn" description="Trung bình trong kỳ">
          <div className="h-56 lg:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={averages} margin={{ top: 24, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" name="Điểm TB" radius={[10, 10, 4, 4]} maxBarSize={56}>
                  {averages.map((a) => <Cell key={a.id} fill={a.color} />)}
                  <LabelList dataKey="value" position="top" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 13, fontWeight: 700, fill: "#0f172a" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* 4. Skills */}
        <Section
          title="Kỹ năng"
          description="Tỷ lệ đúng theo kỹ năng, yếu nhất ở trên"
          className="lg:col-span-2"
          action={
            <div className="hidden gap-3 text-xs text-slate-500 sm:flex">
              {[["#ef4444", "< 60%"], ["#f59e0b", "60–80%"], ["#10b981", "> 80%"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: c }} />{l}</span>
              ))}
            </div>
          }
        >
          <div style={{ height: Math.max(skills.length * 44, 120) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skills} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap={10}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="skill" width={128} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#334155" }} />
                <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="accuracy" name="Tỷ lệ đúng" radius={[0, 8, 8, 0]} background={{ fill: "#f1f5f9", radius: 8 }}>
                  {skills.map((s) => <Cell key={`${s.subject}|${s.skill}`} fill={skillColor(s.accuracy)} />)}
                  <LabelList dataKey="accuracy" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 12, fontWeight: 600, fill: "#334155" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* 5. Dumbbell */}
        <Section title="Lần 1 → Lần 2" description="Điểm cải thiện sau khi làm lại">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-slate-300 bg-white" />Lần 1</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-indigo-500" />Lần 2</span>
          </div>
          <ul className="space-y-3.5">
            {retries.map((r) => {
              const color = SUBJECTS[r.subject].color
              const pos = (v: number) => `${(Math.max(0, Math.min(10, v)) / 10) * 100}%`
              const gain = r.second - r.first
              return (
                <li key={r.assignmentId}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{r.title}</span>
                    <span className={cn("shrink-0 font-semibold tabular-nums", gain > 0 ? "text-emerald-600" : gain < 0 ? "text-red-600" : "text-slate-500")}>{signed(gain)}</span>
                  </div>
                  <div className="relative h-3" aria-label={`${r.title}: lần 1 ${fmt(r.first)}, lần 2 ${fmt(r.second)}`}>
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-100" />
                    <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full opacity-40" style={{ left: pos(Math.min(r.first, r.second)), width: `calc(${pos(Math.max(r.first, r.second))} - ${pos(Math.min(r.first, r.second))})`, background: color }} />
                    <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white" style={{ left: pos(r.first), borderColor: color }} />
                    <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: pos(r.second), background: color }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-400">
                    <span>{fmt(r.first)}</span>
                    <span>{fmt(r.second)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
          {retries.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Chưa có bài làm lại trong kỳ này.</p>}
        </Section>

        {/* 6. Habits */}
        <Section title="Thói quen làm bài" description={`${activeDays}/${pastDays} ngày có bài hoàn thành`} className="lg:col-span-2">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <div className="grid shrink-0 grid-rows-7 gap-1 pt-0 text-[10px] leading-none text-slate-400">
              {["T2", "", "T4", "", "T6", "", "CN"].map((d, i) => <span key={i} className="flex h-4 items-center md:h-5">{d}</span>)}
            </div>
            <div className="flex gap-1">
              {heat.map((week, w) => (
                <div key={w} className="grid grid-rows-7 gap-1">
                  {week.map(({ date, count }) => (
                    <span
                      key={date}
                      title={count < 0 ? "" : `${formatShortDate(date)}: ${count} bài`}
                      className={cn(
                        "size-4 rounded-[4px] md:size-5",
                        count < 0 ? "bg-transparent" : ["bg-slate-100", "bg-indigo-200", "bg-indigo-400", "bg-indigo-600"][Math.min(count, 3)],
                        dateInput(new Date(date)) === dateInput(now) && "ring-2 ring-indigo-600 ring-offset-1",
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              Ít
              {["bg-slate-100", "bg-indigo-200", "bg-indigo-400", "bg-indigo-600"].map((c) => <span key={c} className={cn("size-3 rounded-[3px]", c)} />)}
              Nhiều
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-sm text-slate-500"><Clock3 className="size-4" />TB mỗi bài:</span>
              {active.map((s) => (
                <span key={s.id} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", s.softBg, s.text)}>
                  {s.name} {report.minutes[s.id] ?? "–"} phút
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* 7. AI */}
        <Card className="gap-4 border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 md:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><Sparkles className="size-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900 md:text-lg">{ai ? "Nhận xét của AI" : "Nhận xét tự động"}</h2>
              <p className="text-xs text-slate-500">
                {ai
                  ? `Tạo lúc ${formatTime(ai.generatedAt)}, ${formatShortDate(ai.generatedAt)}`
                  : `Tổng hợp từ kết quả đến ${formatShortDate(now)}`}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-700" aria-live="polite">{ai ? ai.summary : review.summary}</p>
          <ol className="space-y-2">
            {(ai
              ? ai.steps.map((s) => ({ text: s.text, detail: s.detail, subject: s.subject, setId: s.setId ?? undefined }))
              : review.steps
            ).map((step, i) => {
              const tone = step.subject ? cn(SUBJECTS[step.subject].softBg, SUBJECTS[step.subject].text) : "bg-indigo-50 text-indigo-700"
              const done = step.setId !== undefined && assigned.has(step.setId)
              return (
                <li key={`${i}|${step.text}`} className="flex items-center gap-3 rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", tone)}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-slate-800">{step.text}</p>
                    <p className="text-xs text-slate-500">{step.detail}</p>
                  </div>
                  {step.setId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 rounded-full border-indigo-200 text-indigo-700"
                      disabled={done || assigning !== null}
                      onClick={() => handleAssign(step.setId!)}
                    >
                      {done ? <Check /> : assigning === step.setId ? <Loader2 className="animate-spin" /> : <Plus />}
                      {done ? "Đã giao" : "Giao bài"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-2 border-t border-indigo-100 pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-full border-indigo-200 bg-white text-indigo-700"
              disabled={aiBusy || kpi.completed === 0}
              onClick={generateAiReview}
            >
              {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {aiBusy ? "AI đang viết nhận xét…" : ai ? "Tạo lại bằng AI" : "Tạo nhận xét bằng AI"}
            </Button>
            {ai && !aiBusy && (
              <Button size="sm" variant="ghost" className="h-10 rounded-full text-slate-500" onClick={() => setAiReview(null)}>
                Xem nhận xét tự động
              </Button>
            )}
            {aiBusy && <span className="text-xs text-slate-500">Thường mất dưới 1 phút.</span>}
          </div>
        </Card>
      </div>
    </div>
  )
}
