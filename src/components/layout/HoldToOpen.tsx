"use client"

import { useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const HOLD_MS = 2000
const MOVE_TOLERANCE = 10

/**
 * Wraps the student avatar: pressing and holding it for 2 s calls onOpen. A
 * short tap does nothing and nothing hints at the gesture, so children don't
 * find their way into parent mode by tapping around.
 */
export default function HoldToOpen({ onOpen, children, className }: { onOpen: () => void; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
    setHolding(false)
  }

  return (
    <div
      data-testid="hold-to-open"
      className={cn("relative touch-none select-none", className)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY }
        setHolding(true)
        timer.current = window.setTimeout(() => {
          cancel()
          onOpen()
        }, HOLD_MS)
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) cancel()
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      {children}
      {holding && (
        <svg className="pointer-events-none absolute -inset-1 size-[calc(100%+8px)] -rotate-90 text-indigo-500" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="100.5"
            strokeDashoffset={reduced ? 0 : 100.5}
            style={reduced ? undefined : { animation: `hold-fill ${HOLD_MS}ms linear forwards` }}
          />
        </svg>
      )}
    </div>
  )
}
