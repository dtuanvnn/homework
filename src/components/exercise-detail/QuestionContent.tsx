import { ArrowRight, Check, X } from 'lucide-react'
import { BLANK, OPTION_LETTERS } from '@/lib/questions'
import { cn } from '@/lib/utils'
import type { Question, QuestionImage } from '@/lib/types'
import RichText from '@/components/question/RichText'
import QuestionPicture from '@/components/question/QuestionPicture'
import { mathText } from '@/lib/rich-text'

const correctChip = 'border-emerald-300 bg-emerald-50 text-emerald-800'

function Prompt({ text }: { text: string }) {
  return (
    <p className="text-base leading-relaxed font-medium break-words whitespace-pre-line text-slate-900">
      <RichText text={text} />
    </p>
  )
}

function AnswerBox({ label = 'Đáp án', children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      <div className="min-w-0 text-sm">
        <span className="font-semibold">{label}: </span>
        {children}
      </div>
    </div>
  )
}

/** Without an answer key (`answerStatus: "missing"`) the placeholder answers are not shown as correct. */
function QuestionBody({ question: q }: { question: Question }) {
  const keyless = q.answerStatus === 'missing'
  switch (q.type) {
    case 'trac-nghiem':
      return (
        <div className="flex flex-col gap-3">
          <Prompt text={q.prompt} />
          <ul className="grid grid-cols-2 gap-2">
            {q.options.map((opt, i) => {
              const correct = !keyless && i === q.correctIndex
              return (
                <li
                  key={i}
                  className={cn(
                    'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm',
                    correct ? correctChip : 'border-slate-200 text-slate-700',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      correct ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {OPTION_LETTERS[i]}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    <RichText text={opt} />
                  </span>
                  {correct && (
                    <>
                      <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                      <span className="sr-only">Đáp án đúng</span>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )

    case 'dung-sai':
      return (
        <div className="flex flex-col gap-3">
          <Prompt text={q.prompt} />
          <div className="flex gap-2">
            {[true, false].map((v) => {
              const correct = !keyless && v === q.answer
              const Icon = v ? Check : X
              return (
                <span
                  key={String(v)}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold',
                    correct ? correctChip : 'border-slate-200 text-slate-400',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {v ? 'Đúng' : 'Sai'}
                  {correct && <span className="sr-only">(đáp án)</span>}
                </span>
              )
            })}
          </div>
        </div>
      )

    case 'dien-cho-trong': {
      const parts = q.prompt.split(BLANK)
      return (
        <p className="text-base leading-relaxed font-medium break-words whitespace-pre-line text-slate-900">
          {parts.map((part, i) => (
            <span key={i}>
              <RichText text={part} />
              {i < parts.length - 1 && (
                <span className="mx-1 inline-block rounded-md border-b-2 border-emerald-500 bg-emerald-50 px-2 font-semibold text-emerald-700">
                  {q.answers[i] && !keyless ? <RichText text={q.math ? mathText(q.answers[i]) : q.answers[i]} /> : '…'}
                </span>
              )}
            </span>
          ))}
        </p>
      )
    }

    case 'tra-loi-ngan':
      return (
        <div className="flex flex-col gap-3">
          <Prompt text={q.prompt} />
          {!keyless && (
            <AnswerBox>
              <span className="font-bold">
                <RichText text={q.math ? mathText(q.answer) : q.answer} />
              </span>
            </AnswerBox>
          )}
        </div>
      )

    case 'noi':
      return (
        <div className="flex flex-col gap-3">
          <Prompt text={q.prompt} />
          <ul className="flex flex-col gap-2">
            {q.pairs.map((pair, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
                  <RichText text={pair.left} />
                </span>
                {keyless ? <span className="w-4" /> : <ArrowRight className="size-4 text-emerald-500" aria-label="nối với" />}
                <span className={cn('flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold', keyless ? 'border-slate-200 text-slate-800' : correctChip)}>
                  {pair.picture && (
                    <span className="text-lg leading-none" aria-hidden>
                      {pair.picture}
                    </span>
                  )}
                  <RichText text={pair.right} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'sap-xep':
      return (
        <div className="flex flex-col gap-3">
          <Prompt text={q.prompt} />
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Các từ hiển thị cho học sinh">
            {q.shuffled.map((idx, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">
                  <RichText text={q.tokens[idx]} />
                </span>
                {i < q.shuffled.length - 1 && <span className="text-slate-300">/</span>}
              </span>
            ))}
          </div>
          {!keyless && (
            <AnswerBox>
              <span className="font-bold">
                <RichText text={q.tokens.join(' ') + '.'} />
              </span>
            </AnswerBox>
          )}
        </div>
      )

    case 'tu-luan':
      return (
        <div className="flex flex-col gap-3">
          <Prompt text={q.prompt} />
          {q.rubric.trim() && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
              <div className="mb-1.5 font-semibold text-emerald-800">Gợi ý chấm</div>
              <ul className="flex flex-col gap-1">
                {q.rubric
                  .split('·')
                  .map((r) => r.trim())
                  .filter(Boolean)
                  .map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                      <RichText text={r} />
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )
  }
}

interface SolutionParts {
  solution?: string
  solutionImage?: QuestionImage
  solutionImageUrl?: string
}

/** The worked solution and its picture, for the parent (and the child once answers are revealed). */
export function SolutionBox({ question: q }: { question: SolutionParts }) {
  const text = q.solution?.trim()
  if (!text && !q.solutionImage) return null
  return (
    <details className="group rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2.5 text-sm text-slate-800">
      <summary className="cursor-pointer font-semibold text-violet-800 outline-none">Lời giải</summary>
      {text && (
        <p className="mt-1.5 leading-relaxed break-words whitespace-pre-line">
          <RichText text={text} />
        </p>
      )}
      {q.solutionImage && <QuestionPicture question={{ image: q.solutionImage, imageUrl: q.solutionImageUrl }} className="mt-2" />}
    </details>
  )
}

export default function QuestionContent({ question: q }: { question: Question }) {
  return (
    <div className="flex flex-col gap-3">
      <QuestionBody question={q} />
      <QuestionPicture question={q} />
      <SolutionBox question={q} />
    </div>
  )
}
