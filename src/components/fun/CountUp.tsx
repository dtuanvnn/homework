import { useEffect, useRef } from "react"
import { animate, useReducedMotion } from "motion/react"

/** Animates a number from its previous value (or `from`) to `value`. Vietnamese formatting. */
export default function CountUp({ value, from, duration = 0.6, digits = 0, delay = 0, onDone, className }: { value: number; from?: number; duration?: number; digits?: number; delay?: number; onDone?: () => void; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(from ?? value)
  const reduced = useReducedMotion()
  const fmt = (n: number) => n.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: digits })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = fmt(value)
      prev.current = value
      onDone?.()
      return
    }
    const step = digits ? 1 / 10 ** digits : 1
    const controls = animate(prev.current, value, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => { el.textContent = fmt(Math.round(v / step) * step) },
      onComplete: () => onDone?.(),
    })
    prev.current = value
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced])

  return <span ref={ref} className={className}>{fmt(from ?? value)}</span>
}
