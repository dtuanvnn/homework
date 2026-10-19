import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SkillTagInputProps {
  id?: string
  value: string[]
  onChange: (skills: string[]) => void
  suggestions?: string[]
}

export default function SkillTagInput({ id, value, onChange, suggestions = [] }: SkillTagInputProps) {
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const skill = raw.trim().replace(/^#/, '')
    if (skill && !value.includes(skill)) onChange([...value, skill])
    setText('')
  }

  const remaining = suggestions.filter((s) => !value.includes(s)).slice(0, 4)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-white px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        {value.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-2.5 text-sm font-medium text-slate-700">
            #{skill}
            <button
              type="button"
              onClick={() => onChange(value.filter((s) => s !== skill))}
              className="flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label={`Bỏ kỹ năng ${skill}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? '' : 'VD: Bảng nhân – nhấn Enter để thêm'}
          className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-slate-400 md:text-sm"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                'inline-flex h-8 items-center rounded-full border border-dashed border-slate-300 px-3 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700',
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
