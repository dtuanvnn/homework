"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { play } from "@/hooks/useSound"
import { celebrate } from "@/lib/animations"
import type { Celebration } from "@/lib/rewards/badges"
import { markBadgesSeen } from "@/server/actions/rewards"

/**
 * New badges and streak milestones, celebrated once on the Today page. An
 * in-page card rather than a modal, so it never blocks the day's work.
 */
export default function CelebrationCard({ items }: { items: Celebration[] }) {
  const reduced = useReducedMotion()
  const key = items.map((i) => i.id).join(",")
  const [dismissed, setDismissed] = useState<string | null>(null)
  const open = !!key && dismissed !== key

  useEffect(() => {
    if (!key) return
    play("celebrate")
    celebrate("big")
  }, [key])

  const dismiss = () => {
    setDismissed(key)
    play("tap")
    void markBadgesSeen(items.map((i) => i.id))
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex flex-col gap-4 rounded-[28px] border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-pink-50 p-5 md:p-6"
          aria-label="Chúc mừng"
        >
          <p className="text-2xl font-extrabold text-amber-700">Chúc mừng em! 🎉</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((c, i) => (
              <motion.li
                key={c.id}
                initial={reduced ? false : { opacity: 0, scale: 0.6, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: reduced ? 0 : 0.2 + i * 0.15, type: "spring", stiffness: 400, damping: 14 }}
                className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm"
              >
                <span className="text-5xl" aria-hidden>{c.emoji}</span>
                <div className="min-w-0">
                  <p className="text-lg leading-snug font-extrabold text-slate-900">{c.title}</p>
                  <p className="text-base text-slate-600">{c.description}</p>
                </div>
              </motion.li>
            ))}
          </ul>
          <Button className="h-12 self-center rounded-2xl bg-amber-500 px-8 text-lg font-bold hover:bg-amber-600" onClick={dismiss}>
            Tuyệt vời!
          </Button>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
