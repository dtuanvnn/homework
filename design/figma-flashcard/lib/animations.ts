/**
 * Shared animation presets for the whole app.
 * Student mode uses the playful presets; parent mode only uses `parentPage`.
 * Every component should read `useReducedMotion()` and pass it to the helpers
 * so motion becomes a plain fade when the OS asks for less motion.
 */
import confetti from "canvas-confetti"
import type { Transition, Variants } from "motion/react"

export const spring: Transition = { type: "spring", stiffness: 420, damping: 28 }
export const softSpring: Transition = { type: "spring", stiffness: 260, damping: 22 }
export const bouncy: Transition = { type: "spring", stiffness: 500, damping: 15 }
export const fast: Transition = { duration: 0.2, ease: "easeOut" }

const fade: Variants = { initial: { opacity: 0 }, animate: { opacity: 1, transition: fast }, exit: { opacity: 0, transition: { duration: 0.15 } } }

/* ---------- Pages ---------- */

export const studentPage = (reduced: boolean | null): Variants =>
  reduced
    ? fade
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0, transition: { ...softSpring, duration: 0.3 } },
        exit: { opacity: 0, x: -16, transition: { duration: 0.15 } },
      }

/** Parent mode: calm, fade only. */
export const parentPage: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

/* ---------- Lists ---------- */

export const STAGGER = 0.04

export const list: Variants = { initial: {}, animate: { transition: { staggerChildren: STAGGER } } }

export const listItem = (reduced: boolean | null): Variants =>
  reduced
    ? fade
    : {
        initial: { opacity: 0, y: 16, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1, transition: spring },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
      }

/* ---------- Press / hover ---------- */

/** Spread onto any motion element that acts as a card or big button. */
export const pressable = (reduced: boolean | null) =>
  reduced
    ? {}
    : {
        whileTap: { scale: 0.96 },
        whileHover: { y: -3, boxShadow: "0 10px 24px -12px rgba(79,70,229,0.35)" },
        transition: spring,
      }

export const tapOnly = (reduced: boolean | null) => (reduced ? {} : { whileTap: { scale: 0.96 }, transition: spring })

/* ---------- Question slides (direction: 1 = next, -1 = previous) ---------- */

export const questionSlide = (reduced: boolean | null): Variants =>
  reduced
    ? fade
    : {
        initial: (dir: number) => ({ x: dir * 80, opacity: 0 }),
        animate: { x: 0, opacity: 1, transition: { ...spring, opacity: { duration: 0.15 } } },
        exit: (dir: number) => ({ x: dir * -80, opacity: 0, transition: { duration: 0.15 } }),
      }

/* ---------- Small effects ---------- */

export const pop: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: bouncy },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
}

export const starPop = (i: number, reduced: boolean | null): Variants =>
  reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay: i * 0.15 } } }
    : {
        initial: { scale: 0, rotate: -90, opacity: 0 },
        animate: { scale: 1, rotate: 0, opacity: 1, transition: { ...bouncy, delay: 0.9 + i * 0.25 } },
      }

export const shake = { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } }

/** One gentle red pulse for overdue cards (not looping). */
export const latePulse = {
  boxShadow: ["0 0 0 0 rgba(239,68,68,0)", "0 0 0 8px rgba(239,68,68,0.25)", "0 0 0 0 rgba(239,68,68,0)"],
  transition: { duration: 0.6, delay: 0.3 },
}

/* ---------- Confetti ---------- */

const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f97316", "#ec4899", "#3b82f6"]

export function celebrate(size: "big" | "small" = "big") {
  if (prefersReduced()) return
  if (size === "small") {
    confetti({ particleCount: 40, spread: 60, startVelocity: 30, origin: { y: 0.4 }, colors: COLORS, scalar: 0.9 })
    return
  }
  const fire = (ratio: number, opts: confetti.Options) =>
    confetti({ origin: { y: 0.55 }, colors: COLORS, ...opts, particleCount: Math.floor(160 * ratio) })
  fire(0.25, { spread: 26, startVelocity: 55 })
  fire(0.2, { spread: 60 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
}
