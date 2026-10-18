import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StarCount({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-700',
        className,
      )}
    >
      <Star className="size-4 fill-amber-400 text-amber-400" />
      {count}
      <span className="sr-only">sao</span>
    </span>
  )
}
