import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

/** Friendly fox mascot. `mood="cheer"` bounces, `mood="thumbs"` gives a kind thumbs up. */
export default function Mascot({ mood = "cheer", className }: { mood?: "cheer" | "thumbs"; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <div className={cn("relative inline-flex items-end", className)} aria-hidden>
      <motion.span
        className="text-7xl"
        initial={reduced ? { opacity: 0 } : { y: 30, opacity: 0, scale: 0.6 }}
        animate={
          reduced
            ? { opacity: 1 }
            : mood === "cheer"
              ? { y: [0, -18, 0, -10, 0], opacity: 1, scale: 1, transition: { duration: 1.2, times: [0, 0.3, 0.55, 0.75, 1] } }
              : { y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 14 } }
        }
      >
        🦊
      </motion.span>
      {mood === "thumbs" && (
        <motion.span
          className="-ml-3 text-5xl"
          initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -40 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, rotate: [0, -12, 8, 0], transition: { delay: 0.4, duration: 0.6 } }}
        >
          👍
        </motion.span>
      )}
    </div>
  )
}
