import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import CountUp from "@/components/fun/CountUp"
import Mascot from "@/components/fun/Mascot"
import Press from "@/components/fun/Press"
import { celebrate, list as listVariants, listItem, shake, starPop } from "@/lib/animations"
import { play } from "@/hooks/useSound"

/** Green check that draws itself. */
function DrawnCheck({ reduced }: { reduced: boolean | null }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduced ? { opacity: 0 } : { pathLength: 0 }} whileInView={reduced ? { opacity: 1 } : { pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }} />
    </svg>
  )
}
import { ArrowRight, ArrowUp, Home, Lightbulb, Loader2, Lock, MessageCircle, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ResultView } from "@/lib/views/student"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import { isLongPrompt } from "@/lib/questions"
import { explainMistakes } from "@/server/actions/ai-hints"
import { SolutionBox } from "@/components/exercise-detail/QuestionContent"
import RichText from "@/components/question/RichText"
import QuestionPicture from "@/components/question/QuestionPicture"

export const fmtScore = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })

function message(r: ResultView) {
  if (r.previousScore !== undefined && r.score > r.previousScore) return "Giỏi lắm! Con đã tiến bộ hơn lần trước 🎉"
  if (r.score >= 9) return "Xuất sắc! Con làm gần như đúng hết 🌟"
  if (r.score >= 8) return "Giỏi lắm! Con làm rất tốt 🎉"
  if (r.score >= 6.5) return "Khá lắm! Cố thêm chút nữa nhé 💪"
  return "Không sao đâu, mình cùng làm lại nhé 🤗"
}

