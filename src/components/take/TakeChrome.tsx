"use client"

import { AnimatePresence, motion } from "motion/react"
import { Check, CloudAlert, CloudCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pop } from "@/lib/animations"
import { CountdownClock, StopwatchClock } from "./CountdownClock"
import type { TakeSession } from "./use-take-session"

/*
 * Pieces of the take screens around the work itself, driven by useTakeSession:
 * the save indicator and clock in the top bar, "Lưu và thoát?" / "Nộp bài
 * nhé?", and the time-up and paper-plane overlays.
 */

export function SaveStatus({ session: s }: { session: TakeSession }) {
  const { saving, justSaved, saveFailed, savedLocal } = s.status
  return (
    <span className="flex min-w-24 items-center justify-end text-sm font-semibold text-slate-500" aria-live="polite">
      <AnimatePresence mode="wait">
        {saving ? (
          <motion.span key="saving" className="inline-flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader2 className="size-4 animate-spin" /><span className="hidden sm:inline">Đang lưu…</span>
          </motion.span>
        ) : justSaved ? (
          <motion.span key="saved" className="inline-flex items-center gap-1.5 text-emerald-600" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
            <motion.span initial={s.reduced ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
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
  )
}

export function TakeClock({ session: s }: { session: TakeSession }) {
  return s.countdown && s.clock ? (
    <CountdownClock deadline={s.clock.deadline} offsetMs={s.clock.offsetMs} limitSeconds={s.countdown.limitMinutes * 60} onExpire={() => void s.onTimeUp()} />
  ) : (
    <StopwatchClock seconds={s.elapsed} hidden={!s.showTimer} onToggle={() => s.setShowTimer((v) => !v)} />
  )
}

/** "Lưu và thoát?" and "Nộp bài nhé?" (`submitText` says what is still missing). */
export function TakeDialogs({ session: s, submitText }: { session: TakeSession; submitText: string }) {
  return (
    <>
      <Dialog open={s.confirmExit} onOpenChange={s.setConfirmExit}>
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Lưu và thoát?</DialogTitle>
            <DialogDescription className="text-base">
              {s.countdown
                ? "Bài làm của em đã được lưu. Đồng hồ vẫn chạy khi em thoát ra, hết giờ bài sẽ tự nộp."
                : "Bài làm của em đã được lưu. Lần sau em có thể làm tiếp từ chỗ này."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 text-base" onClick={() => s.setConfirmExit(false)}>Ở lại làm tiếp</Button>
            <Button className="h-12 text-base" disabled={s.exiting} onClick={() => void s.exit()}>
              {s.exiting && <Loader2 className="animate-spin" />}
              Lưu và thoát
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={s.confirmSubmit} onOpenChange={s.setConfirmSubmit}>
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nộp bài nhé?</DialogTitle>
            <DialogDescription className="text-base">{submitText}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 text-base" onClick={() => s.setConfirmSubmit(false)}>Kiểm tra lại</Button>
            <Button className="h-12 bg-emerald-600 text-base hover:bg-emerald-700" onClick={() => void s.submit()}>
              <Check />
              Nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Exam time-up screen and the paper plane that flies away on hand-in, then "Đã nộp!". */
export function TakeOverlays({ session: s }: { session: TakeSession }) {
  const { reduced, timeUp, flight, queued, graded } = s
  return (
    <>
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
                    <Button className="mt-2 h-14 rounded-2xl px-8 text-lg font-extrabold" onClick={s.onSubmitted}>
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
    </>
  )
}
