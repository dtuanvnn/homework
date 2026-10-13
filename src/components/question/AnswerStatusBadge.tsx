import { AlertTriangle, CircleDashed, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AnswerStatus } from '@/lib/types'

const STATUS: Record<AnswerStatus, { label: string; icon: typeof Sparkles; className: string }> = {
  missing: { label: 'Chưa có đáp án', icon: CircleDashed, className: 'border-slate-300 border-dashed bg-slate-50 text-slate-600' },
  ai: { label: 'AI giải', icon: Sparkles, className: 'border-violet-200 bg-violet-50 text-violet-700' },
  'ai-check': { label: 'AI giải · cần kiểm tra', icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-700' },
}

/** Where a question's answer key stands (nothing when the parent entered it or the document printed it). */
export default function AnswerStatusBadge({ status }: { status?: AnswerStatus }) {
  if (!status) return null
  const { label, icon: Icon, className } = STATUS[status]
  return (
    <Badge variant="outline" className={className}>
      <Icon />
      {label}
    </Badge>
  )
}
