"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useAnimate, useReducedMotion } from "motion/react"
import NumberFlow, { NumberFlowGroup } from "@number-flow/react"
import { Timer } from "lucide-react"
import { toast } from "sonner"
import { play } from "@/hooks/useSound"
import { clockLabel, remainingSeconds, warningLevel, type WarningLevel } from "@/lib/timer"
import { cn } from "@/lib/utils"

const RANK: Record<WarningLevel, number> = { none: 0, warn: 1, urgent: 2, final: 3 }

const LOOK: Record<WarningLevel, { pill: string; ring: string }> = {
  none: { pill: "bg-slate-100 text-slate-700", ring: "stroke-emerald-500" },
  warn: { pill: "bg-amber-100 text-amber-800", ring: "stroke-amber-500" },
  urgent: { pill: "bg-red-100 text-red-700", ring: "stroke-red-500" },
  final: { pill: "bg-red-600 text-white", ring: "stroke-white" },
}

/** mm:ss with digits that roll as they change. */
function Digits({ seconds, trend }: { seconds: number; trend: 1 | -1 }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return (
    <NumberFlowGroup>
      <span className="inline-flex items-baseline tabular-nums" aria-hidden>
        {h > 0 && <NumberFlow trend={trend} value={h} suffix=":" />}
        <NumberFlow trend={trend} value={m} format={{ minimumIntegerDigits: 2 }} digits={h > 0 ? { 1: { max: 5 } } : undefined} />
        <NumberFlow trend={trend} value={s} prefix=":" format={{ minimumIntegerDigits: 2 }} digits={{ 1: { max: 5 } }} />
      </span>
    </NumberFlowGroup>
  )
}

/**
 * Exam-mode countdown. The deadline comes from the server and `offsetMs`
 * corrects the device clock, so a wrong iPad time can't add or remove minutes.
 * Warns at 5 min (or 20 % of a short limit) and 1 min, ticks for the last 10 s,
 * and calls onExpire once at zero.
 */
export function CountdownClock({
  deadline,
  offsetMs,
  limitSeconds,
  onExpire,
}: {
  deadline: Date
  offsetMs: number
  limitSeconds: number
  onExpire: () => void
}) {
  const reduced = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [remaining, setRemaining] = useState(() => remainingSeconds(deadline, new Date(Date.now() + offsetMs)))
  const level = warningLevel(remaining, limitSeconds)
  const shownLevel = useRef<WarningLevel | null>(null)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire })

  // Re-derive from the deadline on every tick, so a tab that slept catches up at once.
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(remainingSeconds(deadline, new Date(Date.now() + offsetMs))), 250)
    return () => window.clearInterval(id)
  }, [deadline, offsetMs])

  // Each level announces itself once; resuming past several levels only announces the current one.
  useEffect(() => {
    const before = shownLevel.current
    shownLevel.current = level
    if (before !== null && RANK[level] <= RANK[before]) return
    if (level === "warn") {
      play("warn")
      toast.warning(`Còn ${Math.ceil(remaining / 60)} phút nữa!`, { description: "Em xem lại những câu chưa làm nhé." })
      if (!reduced && scope.current) void animate(scope.current, { x: [0, -6, 6, -4, 4, 0], rotate: [0, -3, 3, -2, 2, 0] }, { duration: 0.5 })
    } else if (level === "urgent") {
      play("urgent")
      toast.warning("Còn 1 phút!", { description: "Em kiểm tra lại bài nhé." })
    }
  }, [level, remaining, reduced, animate, scope])

  useEffect(() => {
    if (level === "final" && remaining > 0) play("tick")
    if (remaining === 0 && !expired.current) {
      expired.current = true
      onExpireRef.current()
    }
  }, [level, remaining])

  const look = LOOK[level]
  const fraction = limitSeconds > 0 ? remaining / limitSeconds : 0
  return (
    <motion.div
      ref={scope}
      role="timer"
      aria-label={`Còn ${clockLabel(remaining)}`}
      className={cn("inline-flex h-11 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-lg font-extrabold transition-colors duration-500", look.pill)}
      animate={level === "urgent" && !reduced ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={level === "urgent" ? { duration: 1, repeat: Infinity } : undefined}
    >
      <svg viewBox="0 0 32 32" className="size-8 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r="12" fill="none" strokeWidth="4" className="stroke-current opacity-15" />
        <motion.circle
          cx="16"
          cy="16"
          r="12"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={cn("transition-[stroke] duration-500", look.ring)}
          initial={false}
          animate={{ pathLength: fraction }}
          transition={{ duration: reduced ? 0 : 0.4, ease: "linear" }}
        />
      </svg>
      <motion.span
        key={level === "final" ? remaining : "steady"}
        initial={level === "final" && !reduced ? { scale: 1.35 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="inline-flex"
      >
        <Digits seconds={remaining} trend={-1} />
      </motion.span>
    </motion.div>
  )
}

/** Untimed work: a stopwatch the child may hide. */
export function StopwatchClock({ seconds, hidden, onToggle }: { seconds: number; hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? "Hiện đồng hồ" : `Đã làm ${clockLabel(seconds)}. Ẩn đồng hồ`}
      className="inline-flex h-11 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-base font-bold text-slate-700"
    >
      <Timer className="size-5" />
      {!hidden && <Digits seconds={seconds} trend={1} />}
    </button>
  )
}
