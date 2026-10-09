import { SUBJECTS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { SubjectId } from '@/lib/types'

interface SubjectIconProps {
  subject: SubjectId
  size?: 'sm' | 'md'
  className?: string
}

export default function SubjectIcon({ subject, size = 'md', className }: SubjectIconProps) {
  const s = SUBJECTS[subject]
  const Icon = s.icon
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        size === 'md' ? 'size-10 rounded-xl' : 'size-8 rounded-lg',
        s.softBg,
        s.text,
        className,
      )}
      aria-hidden
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-4'} />
    </span>
  )
}
