import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import Press from "@/components/fun/Press"
import { questionSlide, softSpring } from "@/lib/animations"
import { play } from "@/hooks/useSound"
import { ChevronLeft, ChevronRight, Grid3x3, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SUBJECTS } from "@/lib/subjects"
import { isInkEmpty } from "@/lib/ink"
import { isLongPrompt } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { QuestionType, SubjectId } from "@/lib/types"
import type { TakeQuestion } from "@/lib/views/student"
import { Essay, FillBlank, Matching, MultipleChoice, Ordering, ShortAnswer, TrueFalse, type EssayValue } from "./questions"
import RichText from "@/components/question/RichText"
import QuestionPicture from "@/components/question/QuestionPicture"
import { clockLabel } from "@/lib/timer"
import { SaveStatus, TakeClock, TakeDialogs, TakeOverlays } from "./TakeChrome"
import { useTakeSession, type Answers, type TakeSessionProps } from "./use-take-session"

export type { Answers, TakeTimer } from "./use-take-session"

const TYPE_LABEL: Record<QuestionType, string> = {
  "trac-nghiem": "Trắc nghiệm",
  "dung-sai": "Đúng hay Sai?",
  "dien-cho-trong": "Điền vào chỗ trống",
  "tra-loi-ngan": "Trả lời ngắn",
  noi: "Nối cho đúng",
  "sap-xep": "Sắp xếp thành câu",
  "tu-luan": "Tự luận",
  "tu-vung": "Từ vựng",
}

function isAnswered(q: TakeQuestion, a: unknown): boolean {
  if (a === undefined || a === null) return false
  switch (q.type) {
    case "trac-nghiem": return typeof a === "number" || (Array.isArray(a) && a.length > 0)
    case "dien-cho-trong": return Array.isArray(a) && a.filter((s) => typeof s === "string" && s.trim()).length === q.blanks
    case "tra-loi-ngan": return typeof a === "string" && Boolean(a.trim())
    case "noi": return Object.keys(a as object).length === q.pairs.length
    case "sap-xep": return (a as number[]).length === q.tokens.length
    case "tu-luan": return Boolean((a as EssayValue).text?.trim() || (a as EssayValue).drawing || !isInkEmpty((a as EssayValue).ink))
    default: return true
  }
}

