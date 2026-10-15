'use client'

import { ChevronRight } from 'lucide-react'
import { useAppNavigation, useRequiredStudent } from '@/components/layout/AppFrame'
import { parentPaths } from '@/components/layout/routes'
import RedemptionRequests from '@/components/rewards/RedemptionRequests'
import SectionHeader from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import type { RewardSummary } from '@/lib/views/rewards'

export default function RewardsCard({ summary }: { summary: RewardSummary }) {
  const { navigate } = useAppNavigation()
  const student = useRequiredStudent()
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Phần thưởng"
        description={`${student.name} có ${summary.balance} sao · chuỗi ${summary.streak} ngày`}
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate(parentPaths.rewards)}>
            Quản lý
            <ChevronRight />
          </Button>
        }
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <RedemptionRequests items={summary.pending} studentName={student.name} />
      </div>
    </section>
  )
}
