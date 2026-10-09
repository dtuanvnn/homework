import { Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import SubjectIcon from '@/components/shared/SubjectIcon'
import { SUBJECTS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { SkillInsight } from '@/lib/types'

interface InsightCardProps {
  insight: SkillInsight
  assigned: boolean
  onAssign: () => void
}

export default function InsightCard({ insight, assigned, onAssign }: InsightCardProps) {
  const subject = SUBJECTS[insight.subject]
  const weak = insight.accuracy < 60

  return (
    <Card className="relative gap-4 overflow-hidden p-4 md:p-5">
      <div className={cn('absolute inset-x-0 top-0 h-1', subject.bg)} aria-hidden />
      <div className="flex items-start gap-3">
        <SubjectIcon subject={insight.subject} size="sm" />
        <div className="min-w-0">
          <div className={cn('text-xs font-semibold', subject.text)}>{subject.name}</div>
          <div className="leading-snug font-semibold text-slate-900">{insight.skill}</div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-2xl font-bold tabular-nums', weak ? 'text-red-600' : 'text-amber-600')}>
            {insight.accuracy}%
          </span>
          <span className="text-sm text-slate-500">đúng</span>
        </div>
        <Progress
          value={insight.accuracy}
          className="mt-2"
          indicatorClassName={weak ? 'bg-red-500' : 'bg-amber-500'}
          aria-label={`${insight.accuracy}% đúng`}
        />
        <p className="mt-2 text-xs text-slate-500">
          Sai {insight.wrongCount}/{insight.totalCount} câu trong {insight.recentAttempts} bài gần nhất
        </p>
      </div>

      <Button
        variant={assigned ? 'secondary' : 'outline'}
        className={cn('mt-auto w-full', assigned && 'text-emerald-700')}
        onClick={onAssign}
        disabled={assigned}
      >
        {assigned ? <Check /> : <Send />}
        {assigned ? 'Đã giao bài' : 'Giao bài luyện tập'}
      </Button>
    </Card>
  )
}