export default function TakeAssignment({
  title,
  subject,
  questions,
  ...sessionProps
}: TakeSessionProps & {
  title: string
  subject: SubjectId
  questions: TakeQuestion[]
}) {
  const tone = SUBJECTS[subject]
  const [index, setIndexRaw] = useState(0) // questions.length = review screen
  const [dir, setDir] = useState(1)
  const setIndex = (i: number) => {
    if (i === index) return
    setDir(i > index ? 1 : -1)
    play("next")
    setIndexRaw(i)
  }
  const [starKey, setStarKey] = useState(0)
  const [gridOpen, setGridOpen] = useState(false)
  const session = useTakeSession(sessionProps, () => setGridOpen(false))
  const { answers, set, reduced, countdown, elapsed } = session

  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length
  const missing = questions.length - answeredCount
  const reviewing = index === questions.length
  const q = questions[index]
  const pct = (answeredCount / questions.length) * 100

  // Pop a star on the progress bar whenever another question becomes answered.
  const prevAnswered = useRef(answeredCount)
  useEffect(() => {
    if (answeredCount > prevAnswered.current) setStarKey((k) => k + 1)
    prevAnswered.current = answeredCount
  }, [answeredCount])


  const renderQuestion = (q: TakeQuestion) => {
    const tactile = q.type === "trac-nghiem" || q.type === "dung-sai" || q.type === "noi" || q.type === "sap-xep"
    const p = { value: answers[q.id] as never, onChange: (v: unknown) => { if (tactile) play("select"); set(q.id, v) }, tone }
    switch (q.type) {
      case "trac-nghiem": return <MultipleChoice q={q} {...p} />
      case "dung-sai": return <TrueFalse q={q} {...p} />
      case "dien-cho-trong": return <FillBlank q={q} {...p} />
      case "tra-loi-ngan": return <ShortAnswer q={q} {...p} math={subject === "toan"} />
      case "noi": return <Matching key={q.id} q={q} {...p} />
      case "sap-xep": return <Ordering q={q} {...p} />
      case "tu-luan": return <Essay q={q} {...p} />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50" role="dialog" aria-modal aria-label={`Làm bài: ${title}`}>
      {/* Top bar */}
      <header className="border-b bg-white px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 md:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button variant="ghost" size="icon" className="size-12 shrink-0 rounded-full [&_svg]:size-6" aria-label="Thoát" onClick={() => session.setConfirmExit(true)}>
            <X />
          </Button>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-bold", tone.text)}>{tone.name}</p>
            <h1 className="truncate text-lg font-extrabold text-slate-900 md:text-xl">{title}</h1>
          </div>
          <SaveStatus session={session} />
          <TakeClock session={session} />
        </div>
        <div className="mx-auto mt-3 flex max-w-4xl items-center gap-3">
          <div className="relative h-3 flex-1 rounded-full bg-slate-100" role="progressbar" aria-valuenow={answeredCount} aria-valuemax={questions.length}>
            <motion.div className={cn("h-full rounded-full", tone.bg)} initial={false} animate={{ width: `${pct}%` }} transition={reduced ? { duration: 0.2 } : softSpring} />
            <AnimatePresence>
              {starKey > 0 && (
                <motion.span
                  key={starKey}
                  className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl"
                  style={{ left: `${pct}%` }}
                  initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -60, opacity: 0 }}
                  animate={reduced ? { opacity: [0, 1, 0] } : { scale: [0, 1.5, 1], rotate: 0, opacity: [0, 1, 1, 0], y: [0, -10, -14] }}
                  transition={{ duration: 0.6 }}
                  aria-hidden
                >
                  ⭐
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="shrink-0 text-base font-extrabold tabular-nums text-slate-700">
            {reviewing ? "Xem lại" : `Câu ${index + 1}/${questions.length}`}
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
          {reviewing ? (
            <motion.div key="review" custom={dir} variants={questionSlide(reduced)} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center gap-6 text-center">
              <span className="text-6xl" aria-hidden>{missing ? "🧐" : "🎉"}</span>
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">{missing ? `Còn ${missing} câu chưa làm` : "Em đã làm hết các câu!"}</h2>
                <p className="mt-2 text-lg text-slate-500">
                  {missing ? "Chạm vào câu màu xám để làm tiếp, hoặc nộp bài luôn." : countdown ? "Em còn thời gian thì kiểm tra lại, rồi nộp bài nhé!" : `Em đã làm xong trong ${clockLabel(elapsed)}. Nộp bài thôi!`}
                </p>
              </div>
              <QuestionGrid questions={questions} answers={answers} current={-1} onPick={setIndex} toneBg={tone.bg} />
              <Press className="max-w-sm">
                <Button className="h-16 w-full rounded-2xl text-xl font-extrabold [&_svg]:size-6" onClick={() => session.setConfirmSubmit(true)}>
                  <Send />
                  Nộp bài
                </Button>
              </Press>
            </motion.div>
          ) : (
            <motion.div key={q.id} custom={dir} variants={questionSlide(reduced)} initial="initial" animate="animate" exit="exit" className="space-y-6">
              <div className="space-y-3">
                <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-bold", tone.softBg, tone.text)}>
                  {TYPE_LABEL[q.type]} · {q.points.toLocaleString("vi-VN")} điểm
                </span>
                {q.type !== "dien-cho-trong" &&
                  (isLongPrompt(q.prompt) ? (
                    <h2 className="rounded-3xl bg-white p-5 text-xl leading-relaxed font-semibold break-words whitespace-pre-line text-slate-900 md:p-6 md:text-2xl md:leading-relaxed">
                      <RichText text={q.prompt} />
                    </h2>
                  ) : (
                    <h2 className="text-3xl leading-snug font-extrabold break-words whitespace-pre-line text-slate-900 md:text-4xl">
                      <RichText text={q.prompt} />
                    </h2>
                  ))}
                {q.type === "dien-cho-trong" && <h2 className="text-xl font-bold text-slate-600">Em điền từ thích hợp vào chỗ trống:</h2>}
              </div>
              <QuestionPicture question={q} className="mx-auto max-h-96" />
              {renderQuestion(q)}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="border-t bg-white px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-2 md:gap-3">
          <Button variant="outline" className="h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <ChevronLeft />
            Câu trước
          </Button>
          <Button variant="outline" className="h-14 shrink-0 rounded-2xl px-4 text-base font-bold [&_svg]:size-6" onClick={() => setGridOpen(true)} aria-label="Danh sách câu hỏi">
            <Grid3x3 />
            <span className="tabular-nums">{answeredCount}/{questions.length}</span>
          </Button>
          {reviewing ? (
            <Button className="h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6" onClick={() => session.setConfirmSubmit(true)}>
              Nộp bài
              <Send />
            </Button>
          ) : (
            <Button className={cn("h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6", index === questions.length - 1 && "bg-emerald-600 hover:bg-emerald-700")} onClick={() => setIndex(index + 1)}>
              {index === questions.length - 1 ? "Xem lại" : "Câu tiếp"}
              <ChevronRight />
            </Button>
          )}
        </div>
      </footer>

      <Sheet open={gridOpen} onOpenChange={setGridOpen}>
        <SheetContent className="z-[60]">
          <SheetHeader>
            <SheetTitle className="text-xl">Danh sách câu hỏi</SheetTitle>
            <SheetDescription className="text-base">Đã làm {answeredCount}/{questions.length} câu</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <QuestionGrid questions={questions} answers={answers} current={index} toneBg={tone.bg} onPick={(i) => { setIndex(i); setGridOpen(false) }} />
            <div className="mt-4 flex justify-center gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><span className={cn("size-3 rounded", tone.bg)} />Đã làm</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-slate-200" />Chưa làm</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-indigo-600" />Đang xem</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TakeDialogs
        session={session}
        submitText={missing ? `Em còn ${missing} câu chưa làm. Sau khi nộp em sẽ không sửa được nữa.` : "Sau khi nộp, bố mẹ sẽ chấm bài cho em."}
      />
      <TakeOverlays session={session} />
    </div>
  )
}

function QuestionGrid({ questions, answers, current, onPick, toneBg }: { questions: TakeQuestion[]; answers: Answers; current: number; onPick: (i: number) => void; toneBg: string }) {
  return (
    <div className="grid w-full max-w-md grid-cols-5 gap-2.5 mx-auto">
      {questions.map((q, i) => {
        const done = isAnswered(q, answers[q.id])
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Câu ${i + 1}${done ? ", đã làm" : ", chưa làm"}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-2xl text-xl font-extrabold tabular-nums transition-[transform,background-color] active:scale-90",
              done ? cn(toneBg, "text-white") : "bg-slate-200 text-slate-600",
              current === i && "ring-4 ring-indigo-600 ring-offset-2",
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
