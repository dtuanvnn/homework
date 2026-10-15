'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import InsightCard from '@/components/dashboard/InsightCard'
import KpiGrid from '@/components/dashboard/KpiGrid'
import QuickActions, { buildQuickActions } from '@/components/dashboard/QuickActions'
import RewardsCard from '@/components/dashboard/RewardsCard'
import SubjectScoreChart from '@/components/dashboard/SubjectScoreChart'
import TodayAssignmentList from '@/components/dashboard/TodayAssignmentList'
import { useAppNavigation, useRequiredStudent } from '@/components/layout/AppFrame'
import { TAB_PATHS } from '@/components/layout/routes'
import SectionHeader from '@/components/shared/SectionHeader'
import { formatVietnameseDate, getGreeting } from '@/lib/format'
import type { RewardSummary } from '@/lib/views/rewards'
import type { DashboardData } from '@/server/analytics'
import { useLibrary } from '@/state/library-store'

export default function ParentDashboard({ data, rewards }: { data: DashboardData; rewards: RewardSummary }) {
  const { navigate } = useAppNavigation()
  const student = useRequiredStudent()
  const { assignSet } = useLibrary()
  const [assignedInsights, setAssignedInsights] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  // Server time, so the greeting and date match between SSR and hydration.
  const now = new Date(data.now)

  const handleAssignPractice = async (insightId: string, practiceSetId: string, title?: string) => {
    setPending(insightId)
    const created = await assignSet(practiceSetId)
    setPending(null)
    if (!created) return
    setAssignedInsights((prev) => new Set(prev).add(insightId))
    toast.success('Đã giao bài luyện tập', {
      description: `${title ? `“${title}” · ` : ''}Hạn ${formatVietnameseDate(created.dueDate)}`,
    })
  }

  const quickActions = buildQuickActions({
    onAdd: () => navigate(TAB_PATHS.library),
    onAssign: () => navigate(TAB_PATHS.schedule),
    onReport: () => navigate(TAB_PATHS.reports),
  })

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{getGreeting(now)}</h1>
          <p className="mt-1 text-slate-500">Đây là tình hình học tập của {student.name} tuần này.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600">
          <CalendarDays className="size-4 text-indigo-600" aria-hidden />
          {formatVietnameseDate(now)}
        </div>
      </header>

      <KpiGrid
        summary={data.summary}
        average={data.average}
        previousAverage={data.previousAverage}
        overdueTitle={data.summary.overdueTitle}
        onOpenGrading={() => navigate(TAB_PATHS.grading)}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-6">
        <TodayAssignmentList
          className="lg:col-span-2"
          studentName={student.name}
          items={data.today}
          onOpenSchedule={() => navigate(TAB_PATHS.schedule)}
        />
        <SubjectScoreChart className="lg:col-span-3" points={data.chart} />
      </div>

      <RewardsCard summary={rewards} />

      <section className="flex flex-col gap-3">
        <SectionHeader title="Cần chú ý" description="Kỹ năng có tỉ lệ đúng thấp trong các bài gần đây" />
        {data.weakSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Chưa có kỹ năng nào đáng lo trong 6 tuần gần đây.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {data.weakSkills.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                assigned={assignedInsights.has(insight.id)}
                pending={pending === insight.id}
                onAssign={
                  insight.practiceSetId
                    ? () => handleAssignPractice(insight.id, insight.practiceSetId!, insight.practiceTitle)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <QuickActions actions={quickActions} />
    </div>
  )
}
