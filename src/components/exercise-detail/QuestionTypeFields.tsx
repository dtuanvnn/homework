import { ArrowRight, Check, Plus, Trash2, X } from 'lucide-react'
import MathAnswerInput from '@/components/take/MathAnswerInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BLANK, OPTION_LETTERS, countBlanks } from '@/lib/questions'
import { cn } from '@/lib/utils'
import { orderingTokens, type QuestionDraft } from './question-draft'
import FormulaPreview from './FormulaPreview'

interface Props {
  draft: QuestionDraft
  onChange: (patch: Partial<QuestionDraft>) => void
}

function MultipleChoiceFields({ draft, onChange }: Props) {
  const setOption = (i: number, v: string) => onChange({ options: draft.options.map((o, j) => (j === i ? v : o)) })
  const remove = (i: number) =>
    onChange({
      options: draft.options.filter((_, j) => j !== i),
      correctIndex: draft.correctIndex === i ? 0 : draft.correctIndex > i ? draft.correctIndex - 1 : draft.correctIndex,
    })

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">Phương án · chạm vào chữ cái để chọn đáp án đúng</legend>
      {draft.options.map((opt, i) => {
        const correct = draft.correctIndex === i
        return (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ correctIndex: i })}
              aria-pressed={correct}
              aria-label={`Chọn ${OPTION_LETTERS[i]} là đáp án đúng`}
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                correct ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300',
              )}
            >
              {correct ? <Check className="size-5" /> : OPTION_LETTERS[i]}
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Input
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Phương án ${OPTION_LETTERS[i]}`}
                aria-label={`Phương án ${OPTION_LETTERS[i]}`}
                className={cn(correct && 'border-emerald-300 bg-emerald-50/50')}
              />
              <FormulaPreview text={opt} />
            </div>
            {draft.options.length > 2 && (
              <Button variant="ghost" size="icon" className="shrink-0 text-slate-400" onClick={() => remove(i)} aria-label={`Xóa phương án ${OPTION_LETTERS[i]}`}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        )
      })}
      {draft.options.length < OPTION_LETTERS.length && (
        <Button variant="ghost" className="w-fit text-indigo-700 hover:bg-indigo-50" onClick={() => onChange({ options: [...draft.options, ''] })}>
          <Plus />
          Thêm phương án
        </Button>
      )}
    </fieldset>
  )
}

function TrueFalseFields({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Đáp án đúng</Label>
      <ToggleGroup
        type="single"
        value={draft.tfAnswer ? 'true' : 'false'}
        onValueChange={(v) => v && onChange({ tfAnswer: v === 'true' })}
        className="w-full"
      >
        <ToggleGroupItem value="true" className="min-h-10 data-[state=on]:text-emerald-700">
          <Check />
          Đúng
        </ToggleGroupItem>
        <ToggleGroupItem value="false" className="min-h-10 data-[state=on]:text-red-600">
          <X />
          Sai
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

function FillBlankFields({ draft, onChange }: Props) {
  const n = countBlanks(draft.prompt)
  if (n === 0)
    return (
      <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
        Gõ <code className="rounded bg-white px-1 font-mono text-slate-700">{BLANK}</code> hoặc nhấn &quot;Chèn chỗ trống&quot; trong câu để tạo ô cần điền.
      </p>
    )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <ToggleGroup
          type="single"
          value={draft.math ? 'on' : 'off'}
          onValueChange={(v) => v && onChange({ math: v === 'on' })}
          className="w-full"
        >
          <ToggleGroupItem value="on" className="min-h-10 flex-1 data-[state=on]:text-indigo-700">
            Toán (bàn phím số, chấm theo giá trị)
          </ToggleGroupItem>
        </ToggleGroup>
        {draft.math && (
          <ToggleGroup
            type="single"
            value={draft.simplest ? 'on' : 'off'}
            onValueChange={(v) => v && onChange({ simplest: v === 'on' })}
            className="w-full"
          >
            <ToggleGroupItem value="on" className="min-h-10 flex-1 data-[state=on]:text-indigo-700">
              Bắt buộc dạng tối giản
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Label htmlFor={`blank-${i}`}>Đáp án chỗ trống {n > 1 ? i + 1 : ''}</Label>
          {draft.math ? (
            <MathAnswerInput
              value={draft.blanks[i] ?? ''}
              onChange={(v) => {
                const blanks = [...draft.blanks]
                blanks[i] = v
                onChange({ blanks })
              }}
              ariaLabel={`Đáp án chỗ trống ${n > 1 ? i + 1 : ''}`}
              size="inline"
            />
          ) : (
            <Input
              id={`blank-${i}`}
              value={draft.blanks[i] ?? ''}
              onChange={(e) => {
                const blanks = [...draft.blanks]
                blanks[i] = e.target.value
                onChange({ blanks })
              }}
              placeholder="VD: cao vời vợi"
              className="border-emerald-200 bg-emerald-50/40"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function ShortAnswerFields({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <ToggleGroup
          type="single"
          value={draft.math ? 'on' : 'off'}
          onValueChange={(v) => v && onChange({ math: v === 'on' })}
          className="w-full"
        >
          <ToggleGroupItem value="on" className="min-h-10 flex-1 data-[state=on]:text-indigo-700">
            Toán (bàn phím số, chấm theo giá trị)
          </ToggleGroupItem>
        </ToggleGroup>
        {draft.math && (
          <ToggleGroup
            type="single"
            value={draft.simplest ? 'on' : 'off'}
            onValueChange={(v) => v && onChange({ simplest: v === 'on' })}
            className="w-full"
          >
            <ToggleGroupItem value="on" className="min-h-10 flex-1 data-[state=on]:text-indigo-700">
              Bắt buộc dạng tối giản
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="short-answer">Đáp án</Label>
        {draft.math ? (
          <MathAnswerInput
            value={draft.shortAnswer}
            onChange={(v) => onChange({ shortAnswer: v })}
            ariaLabel="Đáp án"
            size="inline"
          />
        ) : (
          <Input
            id="short-answer"
            value={draft.shortAnswer}
            onChange={(e) => onChange({ shortAnswer: e.target.value })}
            placeholder="VD: 24 kg"
            className="border-emerald-200 bg-emerald-50/40"
          />
        )}
      </div>
    </div>
  )
}

function MatchingFields({ draft, onChange }: Props) {
  const setPair = (i: number, patch: Partial<QuestionDraft['pairs'][number]>) =>
    onChange({ pairs: draft.pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">Các cặp nối đúng</legend>
      <div className="grid grid-cols-[1fr_16px_56px_1fr_44px] items-center gap-2 px-0.5 text-xs font-medium text-slate-400">
        <span>Cột A</span>
        <span />
        <span>Hình</span>
        <span>Cột B</span>
        <span />
      </div>
      {draft.pairs.map((pair, i) => (
        <div key={i} className="grid grid-cols-[1fr_16px_56px_1fr_44px] items-center gap-2">
          <Input value={pair.left} onChange={(e) => setPair(i, { left: e.target.value })} placeholder="father" aria-label={`Cột A, cặp ${i + 1}`} />
          <ArrowRight className="size-4 text-slate-300" aria-hidden />
          <Input
            value={pair.picture ?? ''}
            onChange={(e) => setPair(i, { picture: e.target.value })}
            placeholder="👨"
            aria-label={`Hình minh họa, cặp ${i + 1}`}
            className="px-0 text-center"
          />
          <Input
            value={pair.right}
            onChange={(e) => setPair(i, { right: e.target.value })}
            placeholder="bố"
            aria-label={`Cột B, cặp ${i + 1}`}
            className="border-emerald-200 bg-emerald-50/40"
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400"
            disabled={draft.pairs.length <= 2}
            onClick={() => onChange({ pairs: draft.pairs.filter((_, j) => j !== i) })}
            aria-label={`Xóa cặp ${i + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        className="w-fit text-indigo-700 hover:bg-indigo-50"
        onClick={() => onChange({ pairs: [...draft.pairs, { left: '', right: '' }] })}
      >
        <Plus />
        Thêm cặp
      </Button>
    </fieldset>
  )
}

