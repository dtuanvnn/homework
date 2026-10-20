import { Layers } from 'lucide-react'
import QuestionPicture from '@/components/question/QuestionPicture'
import RichText from '@/components/question/RichText'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { SuggestedGroup } from '@/lib/question-groups-edit'

interface SuggestGroupsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: SuggestedGroup[]
  onApply: () => void
}

/** "Tự chia bài": previews the bài found among câu that start with the same instruction. */
export default function SuggestGroupsSheet({ open, onOpenChange, groups, onApply }: SuggestGroupsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tự chia bài</SheetTitle>
          <SheetDescription>
            {groups.length
              ? `Tìm thấy ${groups.length} bài. Đề chung được tách ra, mỗi câu chỉ giữ phần riêng.`
              : 'Không tìm thấy câu nào có chung đề.'}
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5 md:px-6">
          {groups.map((g) => (
            <li key={`${g.from}-${g.to}`} className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
              <p className="flex items-center gap-2 font-bold text-slate-900">
                <Layers className="size-4 text-indigo-600" aria-hidden />
                {g.title}
                <span className="font-medium text-slate-500">
                  · câu {g.from}–{g.to}
                  {g.blanks ? ` · tách ${g.blanks} chỗ trống` : ''}
                </span>
              </p>
              {g.prompt && (
                <p className="line-clamp-4 text-sm break-words whitespace-pre-line text-slate-700">
                  <RichText text={g.prompt} />
                </p>
              )}
              {g.image && <QuestionPicture question={{ image: g.image, imageUrl: g.imageUrl }} className="max-h-32" />}
            </li>
          ))}
        </ul>
        <SheetFooter>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button
              className="flex-[2]"
              disabled={!groups.length}
              onClick={() => {
                onApply()
                onOpenChange(false)
              }}
            >
              Áp dụng
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
