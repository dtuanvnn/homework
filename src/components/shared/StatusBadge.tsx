import { Badge } from '@/components/ui/badge'
import { STATUSES } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { AssignmentStatus } from '@/lib/types'

export default function StatusBadge({ status, className }: { status: AssignmentStatus; className?: string }) {
  const s = STATUSES[status]
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-semibold', s.badge, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </Badge>
  )
}