function OrderingFields({ draft, onChange }: Props) {
  const tokens = orderingTokens(draft.orderingText)
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="ordering">Câu đúng · ngăn cách các phần bằng &quot;/&quot;</Label>
      <Input
        id="ordering"
        value={draft.orderingText}
        onChange={(e) => onChange({ orderingText: e.target.value })}
        placeholder="Hôm nay / em / đến / trường / sớm"
        className="border-emerald-200 bg-emerald-50/40"
      />
      <FormulaPreview text={draft.orderingText} />
      {tokens.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-slate-50 px-3.5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((t, i) => (
              <span key={i} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500">{tokens.length} phần · học sinh sẽ thấy các phần này bị xáo trộn.</p>
        </div>
      )}
    </div>
  )
}

function EssayFields({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="rubric">Gợi ý chấm (không bắt buộc)</Label>
      <Textarea
        id="rubric"
        rows={4}
        value={draft.rubric}
        onChange={(e) => onChange({ rubric: e.target.value })}
        placeholder="Giới thiệu được tên bạn (0,5đ) · Tả ngoại hình hoặc tính tình (0,5đ) · …"
      />
      <FormulaPreview text={draft.rubric} />
      <p className="text-xs text-slate-500">Ngăn cách các tiêu chí bằng dấu &quot;·&quot;. Câu tự luận do phụ huynh chấm.</p>
    </div>
  )
}

export default function QuestionTypeFields(props: Props) {
  switch (props.draft.type) {
    case 'trac-nghiem':
      return <MultipleChoiceFields {...props} />
    case 'dung-sai':
      return <TrueFalseFields {...props} />
    case 'dien-cho-trong':
      return <FillBlankFields {...props} />
    case 'tra-loi-ngan':
      return <ShortAnswerFields {...props} />
    case 'noi':
      return <MatchingFields {...props} />
    case 'sap-xep':
      return <OrderingFields {...props} />
    case 'tu-luan':
      return <EssayFields {...props} />
  }
}
