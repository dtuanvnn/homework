import { Backpack, Users } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/lib/types'
import { MODE_LABELS } from './nav-config'

const MODE_ICONS = { parent: Users, student: Backpack } as const

interface ModeToggleProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  /** compact: phone app bar, full: expanded sidebar, stacked: collapsed sidebar (icons only). */
  variant?: 'compact' | 'full' | 'stacked'
  className?: string
}

export default function ModeToggle({ mode, onModeChange, variant = 'full', className }: ModeToggleProps) {
  const modes: AppMode[] = ['parent', 'student']
  const stacked = variant === 'stacked'

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(value) => value && onModeChange(value as AppMode)}
      aria-label="Chọn chế độ"
      className={cn(
        stacked && 'flex-col gap-1',
        variant === 'full' && 'w-full',
        // Phone app bar uses fixed px sizes so student mode's larger base text can't overflow 390px.
        variant === 'compact' && 'h-[44px] p-[4px]',
        className,
      )}
    >
      {modes.map((m) => {
        const Icon = MODE_ICONS[m]
        const item = (
          <ToggleGroupItem
            key={m}
            value={m}
            aria-label={MODE_LABELS[m]}
            className={cn(
              variant === 'full' && 'min-h-10',
              variant === 'compact' && 'h-[36px] min-h-0 gap-[5px] px-[10px] text-[13px] [&_svg]:size-[15px]',
              stacked && 'size-11 min-h-0 px-0',
            )}
          >
            <Icon />
            {!stacked && <span>{MODE_LABELS[m]}</span>}
          </ToggleGroupItem>
        )
        if (!stacked) return item
        return (
          <Tooltip key={m}>
            <TooltipTrigger asChild>{item}</TooltipTrigger>
            <TooltipContent side="right">Chế độ {MODE_LABELS[m]}</TooltipContent>
          </Tooltip>
        )
      })}
    </ToggleGroup>
  )
}
