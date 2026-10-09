import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('inline-flex items-center rounded-xl bg-slate-100 p-1', className)}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-slate-500 transition-all outline-none hover:text-slate-900 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-white data-[state=on]:text-indigo-700 data-[state=on]:shadow-sm [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
