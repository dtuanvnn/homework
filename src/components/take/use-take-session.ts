"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { play } from "@/hooks/useSound"

/*
 * The take screens' work session, shared by TakeAssignment (questions) and
 * TakeFlashcards (word cards): debounced autosave in order, the stopwatch or
 * the exam countdown, handing in with the paper-plane animation, and the
 * automatic hand-in when time runs out.
 */

export type Answers = Record<string, unknown>

/**
 * Exam mode counts down to a server deadline (`serverNow` corrects the device
 * clock); untimed work counts up from the seconds already saved with the draft.
 */
export type TakeTimer =
  | { kind: "countdown"; deadline: string; serverNow: string; limitMinutes: number }
  | { kind: "stopwatch"; initialSeconds: number }

/** Props both take screens receive from TakeRoute. */
export interface TakeSessionProps {
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
}

/** Debounce before an autosave after the last change. */
const SAVE_DELAY = 800
/** A hand-in try after time ran out counts as failed after this long (the network may hang). */
const TIME_UP_TRY_MS = 20_000
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
/** Resolves when the browser is (back) online. */
const online = () =>
  navigator.onLine ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("online", () => r(), { once: true }))

export function useTakeSession(
  { initialAnswers = {}, timer, onSave, onExit, onSubmit, onSubmitted, onResync }: TakeSessionProps,
  /** Closes the screen's own sheets and dialogs when time runs out. */
  onTimeUpStart?: () => void,
) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers)
  const reduced = useReducedMotion()
  const [justSaved, setJustSaved] = useState(false)
  const [flight, setFlight] = useState<"idle" | "flying" | "done">("idle")
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
    onTimeUpStart?.()
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

  return {
    answers,
    set,
    reduced,
    elapsed,
    countdown,
    clock,
    showTimer,
    setShowTimer,
    status: { saving, justSaved, saveFailed, savedLocal },
    flight,
    graded,
    queued,
    timeUp,
    confirmExit,
    setConfirmExit,
    confirmSubmit,
    setConfirmSubmit,
    exiting,
    exit,
    submit,
    onTimeUp,
    onSubmitted,
  }
}

export type TakeSession = ReturnType<typeof useTakeSession>
