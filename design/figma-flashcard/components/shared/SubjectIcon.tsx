import { Layers } from 'lucide-react'
import { SUBJECTS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { SubjectId } from '@/lib/types'

interface SubjectIconProps {
  subject: SubjectId
  size?: 'sm' | 'md'
  flashcard?: boolean
  className?: string
}

export default function SubjectIcon({ subject, size = 'md', flashcard = false, className }: SubjectIconProps) {
  const s = SUBJECTS[subject]
  const Icon = s.icon
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center',
        size === 'md' ? 'size-10 rounded-xl' : 'size-8 rounded-lg',
        s.softBg,
        s.text,
        className,
      )}
      aria-hidden
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-4'} />
      {flashcard && (
        <span
          className={cn(
            'absolute -right-1.5 -bottom-1.5 flex items-center justify-center rounded-md bg-green-500 text-white ring-2 ring-white',
            size === 'md' ? 'size-5' : 'size-4',
          )}
        >
          <Layers className={size === 'md' ? 'size-3' : 'size-2.5'} />
        </span>
      )}
    </span>
  )
}
