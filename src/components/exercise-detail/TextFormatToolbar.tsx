import type { RefObject } from 'react'
import { Bold, Highlighter, Underline } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InlineFormat } from '@/lib/rich-text'
import { formatSelection } from '@/lib/text-format'

const FORMATS = [
  { format: 'bold', label: 'In đậm', icon: Bold },
  { format: 'underline', label: 'Gạch chân', icon: Underline },
  { format: 'highlight', label: 'Tô nổi bật', icon: Highlighter },
] as const

export default function TextFormatToolbar({
  inputRef, value, onChange,
}: {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
}) {
  const apply = (format: InlineFormat) => {
    const input = inputRef.current
    if (!input) return
    const next = formatSelection(value, input.selectionStart ?? value.length, input.selectionEnd ?? value.length, format)
    onChange(next.text)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(next.start, next.end)
    })
  }
  return (
    <div role="group" aria-label="Định dạng văn bản" className="flex flex-wrap gap-1.5">
      {FORMATS.map(({ format, label, icon: Icon }) => (
        <Button key={format} type="button" variant="outline" size="sm" className="h-9" title={`${label} · chọn chữ rồi bấm; bấm lại để bỏ`}
          onPointerDown={(e) => e.preventDefault()} onClick={() => apply(format)}>
          <Icon className="size-4" aria-hidden />
          {label}
        </Button>
      ))}
    </div>
  )
}
