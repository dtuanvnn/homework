import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Press from "@/components/fun/Press"
import { pop, questionSlide, softSpring } from "@/lib/animations"
import { play } from "@/hooks/useSound"
import { Check, ChevronLeft, ChevronRight, CloudAlert, CloudCheck, Grid3x3, Loader2, Send, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { CountdownClock, StopwatchClock } from "./CountdownClock"

const TYPE_LABEL: Record<QuestionType, string> = {
  "trac-nghiem": "Trắc nghiệm",
  "dung-sai": "Đúng hay Sai?",
  "dien-cho-trong": "Điền vào chỗ trống",
  "tra-loi-ngan": "Trả lời ngắn",
  noi: "Nối cho đúng",
  "sap-xep": "Sắp xếp thành câu",
  "tu-luan": "Tự luận",
}

export type Answers = Record<string, unknown>

/**
 * Exam mode counts down to a server deadline (`serverNow` corrects the device
 * clock); untimed work counts up from the seconds already saved with the draft.
 */
export type TakeTimer =
  | { kind: "countdown"; deadline: string; serverNow: string; limitMinutes: number }
  | { kind: "stopwatch"; initialSeconds: number }

/** Debounce before an autosave after the last change. */
const SAVE_DELAY = 800
/** A hand-in try after time ran out counts as failed after this long (the network may hang). */
const TIME_UP_TRY_MS = 20_000
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
/** Resolves when the browser is (back) online. */
const online = () =>
  navigator.onLine ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("online", () => r(), { once: true }))

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
  initialAnswers = {},
  timer,
  onSave,
  onExit,
  onSubmit,
  onSubmitted,
  onResync,
}: {
  title: string
  subject: SubjectId
  questions: TakeQuestion[]
  initialAnswers?: Answers
  timer: TakeTimer
  /** Persists the answers (and the untimed work seconds): "local" = only on this device (offline); false = failed. */
  onSave: (answers: Answers, elapsedSeconds: number) => Promise<"server" | "local" | false>
  /** Called after the answers were saved on "Lưu và thoát". */
  onExit: () => void
  /** Hands the work in; `queued` = kept on the device until there is network; null = failed (the caller shows the error). */
  onSubmit: (answers: Answers, elapsedSeconds: number, quiet?: boolean) => Promise<{ graded: boolean } | { queued: true } | null>
  /** Called once the "sent" animation finished (queued work: when the child taps the button). */
  onSubmitted: () => void
  /** Countdown only: fetches a fresh deadline and server time (the props may be stale). */
  onResync?: () => Promise<{ deadline: string; serverNow: string } | null>
}) {
  const tone = SUBJECTS[subject]
  const [answers, setAnswers] = useState<Answers>(initialAnswers)
  const reduced = useReducedMotion()
  const [index, setIndexRaw] = useState(0) // questions.length = review screen
  const [dir, setDir] = useState(1)
  const setIndex = (i: number) => {
    if (i === index) return
    setDir(i > index ? 1 : -1)
    play("next")
    setIndexRaw(i)
  }
  const [justSaved, setJustSaved] = useState(false)
  const [starKey, setStarKey] = useState(0)
  const [flight, setFlight] = useState<"idle" | "flying" | "done">("idle")
  const [gridOpen, setGridOpen] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [graded, setGraded] = useState(false)
  const [queued, setQueued] = useState(false)
  const [savedLocal, setSavedLocal] = useState(false)
  const [showTimer, setShowTimer] = useState(true)
  const countdown = timer.kind === "countdown" ? timer : null
  // Untimed: seconds the page was visible, continuing from what the draft saved.
  const [elapsed, setElapsed] = useState(timer.kind === "stopwatch" ? timer.initialSeconds : 0)
  const [clock, setClock] = useState(() =>
    countdown ? { deadline: new Date(countdown.deadline), offsetMs: new Date(countdown.serverNow).getTime() - Date.now() } : null,
  )
  const [timeUp, setTimeUp] = useState<null | "up" | "sending">(null)
  const elapsedRef = useRef(elapsed)
  useEffect(() => { elapsedRef.current = elapsed })
  const savedSeconds = useRef(elapsed)
  const hasDraft = useRef(Object.keys(initialAnswers).length > 0)
  const submitting = useRef(false)
  const handedIn = useRef(false)
  const mounted = useRef(true)
  const saveTimer = useRef<number>(undefined)
  const savedTimer = useRef<number>(undefined)
  const latest = useRef<Answers>(initialAnswers)
  const dirty = useRef(false)
  const queue = useRef<Promise<boolean>>(Promise.resolve(true))
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave })

  /** Untimed work time also needs saving when no answer changed (only once a draft exists). */
  const markTimeDirty = () => {
    if (timer.kind === "stopwatch" && hasDraft.current && elapsedRef.current - savedSeconds.current >= 5) dirty.current = true
  }

  /** Saves the latest answers if they changed; saves run one at a time. */
  const flush = () => {
    window.clearTimeout(saveTimer.current)
    if (!dirty.current) return queue.current
    dirty.current = false
    const snapshot = latest.current
    const seconds = elapsedRef.current
    setSaving(true)
    const mine = queue.current.then(async () => {
      const where = await onSaveRef.current(snapshot, seconds).catch(() => false as const)
      const ok = where !== false
      if (ok) setSavedLocal(where === "local")
      if (ok) {
        hasDraft.current = true
        savedSeconds.current = Math.max(savedSeconds.current, seconds)
      } else dirty.current = true
      return ok
    })
    queue.current = mine
    void mine.then((ok) => {
      if (queue.current !== mine) return
      setSaving(false)
      setSaveFailed(!ok)
      setJustSaved(ok)
      window.clearTimeout(savedTimer.current)
      if (ok) savedTimer.current = window.setTimeout(() => setJustSaved(false), 1400)
    })
    return mine
  }
  const flushRef = useRef(flush)
  useEffect(() => { flushRef.current = flush })
  const markTimeDirtyRef = useRef(markTimeDirty)
  useEffect(() => { markTimeDirtyRef.current = markTimeDirty })

  // Leaving any other way (back button, closing the tab) still saves.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden" || submitting.current) return
      markTimeDirtyRef.current()
      void flushRef.current()
    }
    mounted.current = true // StrictMode runs this effect twice
    document.addEventListener("visibilitychange", onHide)
    return () => {
      mounted.current = false
      document.removeEventListener("visibilitychange", onHide)
      window.clearTimeout(savedTimer.current)
      if (!submitting.current && !handedIn.current) {
        markTimeDirtyRef.current()
        void flushRef.current()
      }
    }
  }, [])

  // Correct the clock against the server once mounted; the deadline in the props may be from a cached page.
  const onResyncRef = useRef(onResync)
  useEffect(() => {
    const resync = onResyncRef.current
    if (!resync) return
    const sentAt = Date.now()
    void resync().then((fresh) => {
      if (!fresh || !mounted.current) return
      // Assume the server answered halfway through the round trip.
      const midpoint = (sentAt + Date.now()) / 2
      setClock({ deadline: new Date(fresh.deadline), offsetMs: new Date(fresh.serverNow).getTime() - midpoint })
    })
  }, [])

  useEffect(() => {
    // The stopwatch only runs while the child can see the page.
    const id = timer.kind === "stopwatch" ? window.setInterval(() => { if (document.visibilityState === "visible") setElapsed((s) => s + 1) }, 1000) : undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.clearInterval(id); document.body.style.overflow = prev }
  }, [timer.kind])

  const set = (id: string, v: unknown) => {
    latest.current = { ...latest.current, [id]: v }
    setAnswers(latest.current)
    dirty.current = true
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void flush(), SAVE_DELAY)
  }

  const exit = async () => {
    setExiting(true)
    markTimeDirty()
    const ok = await flush()
    setExiting(false)
    if (ok) return onExit()
    setConfirmExit(false)
    toast.error("Chưa lưu được bài làm. Em kiểm tra mạng rồi thử lại nhé!")
  }

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

  /**
   * Sends the work with the paper-plane animation; resolves false when it failed.
   * `quiet` (time-up retries): no sound, plane or error toast until it got through.
   */
  const handIn = async (quiet = false): Promise<boolean> => {
    submitting.current = true
    window.clearTimeout(saveTimer.current)
    dirty.current = false
    if (!quiet) {
      play("submit")
      setFlight("flying")
    }
    const flown = wait(quiet ? 0 : reduced ? 200 : 750)
    const send = queue.current.then(() => onSubmit(latest.current, elapsedRef.current, quiet))
    const result = await (quiet ? Promise.race([send, wait(TIME_UP_TRY_MS).then(() => null)]) : send).catch(() => null)
    await flown
    if (!result) {
      submitting.current = false
      setFlight("idle")
      return false
    }
    handedIn.current = true
    setFlight("done")
    // Kept on the device: the child reads the message and leaves with the button.
    if ("queued" in result) {
      setQueued(true)
      return true
    }
    setGraded(result.graded)
    await wait(reduced ? 800 : 1150)
    onSubmitted()
    return true
  }

  const submit = () => {
    setConfirmSubmit(false)
    void handIn()
  }

  // Exam mode: at zero the work is handed in as it is. Keep trying until it gets through (or the
  // server says it already has it); every try that reaches the server ends the screen.
  const onTimeUp = async () => {
    setConfirmSubmit(false)
    setConfirmExit(false)
    setGridOpen(false)
    setTimeUp("up")
    await wait(reduced ? 600 : 1600)
    while (submitting.current && mounted.current) await wait(200) // a manual submit was already on its way
    setTimeUp("sending")
    // Offline, the hand-in goes to the device's queue and is sent later.
    if (!navigator.onLine && (await handIn(true))) return
    for (let delay = 2000; mounted.current && !handedIn.current; delay = Math.min(delay * 2, 15_000)) {
      await online()
      if (await handIn(true)) return
      await wait(delay)
    }
  }

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
          <Button variant="ghost" size="icon" className="size-12 shrink-0 rounded-full [&_svg]:size-6" aria-label="Thoát" onClick={() => setConfirmExit(true)}>
            <X />
          </Button>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-bold", tone.text)}>{tone.name}</p>
            <h1 className="truncate text-lg font-extrabold text-slate-900 md:text-xl">{title}</h1>
          </div>
          <span className="flex min-w-24 items-center justify-end text-sm font-semibold text-slate-500" aria-live="polite">
            <AnimatePresence mode="wait">
              {saving ? (
                <motion.span key="saving" className="inline-flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 className="size-4 animate-spin" /><span className="hidden sm:inline">Đang lưu…</span>
                </motion.span>
              ) : justSaved ? (
                <motion.span key="saved" className="inline-flex items-center gap-1.5 text-emerald-600" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
                  <motion.span initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
                    <CloudCheck className="size-4" />
                  </motion.span>
                  {savedLocal ? <span className="hidden sm:inline">Đã lưu trên máy</span> : "Đã lưu"}
                </motion.span>
              ) : saveFailed ? (
                <motion.span key="failed" className="inline-flex items-center gap-1.5 text-amber-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <CloudAlert className="size-4" /><span className="hidden sm:inline">Chưa lưu được</span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
          {countdown && clock ? (
            <CountdownClock deadline={clock.deadline} offsetMs={clock.offsetMs} limitSeconds={countdown.limitMinutes * 60} onExpire={() => void onTimeUp()} />
          ) : (
            <StopwatchClock seconds={elapsed} hidden={!showTimer} onToggle={() => setShowTimer((v) => !v)} />
          )}
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
                <Button className="h-16 w-full rounded-2xl text-xl font-extrabold [&_svg]:size-6" onClick={() => setConfirmSubmit(true)}>
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
            <Button className="h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6" onClick={() => setConfirmSubmit(true)}>
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

      <Dialog open={confirmExit} onOpenChange={setConfirmExit}>
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Lưu và thoát?</DialogTitle>
            <DialogDescription className="text-base">
              {countdown
                ? "Bài làm của em đã được lưu. Đồng hồ vẫn chạy khi em thoát ra, hết giờ bài sẽ tự nộp."
                : "Bài làm của em đã được lưu. Lần sau em có thể làm tiếp từ chỗ này."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 text-base" onClick={() => setConfirmExit(false)}>Ở lại làm tiếp</Button>
            <Button className="h-12 text-base" disabled={exiting} onClick={() => void exit()}>
              {exiting && <Loader2 className="animate-spin" />}
              Lưu và thoát
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nộp bài nhé?</DialogTitle>
            <DialogDescription className="text-base">
              {missing ? `Em còn ${missing} câu chưa làm. Sau khi nộp em sẽ không sửa được nữa.` : "Sau khi nộp, bố mẹ sẽ chấm bài cho em."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 text-base" onClick={() => setConfirmSubmit(false)}>Kiểm tra lại</Button>
            <Button className="h-12 bg-emerald-600 text-base hover:bg-emerald-700" onClick={() => void submit()}>
              <Check />
              Nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Exam mode: time is up, inputs are blocked while the work is handed in. */}
      <AnimatePresence>
        {timeUp && (
          <motion.div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-white/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-label="Hết giờ"
          >
            <motion.div className="flex flex-col items-center gap-3 text-center" variants={pop} initial="initial" animate="animate">
              <motion.span
                className="text-8xl"
                aria-hidden
                animate={reduced ? undefined : { rotate: [0, -15, 15, -10, 10, 0] }}
                transition={{ duration: 0.6, repeat: timeUp === "up" ? 1 : 0 }}
              >
                ⏰
              </motion.span>
              <p className="text-4xl font-extrabold text-red-600">Hết giờ!</p>
              <p className="inline-flex items-center gap-2 text-lg text-slate-500">
                {timeUp === "sending" && <Loader2 className="size-5 animate-spin" />}
                {timeUp === "sending" ? "Đang nộp bài, em chờ chút nhé…" : "Bài của em sẽ được nộp ngay."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Submit: button morphs into a paper plane that flies away, then "Đã nộp!" */}
      <AnimatePresence>
        {flight !== "idle" && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-white/90 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {flight === "flying" ? (
              <motion.div
                className="flex h-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xl"
                initial={{ width: 320 }}
                animate={reduced ? { opacity: [1, 0] } : { width: [320, 64, 64], borderRadius: [16, 32, 32], x: [0, 0, 700], y: [0, 0, -500], rotate: [0, 0, -20], transition: { duration: 0.75, times: [0, 0.35, 1], ease: "easeIn" } }}
              >
                <span className="text-3xl" aria-hidden>✈️</span>
              </motion.div>
            ) : (
              <motion.div className="flex flex-col items-center gap-3 text-center" variants={pop} initial="initial" animate="animate">
                <span className="text-7xl" aria-hidden>📬</span>
                {queued ? (
                  <>
                    <p className="px-6 text-3xl font-extrabold text-emerald-700">Đã nộp — sẽ gửi khi có mạng</p>
                    <p className="text-lg text-slate-500">Bài làm đã lưu trên máy. Có mạng là bài tự gửi đi.</p>
                    <Button className="mt-2 h-14 rounded-2xl px-8 text-lg font-extrabold" onClick={onSubmitted}>
                      Về danh sách bài
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-extrabold text-emerald-700">Đã nộp!</p>
                    <p className="text-lg text-slate-500">{graded ? "Cùng xem điểm của em nào!" : "Bố mẹ sẽ chấm sớm nhé."}</p>
                  </>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
