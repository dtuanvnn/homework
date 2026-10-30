import { useRef, type ComponentProps, type RefObject } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FormulaPreview from './FormulaPreview'
import TextFormatToolbar from './TextFormatToolbar'

interface ValueProps {
  value: string
  onChange: (value: string) => void
}

export function FormattedInput({ value, onChange, ...props }: ValueProps & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'ref'>) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="min-w-0 space-y-1.5">
      <Input {...props} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} />
      <TextFormatToolbar inputRef={ref} value={value} onChange={onChange} />
      <FormulaPreview text={value} />
    </div>
  )
}

export function FormattedTextarea({
  value, onChange, ref: externalRef, preview = true, ...props
}: ValueProps & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'ref'> & {
  ref?: RefObject<HTMLTextAreaElement | null>
  preview?: boolean
}) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const ref = externalRef ?? internalRef
  return (
    <div className="space-y-1.5">
      <Textarea {...props} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} />
      <TextFormatToolbar inputRef={ref} value={value} onChange={onChange} />
      {preview && <FormulaPreview text={value} />}
    </div>
  )
}