export default function ResultDetail({
  result: r,
  onRetry,
  onHome,
}: {
  result: ResultView
  onRetry: () => void
  onHome: () => void
}) {
  const reduced = useReducedMotion()
  const [filter, setFilter] = useState<"all" | "wrong">("all")
  const [finished, setFinished] = useState(false)

  // Stars "ting" one by one (rising pitch), then celebrate based on the score.
  useEffect(() => {
    const timers: number[] = []
    const base = reduced ? 0 : 900
    for (let i = 0; i < r.stars; i++) timers.push(window.setTimeout(() => play("star", i), base + i * (reduced ? 150 : 250)))
    timers.push(
      window.setTimeout(() => {
        setFinished(true)
        if (r.score >= 8) { play("celebrate"); celebrate("big") }
        else if (r.score >= 6) { play("celebrate"); celebrate("small") }
      }, base + r.stars * (reduced ? 150 : 250) + 150),
    )
    return () => timers.forEach(clearTimeout)
  }, [r.id, r.score, r.stars, reduced])
  const s = SUBJECTS[r.subject]
  const wrong = r.review.filter((q) => !q.correct)
  const list = filter === "all" ? r.review : wrong

  // While a retry is open the answers stay hidden; wrong answers get AI hints, written once and saved.
  const [hints, setHints] = useState<Record<string, string>>({})
  const [hintsLoading, setHintsLoading] = useState(r.hintsPending)
  const asked = useRef<string | null>(null)
  useEffect(() => {
    if (!r.hintsPending || asked.current === r.id) return
    asked.current = r.id
    explainMistakes(r.id)
      .then((res) => { if (res.ok) setHints(res.data) })
      .finally(() => setHintsLoading(false))
  }, [r.id, r.hintsPending])

  return (
    <div className="flex flex-col gap-6 pb-8 text-lg">
      {/* Hero */}
      <section className={cn("relative overflow-hidden rounded-[28px] p-6 text-center text-white shadow-lg md:p-10", s.bg)}>
        <div className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-white/15" />
        <div className="pointer-events-none absolute -right-12 -bottom-16 size-48 rounded-full bg-white/10" />
        <div className="relative flex flex-col items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
            <s.icon className="size-4" />
            {s.name} · Lần {r.attempt}
          </span>
          <h1 className="text-xl font-extrabold md:text-2xl">{r.title}</h1>
          <p className="text-7xl leading-none font-black tabular-nums drop-shadow-sm md:text-8xl">
            <CountUp value={r.score} from={0} duration={1.2} digits={2} />
            <span className="text-3xl font-bold opacity-80 md:text-4xl">/10</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl tracking-wider" aria-label={`${r.stars} sao`}>
              {[1, 2, 3].map((i) =>
                i > r.stars ? (
                  <span key={i} className="inline-block opacity-30 grayscale">⭐</span>
                ) : (
                  <motion.span key={i} className="inline-block" variants={starPop(i - 1, reduced)} initial="initial" animate="animate">⭐</motion.span>
                ),
              )}
            </span>
            <motion.span
              className="rounded-full bg-amber-300 px-3 py-1 text-base font-extrabold text-amber-900"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduced ? 0.3 : 1 + r.stars * 0.25, type: "spring", stiffness: 400, damping: 14 }}
            >
              +{r.stars} sao
            </motion.span>
          </div>
          <motion.p className="text-xl font-bold md:text-2xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0.2 : 1.3 }}>
            {message(r)}
          </motion.p>
          {r.score < 6 && finished && (
            <div className="flex items-center gap-3 rounded-2xl bg-white/20 px-4 py-2">
              <Mascot mood="thumbs" className="[&_span]:text-5xl" />
              <span className="text-left text-base font-bold">Bạn Cáo tin em làm được! Mình thử lại nhé.</span>
            </div>
          )}
          {r.previousScore !== undefined && (
            <div className="mt-1 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-base font-bold text-slate-700 shadow-sm">
              <span className="text-slate-500">Lần 1: {fmtScore(r.previousScore)}</span>
              <motion.span
                className="inline-flex origin-left items-center"
                initial={reduced ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
                animate={reduced ? { opacity: 1 } : { scaleX: 1, opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.45, ease: "easeOut" }}
              >
                <span className="h-1 w-8 rounded-full bg-emerald-400" />
                <ArrowRight className="-ml-1.5 size-5 text-emerald-500" />
              </motion.span>
              <motion.span className="text-emerald-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
                Lần 2: {fmtScore(r.score)}
              </motion.span>
              {r.score > r.previousScore && (
                <motion.span
                  className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-sm text-white"
                  initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -15 }}
                  animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0 }}
                  transition={{ delay: 2, type: "spring", stiffness: 500, damping: 12 }}
                >
                  <ArrowUp className="size-4" />Tiến bộ! +{fmtScore(r.score - r.previousScore)}
                </motion.span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Parent comment */}
      {r.parentComment && <div className="flex items-end gap-3">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="flex size-14 items-center justify-center rounded-full bg-indigo-100 text-3xl" aria-hidden>👨‍👩‍👧</span>
          <span className="text-sm font-bold text-slate-600">Bố mẹ</span>
        </div>
        <p className="mb-6 rounded-3xl rounded-bl-md border-2 border-indigo-100 bg-white px-5 py-4 text-xl leading-relaxed font-medium text-slate-800 shadow-sm">
          {r.parentComment}
        </p>
      </div>}

      {/* Review */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-slate-900">Xem lại từng câu</h2>
          <div className="flex gap-2" role="group" aria-label="Lọc câu hỏi">
            {[
              { id: "all" as const, label: `Tất cả (${r.review.length})` },
              { id: "wrong" as const, label: `Câu sai (${wrong.length})` },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={filter === c.id}
                onClick={() => { play("tap"); setFilter(c.id) }}
                className={cn(
                  "h-12 rounded-full border-2 px-5 text-base font-bold",
                  filter === c.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {!r.answersRevealed && wrong.length > 0 && (
          <p className="flex items-start gap-3 rounded-3xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-lg leading-relaxed font-medium text-amber-900">
            <Lock className="mt-1 size-5 shrink-0 text-amber-500" />
            {r.canRetry
              ? "Đáp án đúng sẽ hiện sau khi em làm lại lần 2. Em đọc gợi ý ở các câu sai rồi thử lại nhé!"
              : "Đáp án đúng sẽ hiện khi bài làm lại của em được chấm xong."}
          </p>
        )}
        {list.length === 0 && (
          <p className="rounded-3xl bg-emerald-50 p-6 text-center text-xl font-bold text-emerald-700">Không có câu nào sai, tuyệt vời! 🎉</p>
        )}
        <motion.ol key={filter} className="space-y-3" variants={listVariants} initial="initial" animate="animate">
          {list.map((q) => {
            const n = r.review.indexOf(q) + 1
            return (
              <motion.li
                key={q.id}
                variants={listItem(reduced)}
                onViewportEnter={() => play(q.correct ? "correct" : "wrong")}
                viewport={{ once: true, amount: 0.6 }}
                className={cn("flex gap-4 rounded-3xl border-2 bg-white p-4 md:p-5", q.correct ? "border-emerald-100" : "border-red-200")}>
                <motion.span
                  className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl text-white", q.correct ? "bg-emerald-500" : "bg-red-400")}
                  aria-label={q.correct ? "Đúng" : "Sai"}
                  whileInView={!q.correct && !reduced ? shake : undefined}
                  viewport={{ once: true }}
                >
                  {q.correct ? <DrawnCheck reduced={reduced} /> : <X className="size-7" strokeWidth={3} />}
                </motion.span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-bold text-slate-400">Câu {n}</p>
                  <p className={cn("leading-snug break-words whitespace-pre-line text-slate-900", isLongPrompt(q.prompt) ? "text-lg font-medium leading-relaxed" : "text-xl font-bold")}>
                    <RichText text={q.prompt} />
                  </p>
                  <QuestionPicture question={q} />
                  <p className="text-lg text-slate-600">
                    Em trả lời:{" "}
                    <span className={cn("font-bold", q.correct ? "text-emerald-700" : "text-red-600 line-through decoration-2")}>
                      <RichText text={q.answer} />
                    </span>
                  </p>
                  {!q.correct && r.answersRevealed && q.correctAnswer && (
                    <p className="text-lg text-slate-600">
                      Đáp án đúng: <span className="rounded-lg bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                        <RichText text={q.correctAnswer} />
                      </span>
                    </p>
                  )}
                  {r.answersRevealed && <SolutionBox text={q.solution} />}
                  {!q.correct && !r.answersRevealed && (q.hint ?? hints[q.id] ? (
                    <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-base leading-relaxed text-amber-900">
                      <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-500" />
                      <span>
                        <span className="font-bold">Gợi ý: </span>
                        <RichText text={q.hint ?? hints[q.id]} />
                      </span>
                    </p>
                  ) : hintsLoading ? (
                    <p className="flex items-center gap-2 text-base text-slate-500">
                      <Loader2 className="size-4 animate-spin" />
                      Đang chuẩn bị gợi ý cho em…
                    </p>
                  ) : null)}
                  {q.comment && (
                    <p className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-3 py-2 text-base text-indigo-900">
                      <MessageCircle className="mt-0.5 size-5 shrink-0 text-indigo-500" />
                      <span><span className="font-bold">Bố mẹ: </span>{q.comment}</span>
                    </p>
                  )}
                </div>
              </motion.li>
            )
          })}
        </motion.ol>
      </section>

      {/* Bottom actions: sticky above the phone tab bar */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 rounded-3xl border bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          {r.canRetry && (
            <Press className="flex-1"><Button className="h-14 w-full rounded-2xl text-lg font-extrabold [&_svg]:size-6" onClick={onRetry}>
              <RotateCcw />
              Làm lại lần 2
            </Button></Press>
          )}
          <Press className="flex-1"><Button variant="outline" className="h-14 w-full rounded-2xl border-2 text-lg font-bold [&_svg]:size-6" onClick={onHome}>
            <Home />
            Về trang chính
          </Button></Press>
        </div>
      </div>
    </div>
  )
}
