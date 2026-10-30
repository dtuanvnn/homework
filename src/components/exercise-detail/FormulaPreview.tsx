import RichText from '@/components/question/RichText'
import { hasFormatting, hasMath } from '@/lib/rich-text'

/** Live rendering under a field containing formulas or inline emphasis. */
export default function FormulaPreview({ text }: { text: string }) {
  const math = hasMath(text)
  if (!math && !hasFormatting(text)) return null
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-sm text-slate-800" aria-label={math ? "Xem trước công thức" : "Xem trước định dạng"}>
      <RichText text={text} className="whitespace-pre-line" />
    </div>
  )
}
