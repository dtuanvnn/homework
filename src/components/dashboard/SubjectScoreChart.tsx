import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"
import { Card } from '@/components/ui/card'
import SectionHeader from '@/components/shared/SectionHeader'
import { addDays } from '@/lib/dates'
import { formatDayMonth, formatScore, formatScoreValue } from '@/lib/format'
import { SUBJECT_LIST } from '@/lib/subjects'
import type { WeeklySubjectPoint } from '@/lib/stats'
import { cn } from '@/lib/utils'

interface ChartRow {
  label: string
  range: string
  toan?: number
  'tieng-viet'?: number
  'tieng-anh'?: number
}

function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ChartRow
  return (
    <div className="min-w-44 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <div className="mb-2 text-xs font-semibold text-slate-500">Tuần {row.range}</div>
      <ul className="flex flex-col gap-1.5">
        {SUBJECT_LIST.map((s) => {
          const v = row[s.id]
          return (
            <li key={s.id} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-slate-600">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">{v === undefined ? '–' : formatScore(v)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function SubjectScoreChart({ points, className }: { points: WeeklySubjectPoint[]; className?: string }) {
  const data: ChartRow[] = points.map((p) => ({
    label: formatDayMonth(p.weekStart),
    range: `${formatDayMonth(p.weekStart)} – ${formatDayMonth(addDays(p.weekStart, 6))}`,
    toan: p.toan,
    'tieng-viet': p['tieng-viet'],
    'tieng-anh': p['tieng-anh'],
  }))
  const latest = data[data.length - 1]

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <SectionHeader title="Điểm theo môn" description="Điểm trung bình mỗi tuần · 6 tuần gần nhất" />
      <Card className="flex-1 gap-4 p-4 md:p-5">
        <ul className="flex flex-wrap gap-2" aria-label="Chú thích">
          {SUBJECT_LIST.map((s) => {
            const Icon = s.icon
            const v = latest?.[s.id]
            return (
              <li key={s.id} className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm', s.softBg)}>
                <Icon className={cn('size-4', s.text)} aria-hidden />
                <span className="font-medium text-slate-700">{s.name}</span>
                {v !== undefined && <span className={cn('font-bold tabular-nums', s.text)}>{formatScoreValue(v)}</span>}
              </li>
            )
          })}
        </ul>
        <div className="h-60 w-full md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={8} />
              <YAxis
                domain={[5, 10]}
                ticks={[5, 6, 7, 8, 9, 10]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip content={ChartTooltip} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
              {SUBJECT_LIST.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 5.5, strokeWidth: 0, fill: s.color }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  )
}
