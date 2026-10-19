"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Grid3x3, PenLine, RotateCcw, Send, Snail, Turtle, Volume2, X, Zap } from "lucide-react"
import Press from "@/components/fun/Press"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import InkStrip from "@/components/ink/InkStrip"
import { play } from "@/hooks/useSound"
import { celebrate, questionSlide, softSpring } from "@/lib/animations"
import { canWrite, hasInk, loadStudy, saveStudy } from "@/lib/flashcard-study"
import type { Ink } from "@/lib/ink"
import { NO_VOICE, SPEEDS, speak, stopSpeaking, useEnglishVoice, type SpeedId } from "@/lib/speech"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { SubjectId } from "@/lib/types"
import type { TakeQuestion } from "@/lib/views/student"
import { SaveStatus, TakeClock, TakeDialogs, TakeOverlays } from "./TakeChrome"
import { useTakeSession, type TakeSessionProps } from "./use-take-session"

/*
 * Flashcard take screen (spec: docs/superpowers/specs/2026-10-19-vocab-flashcard-design.md).
 * 1. Học từ: flip cards (word / English explanation) read aloud at three speeds.
 * 2. Viết từ: the explanation and the audio only — the word is never shown —
 *    and a handwriting strip per word. Saving and handing in are the usual
 *    take-screen session (useTakeSession), so drafts and offline work as for
 *    any web homework.
 */

type Word = Extract<TakeQuestion, { type: "tu-vung" }>
type Phase = "learn" | "write"

const SPEED_ICONS: Record<SpeedId, typeof Zap> = { normal: Zap, slow: Turtle, "very-slow": Snail }
/** Swipe distance (px) that turns a study card. */
const SWIPE = 80

