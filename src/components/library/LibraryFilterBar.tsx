import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL, FILTER_DEFS, countActiveFilters, type FilterDef, type LibraryFilters } from '@/lib/library'
import { cn } from '@/lib/utils'

interface LibraryFilterBarProps {
  filters: LibraryFilters
  onChange: (key: keyof LibraryFilters, value: string) => void
  onReset: () => void
}

function optionLabel(def: FilterDef, value: string) {
  return def.options.find((o) => o.value === value)?.label ?? ''
}

/** Phone: horizontally scrolling chips, each opening a radio menu. */
function FilterChips({ filters, onChange, onReset }: LibraryFilterBarProps) {
  const activeCount = countActiveFilters(filters)
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden" role="toolbar" aria-label="Bộ lọc">
      {FILTER_DEFS.map((def) => {
        const value = filters[def.key]
        const active = value !== ALL
        return (
          <DropdownMenu key={def.key}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {active ? `${def.label}: ${optionLabel(def, value)}` : def.label}
                <ChevronDown className="size-4 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{def.label}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(def.key, v)}>
                {def.options.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          <X className="size-4" />
          Xóa lọc
        </button>
      )}
    </div>
  )
}

/** iPad: a wrapping row of Selects. */
function FilterSelects({ filters, onChange, onReset }: LibraryFilterBarProps) {
  const activeCount = countActiveFilters(filters)
  return (
    <div className="hidden flex-wrap items-center gap-2 md:flex" role="toolbar" aria-label="Bộ lọc">
      {FILTER_DEFS.map((def) => {
        const active = filters[def.key] !== ALL
        return (
          <Select key={def.key} value={filters[def.key]} onValueChange={(v) => onChange(def.key, v)}>
            <SelectTrigger
              aria-label={def.label}
              className={cn('min-w-32', active && 'border-indigo-300 bg-indigo-50 text-indigo-700')}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn('text-slate-500', active && 'text-indigo-500')}>{def.label}:</span>
                <span className="font-semibold">
                  <SelectValue />
                </span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {def.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
      {activeCount > 0 && (
        <Button variant="ghost" className="text-indigo-700 hover:bg-indigo-50" onClick={onReset}>
          <X />
          Xóa lọc ({activeCount})
        </Button>
      )}
    </div>
  )
}

export default function LibraryFilterBar(props: LibraryFilterBarProps) {
  return (
    <>
      <FilterChips {...props} />
      <FilterSelects {...props} />
    </>
  )
}
