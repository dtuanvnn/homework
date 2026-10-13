import RichText from '@/components/question/RichText'
import { hasMath } from '@/lib/rich-text'

/** Live rendering under a text field once it contains a $…$ formula. */
export default function FormulaPreview({ text }: { text: string }) {
  if (!hasMath(text)) return null
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-sm text-slate-800" aria-label="Xem trước công thức">
      <RichText text={text} className="whitespace-pre-line" />
    </div>
  )
}