export default function TakeFlashcards({
  title,
  subject,
  questions,
  studyKey,
  ...sessionProps
}: TakeSessionProps & {
  title: string
  subject: SubjectId
  questions: TakeQuestion[]
  /** Where this attempt's study marks are kept on the device (lib/flashcard-study.ts). */
  studyKey: string
}) {
  const tone = SUBJECTS[subject]
  const words = questions.filter((q): q is Word => q.type === "tu-vung")
  const ids = words.map((w) => w.id)
  const total = words.length
  const [gridOpen, setGridOpen] = useState(false)
  const session = useTakeSession(sessionProps, () => setGridOpen(false))
  const { answers, set, reduced } = session

  const [studied, setStudied] = useState<Set<string>>(() => new Set(loadStudy(studyKey)))
  const [phase, setPhase] = useState<Phase>(() => (ids.some((id) => hasInk(answers[id])) ? "write" : "learn"))
  const [learnIndex, setLearnIndex] = useState(0)
  const [writeIndex, setWriteIndex] = useState(0) // total = review screen
  const [dir, setDir] = useState(1)
  const [flipped, setFlipped] = useState(false)
  const [speaking, setSpeaking] = useState<SpeedId | null>(null)
  const hasVoice = useEnglishVoice()

  const writtenCount = words.filter((w) => hasInk(answers[w.id])).length
  const blank = total - writtenCount
  const studiedCount = ids.filter((id) => studied.has(id)).length
  const writeOpen = canWrite(ids, studied, answers)
  const allStudied = studiedCount === total
  const progress = ((studiedCount + writtenCount) / Math.max(1, total * 2)) * 100

  // Leaving stops the voice; so does moving to another card or phase (quiet()).
  useEffect(() => () => stopSpeaking(), [])
  const quiet = () => {
    stopSpeaking()
    setSpeaking(null)
  }

  const say = (word: string, id: SpeedId, rate: number) => {
    play("tap")
    speak(word, rate, { start: () => setSpeaking(id), end: () => setSpeaking((s) => (s === id ? null : s)) })
  }

  const goLearn = (i: number) => {
    if (i < 0 || i >= total || i === learnIndex) return
    play("next")
    quiet()
    setDir(i > learnIndex ? 1 : -1)
    setFlipped(false)
    setLearnIndex(i)
  }
  const goWrite = (i: number) => {
    if (i < 0 || i > total || i === writeIndex) return
    play("next")
    quiet()
    setDir(i > writeIndex ? 1 : -1)
    setWriteIndex(i)
  }

  const markStudied = () => {
    const card = words[learnIndex]
    const next = new Set(studied).add(card.id)
    setStudied(next)
    saveStudy(studyKey, next)
    play("correct")
    if (ids.every((id) => next.has(id))) {
      if (!reduced) celebrate("small")
      return
    }
    // Next card not learned yet, wrapping around.
    const after = [...ids.slice(learnIndex + 1), ...ids.slice(0, learnIndex)].find((id) => !next.has(id))
    if (after) goLearn(ids.indexOf(after))
  }

  const startWriting = () => {
    play("star")
    quiet()
    setDir(1)
    setPhase("write")
    setWriteIndex(Math.max(0, words.findIndex((w) => !hasInk(answers[w.id]))))
  }
  const openLearn = () => {
    play("tap")
    quiet()
    setDir(-1)
    setFlipped(false)
    setPhase("learn")
  }

  const word = words[learnIndex]
  const writing = phase === "write" ? words[writeIndex] : undefined
  const reviewing = phase === "write" && writeIndex === total

  const speakers = (text: string) => (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Nghe đọc từ">
      {SPEEDS.map((s) => {
        const Icon = SPEED_ICONS[s.id]
        const active = speaking === s.id
        return (
          <button
            key={s.id}
            type="button"
            disabled={!hasVoice}
            title={hasVoice ? undefined : NO_VOICE}
            aria-label={`Nghe đọc từ – ${s.label}`}
            onClick={() => say(text, s.id, s.rate)}
            className={cn(
              "relative flex min-h-16 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border-2 bg-white text-base font-bold transition active:scale-95 disabled:opacity-40",
              active ? "border-indigo-500 text-indigo-700" : "border-slate-200 text-slate-700 hover:border-indigo-300",
            )}
          >
            {active && !reduced && <motion.span className="absolute inset-0 bg-indigo-100" animate={{ opacity: [0.8, 0.2, 0.8] }} transition={{ repeat: Infinity, duration: 1 }} />}
            <span className="relative flex items-center gap-1.5">
              <Volume2 className="size-5" />
              <Icon className="size-5" />
            </span>
            <span className="relative">{s.label}</span>
          </button>
        )
      })}
      {!hasVoice && <p className="col-span-3 text-center text-sm text-slate-500">{NO_VOICE}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-indigo-50 to-white" role="dialog" aria-modal aria-label={`Làm bài: ${title}`}>
      <header className="border-b border-indigo-100 bg-white/90 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button variant="ghost" size="icon" className="size-12 shrink-0 rounded-full [&_svg]:size-6" aria-label="Thoát" onClick={() => session.setConfirmExit(true)}>
            <X />
          </Button>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-bold", tone.text)}>{tone.name} · Từ vựng</p>
            <h1 className="truncate text-lg font-extrabold text-slate-900 md:text-xl">{title}</h1>
          </div>
          <SaveStatus session={session} />
          <TakeClock session={session} />
        </div>
        <div className="mx-auto mt-3 h-2.5 max-w-3xl overflow-hidden rounded-full bg-indigo-100" role="progressbar" aria-label="Tiến độ" aria-valuenow={Math.round(progress)} aria-valuemax={100}>
          <motion.div className="h-full rounded-full bg-indigo-500" initial={false} animate={{ width: `${progress}%` }} transition={reduced ? { duration: 0.2 } : softSpring} />
        </div>
        <div className="mx-auto mt-3 grid max-w-3xl grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Phần">
          {(["learn", "write"] as const).map((p) => {
            const locked = p === "write" && !writeOpen
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={phase === p}
                disabled={locked}
                title={locked ? "Em học thuộc hết các thẻ rồi viết từ nhé" : undefined}
                onClick={() => (p === phase ? undefined : p === "write" ? startWriting() : openLearn())}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-xl text-base font-bold transition",
                  phase === p ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500",
                  locked && "opacity-50",
                )}
              >
                {p === "learn" ? <BookOpen className="size-5" /> : <PenLine className="size-5" />}
                {p === "learn" ? "1. Học từ" : "2. Viết từ"}
              </button>
            )
          })}
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 md:py-8">
          <div className="flex items-center justify-between text-base font-semibold text-slate-500">
            <span className="tabular-nums">{phase === "learn" ? `Thẻ ${learnIndex + 1}/${total}` : reviewing ? "Xem lại" : `Từ ${writeIndex + 1}/${total}`}</span>
            <span className="text-indigo-600 tabular-nums">{phase === "learn" ? `Đã thuộc ${studiedCount}/${total}` : `Đã viết ${writtenCount}/${total}`}</span>
          </div>

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            {phase === "learn" ? (
              <motion.div key={`learn-${word.id}`} custom={dir} variants={questionSlide(reduced)} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-4">
                <FlipCard
                  word={word}
                  flipped={flipped}
                  studied={studied.has(word.id)}
                  reduced={!!reduced}
                  onFlip={() => {
                    play("tap")
                    setFlipped((f) => !f)
                  }}
                  onSwipe={(d) => goLearn(learnIndex + d)}
                />
                {speakers(word.word)}
              </motion.div>
            ) : reviewing ? (
              <motion.div key="review" custom={dir} variants={questionSlide(reduced)} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center gap-6 text-center">
                <span className="text-6xl" aria-hidden>{blank ? "🧐" : "🎉"}</span>
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Đã viết {writtenCount}/{total} từ</h2>
                  <p className="mt-2 text-lg text-slate-500">{blank ? `Còn ${blank} từ chưa viết. Chạm vào ô màu xám để viết tiếp, hoặc nộp bài luôn.` : "Em đã viết hết các từ. Nộp bài thôi!"}</p>
                </div>
                <WordGrid words={words} answers={answers} current={-1} onPick={goWrite} />
                <Press className="w-full max-w-sm">
                  <Button className="h-16 w-full rounded-2xl text-xl font-extrabold [&_svg]:size-6" onClick={() => session.setConfirmSubmit(true)}>
                    <Send />
                    Nộp bài
                  </Button>
                </Press>
              </motion.div>
            ) : (
              writing && (
                <motion.div key={`write-${writing.id}`} custom={dir} variants={questionSlide(reduced)} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-4">
                  <div className="relative rounded-3xl border-2 border-indigo-100 bg-white p-5 shadow-sm md:p-6">
                    <p className="text-sm font-bold text-indigo-500">Nghe và đọc giải thích, rồi viết từ đó:</p>
                    <p className="mt-2 text-2xl leading-relaxed font-semibold text-slate-900 md:text-3xl" lang="en">
                      {writing.prompt}
                    </p>
                    <span className="absolute -bottom-2.5 left-10 size-5 rotate-45 border-r-2 border-b-2 border-indigo-100 bg-white" aria-hidden />
                  </div>
                  {speakers(writing.word)}
                  <InkStrip
                    key={writing.id}
                    label={`Khung viết từ ${writeIndex + 1}`}
                    paper="o-li"
                    ink={(answers[writing.id] as { ink?: Ink } | undefined)?.ink}
                    onChange={(ink) => set(writing.id, { text: "", ink })}
                  />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="border-t bg-white px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:px-6">
        {phase === "learn" ? (
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <Button variant="outline" className="h-14 shrink-0 rounded-2xl px-4 text-base font-bold [&_svg]:size-6" disabled={learnIndex === 0} onClick={() => goLearn(learnIndex - 1)} aria-label="Từ trước">
              <ChevronLeft />
              <span className="hidden sm:inline">Từ trước</span>
            </Button>
            {allStudied ? (
              <Button className="h-14 flex-1 rounded-2xl bg-indigo-600 text-lg font-bold [&_svg]:size-6" onClick={startWriting}>
                Sang phần Viết từ
                <PenLine />
              </Button>
            ) : (
              <Button className="h-14 flex-1 rounded-2xl bg-indigo-600 text-lg font-bold [&_svg]:size-6" onClick={markStudied} disabled={studied.has(word.id)}>
                <Check />
                {studied.has(word.id) ? "Đã thuộc" : "Em thuộc rồi"}
              </Button>
            )}
            <Button variant="outline" className="h-14 shrink-0 rounded-2xl px-4 text-base font-bold [&_svg]:size-6" disabled={learnIndex === total - 1} onClick={() => goLearn(learnIndex + 1)} aria-label="Từ tiếp">
              <span className="hidden sm:inline">Từ tiếp</span>
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl items-center gap-2 md:gap-3">
            <Button variant="outline" className="h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6" disabled={writeIndex === 0} onClick={() => goWrite(writeIndex - 1)}>
              <ChevronLeft />
              Câu trước
            </Button>
            <Button variant="outline" className="h-14 shrink-0 rounded-2xl px-4 text-base font-bold [&_svg]:size-6" onClick={() => setGridOpen(true)} aria-label="Danh sách từ">
              <Grid3x3 />
              <span className="tabular-nums">{writtenCount}/{total}</span>
            </Button>
            {reviewing ? (
              <Button className="h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6" onClick={() => session.setConfirmSubmit(true)}>
                Nộp bài
                <Send />
              </Button>
            ) : (
              <Button
                className={cn("h-14 flex-1 rounded-2xl text-lg font-bold transition-transform active:scale-95 [&_svg]:size-6", writeIndex === total - 1 && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => goWrite(writeIndex + 1)}
              >
                {writeIndex === total - 1 ? "Xem lại" : "Câu tiếp"}
                <ChevronRight />
              </Button>
            )}
          </div>
        )}
      </footer>

      <Sheet open={gridOpen} onOpenChange={setGridOpen}>
        <SheetContent className="z-[60]">
          <SheetHeader>
            <SheetTitle className="text-xl">Danh sách từ</SheetTitle>
            <SheetDescription className="text-base">Đã viết {writtenCount}/{total} từ</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <WordGrid
              words={words}
              answers={answers}
              current={writeIndex}
              onPick={(i) => {
                goWrite(i)
                setGridOpen(false)
              }}
            />
            <div className="mt-4 flex justify-center gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-indigo-500" />Đã viết</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-slate-200" />Chưa viết</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-indigo-600" />Đang viết</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TakeDialogs session={session} submitText={blank ? `Em còn ${blank} từ chưa viết – từ chưa viết sẽ tính là sai. Sau khi nộp em sẽ không sửa được nữa.` : "Sau khi nộp, bố mẹ sẽ chấm bài cho em."} />
      <TakeOverlays session={session} />
    </div>
  )
}

function FlipCard({
  word,
  flipped,
  studied,
  reduced,
  onFlip,
  onSwipe,
}: {
  word: Word
  flipped: boolean
  studied: boolean
  reduced: boolean
  onFlip: () => void
  onSwipe: (direction: 1 | -1) => void
}) {
  // A swipe must not also flip the card.
  const dragged = useRef(false)
  const face = "absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-6 text-center shadow-lg [backface-visibility:hidden]"
  return (
    <motion.button
      type="button"
      onClick={() => {
        if (dragged.current) return
        onFlip()
      }}
      aria-label={flipped ? "Lật lại xem từ" : "Lật thẻ xem giải thích"}
      className="block w-full touch-pan-y [perspective:1200px]"
      drag={reduced ? false : "x"}
      dragSnapToOrigin
      dragElastic={0.4}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x <= -SWIPE) onSwipe(1)
        else if (info.offset.x >= SWIPE) onSwipe(-1)
        window.setTimeout(() => {
          dragged.current = false
        }, 0)
      }}
    >
      <motion.div
        className="relative h-72 w-full [transform-style:preserve-3d] md:h-96"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className={cn(face, "bg-gradient-to-br from-indigo-500 to-violet-600 text-white")} aria-hidden={flipped}>
          {studied && (
            <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
              <Check className="size-4" /> Đã thuộc
            </span>
          )}
          <p className="text-5xl font-extrabold tracking-tight break-words md:text-7xl" lang="en">
            {word.word}
          </p>
          <p className="mt-6 flex items-center gap-1.5 text-base text-indigo-100">
            <RotateCcw className="size-4" /> Chạm để lật thẻ
          </p>
        </div>
        <div className={cn(face, "border-2 border-indigo-100 bg-white [transform:rotateY(180deg)]")} aria-hidden={!flipped}>
          <p className="text-base font-bold tracking-wide text-indigo-500" lang="en">
            {word.word}
          </p>
          <p className="mt-3 text-2xl leading-relaxed font-semibold text-slate-800 md:text-3xl" lang="en">
            {word.prompt}
          </p>
        </div>
      </motion.div>
    </motion.button>
  )
}

function WordGrid({ words, answers, current, onPick }: { words: Word[]; answers: Record<string, unknown>; current: number; onPick: (i: number) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2.5">
      {words.map((w, i) => {
        const done = hasInk(answers[w.id])
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Từ ${i + 1}${done ? ", đã viết" : ", chưa viết"}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-2xl text-xl font-extrabold tabular-nums transition-[transform,background-color] active:scale-90",
              done ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600",
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
