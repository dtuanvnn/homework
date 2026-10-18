import { motion, useReducedMotion } from "motion/react"
import { tapOnly } from "@/lib/animations"
import { play, type SoundName } from "@/hooks/useSound"
import { cn } from "@/lib/utils"

/** Wraps a big button: spring press + soft tap sound. */
export default function Press({ children, className, sound = "tap" }: { children: React.ReactNode; className?: string; sound?: SoundName | null }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={cn("w-full", className)}
      {...tapOnly(reduced)}
      onPointerDown={(e) => {
        const btn = (e.target as HTMLElement).closest("button")
        if (sound && btn && !btn.disabled) play(sound)
      }}
    >
      {children}
    </motion.div>
  )
}
