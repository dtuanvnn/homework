"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { parsePassage, readable, speechText } from "@/lib/passage"
import { SPEEDS, speak, stopSpeaking, useVoice, type SpeechLang, type SpeedId } from "@/lib/speech"
import type { QuestionGroup } from "@/lib/types"

/**
 * Reads a formatted bài aloud: "Nghe cả bài" goes block by block (not the
 * instruction), a block's own speaker reads just that block. `reading` is the
 * block being read. Stops on unmount, so the box (keyed by bài) stops when the
 * child moves to another bài or leaves.
 */
export function usePassageReader(group: QuestionGroup, lang: SpeechLang | null) {
  const available = !!lang && !!group.layout
  const hasVoice = useVoice(lang ?? "en")
  const blocks = useMemo(() => (group.layout ? parsePassage(group.prompt, group.layout) : []), [group.prompt, group.layout])
  const [reading, setReading] = useState<number | undefined>()
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<SpeedId>("normal")
  // Bumped on every start/stop so callbacks of an interrupted utterance do nothing.
  const run = useRef(0)

  useEffect(() => () => stopSpeaking(), [])

  const rate = SPEEDS.find((s) => s.id === speed)?.rate ?? 1

  const read = (queue: number[], all: boolean) => {
    const id = ++run.current
    const next = (k: number) => {
      if (run.current !== id) return
      const index = queue[k]
      if (index === undefined) {
        setReading(undefined)
        setPlaying(false)
        return
      }
      setReading(index)
      speak(speechText(blocks[index]), rate, { lang: lang ?? "en", end: () => next(k + 1) })
    }
    setPlaying(all)
    next(0)
  }

  const stop = () => {
    run.current += 1
    stopSpeaking()
    setReading(undefined)
    setPlaying(false)
  }

  return {
    available,
    hasVoice,
    reading,
    playing,
    speed,
    setSpeed,
    playAll: () => read(blocks.flatMap((b, i) => (readable(b) ? [i] : [])), true),
    playBlock: (index: number) => read([index], false),
    stop,
  }
}
