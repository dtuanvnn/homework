import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import InsightCard from '@/components/dashboard/InsightCard'
import KpiGrid from '@/components/dashboard/KpiGrid'
import QuickActions, { buildQuickActions } from '@/components/dashboard/QuickActions'
import SubjectScoreChart from '@/components/dashboard/SubjectScoreChart'
import TodayAssignmentList from '@/components/dashboard/TodayAssignmentList'
import SectionHeader from '@/components/shared/SectionHeader'
import type { ParentTabId } from '@/components/layout/nav-config'
import { TODAY, WEEK_START, assignments, attempts, getExerciseSet, skillInsights, student } from '@/data/mock-data'
import { addDays } from '@/lib/dates'
import { formatVietnameseDate, getGreeting } from '@/lib/format'
import { getAssignmentsDueOn, summarizeAssignments, weekAverage, weeklySubjectAverages } from '@/lib/stats'

interface ParentDashboardProps {
  onNavigate: (tab: ParentTabId) => void
}

export default function ParentDashboard({ onNavigate }: ParentDashboardProps) {
  const [assignedInsights, setAssignedInsights] = useState<Set<string>>(new Set())

  const data = useMemo(() => {
    const summary = summarizeAssignments(assignments)
    const overdue = assignments.find((a) => a.status === 'tre-han')
    return {
      summary,
      overdueTitle: overdue ? getExerciseSet(overdue.exerciseSetId).title : undefined,
      average: weekAverage(attempts, WEEK_START),
      previousAverage: weekAverage(attempts, addDays(WEEK_START, -7)),
      today: getAssignmentsDueOn(assignments, TODAY),
      chart: weeklySubjectAverages(attempts, WEEK_START, 6),
    }
  }, [])

  const handleAssignPractice = (insightId: string, practiceSetId: string) => {
    const set = getExerciseSet(practiceSetId)
    setAssignedInsights((prev) => new Set(prev).add(insightId))
    toast.success('Đã giao bài luyện tập', {
      description: `“${set.title}” · Hạn ${formatVietnameseDate(addDays(TODAY, 1))}`,
    })
  }

  const quickActions = buildQuickActions({
    onAdd: () => onNavigate('library'),
    onAssign: () => onNavigate('schedule'),
    onReport: () => onNavigate('reports'),
  })

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{getGreeting()}</h1>
          <p className="mt-1 text-slate-500">Đây là tình hình học tập của {student.name} tuần này.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600">
          <CalendarDays className="size-4 text-indigo-600" aria-hidden />
          {formatVietnameseDate(TODAY)}
        </div>
      </header>

      <KpiGrid
        summary={data.summary}
        average={data.average}
        previousAverage={data.previousAverage}
        overdueTitle={data.overdueTitle}
        onOpenGrading={() => onNavigate('grading')}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-6">
        <TodayAssignmentList
          className="lg:col-span-2"
          studentName={student.name}
          items={data.today}
          onOpenSchedule={() => onNavigate('schedule')}
        />
        <SubjectScoreChart className="lg:col-span-3" points={data.chart} />
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Cần chú ý" description="Kỹ năng có tỉ lệ đúng thấp trong các bài gần đây" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {skillInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              assigned={assignedInsights.has(insight.id)}
              onAssign={() => handleAssignPractice(insight.id, insight.practiceSetId)}
            />
          ))}
        </div>
      </section>

      <QuickActions actions={quickActions} />
    </div>
  )
}
