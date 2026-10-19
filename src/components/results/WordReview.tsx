"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { MessageCircle, Turtle, Volume2 } from "lucide-react"
import HandwritingView from "@/components/ink/HandwritingView"
import { play } from "@/hooks/useSound"
import { list as listVariants, listItem } from "@/lib/animations"
import { NO_VOICE, SPEEDS, speak, stopSpeaking, useEnglishVoice } from "@/lib/speech"
import { cn } from "@/lib/utils"
import type { ReviewItem } from "@/lib/views/student"

/** Normal and slow: enough to hear a word again on the result screen. */
const RESULT_SPEEDS = [
  { ...SPEEDS[0], icon: Volume2 },
  { ...SPEEDS[1], icon: Turtle },
]

/** Result of a flashcard attempt: the words to practise again, with their spelling and audio. */
export default function WordReview({ review }: { review: ReviewItem[] }) {
  const reduced = useReducedMotion()
  const hasVoice = useEnglishVoice()
  const [speaking, setSpeaking] = useState<string | null>(null)
  useEffect(() => () => stopSpeaking(), [])
  const wrong = review.filter((q) => !q.correct)
  const right = review.filter((q) => q.correct)

  const say = (key: string, word: string, rate: number) => {
    play("tap")
    speak(word, rate, { start: () => setSpeaking(key), end: () => setSpeaking((s) => (s === key ? null : s)) })
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-extrabold text-slate-900">{wrong.length ? `Từ cần luyện lại (${wrong.length})` : "Em viết đúng hết các từ! 🎉"}</h2>
      {wrong.length > 0 && (
        <motion.ol className="space-y-3" variants={listVariants} initial="initial" animate="animate">
          {wrong.map((q) => {
            const n = review.indexOf(q) + 1
            return (
              <motion.li key={q.id} variants={listItem(reduced)} className="flex flex-col gap-3 rounded-3xl border-2 border-red-200 bg-white p-4 md:flex-row md:items-start md:p-5">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-bold text-slate-400">Từ {n}</p>
                  <p className="text-3xl font-extrabold break-words text-emerald-700" lang="en">
                    {q.word}
                  </p>
                  <p className="text-lg leading-relaxed text-slate-600" lang="en">
                    {q.prompt}
                  </p>
                  <div className="flex gap-2" role="group" aria-label={`Nghe từ ${q.word}`}>
                    {RESULT_SPEEDS.map((s) => {
                      const key = `${q.id}-${s.id}`
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!hasVoice}
                          title={hasVoice ? undefined : NO_VOICE}
                          onClick={() => say(key, q.word ?? "", s.rate)}
                          className={cn(
                            "inline-flex h-12 items-center gap-2 rounded-2xl border-2 px-4 text-base font-bold transition active:scale-95 disabled:opacity-40",
                            speaking === key ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700",
                          )}
                        >
                          <s.icon className="size-5" />
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                  {q.comment && (
                    <p className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-3 py-2 text-base text-indigo-900">
                      <MessageCircle className="mt-0.5 size-5 shrink-0 text-indigo-500" />
                      <span>
                        <span className="font-bold">Bố mẹ: </span>
                        {q.comment}
                      </span>
                    </p>
                  )}
                </div>
                <div className="w-full shrink-0 md:w-64">
                  <p className="text-sm font-bold text-slate-400">Em đã viết</p>
                  {q.handwriting ? <HandwritingView handwriting={q.handwriting} label={`Bài viết của em, từ ${n}`} /> : <p className="mt-2 text-base text-slate-500">(chưa viết)</p>}
                </div>
              </motion.li>
            )
          })}
        </motion.ol>
      )}
      {right.length > 0 && (
        <div className="rounded-3xl bg-emerald-50 p-4">
          <p className="text-base font-bold text-emerald-800">Đã viết đúng {right.length} từ</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {right.map((q) => (
              <li key={q.id} className="rounded-full bg-white px-3 py-1 text-base font-bold text-emerald-700" lang="en">
                {q.word}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
