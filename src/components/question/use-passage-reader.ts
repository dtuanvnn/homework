"use client"

import { useEffect, useMemo, useState } from "react"
import { parsePassage, readable, speechText } from "@/lib/passage"
import { createPassageReader, type ReaderState } from "@/lib/passage-reader"
import { SPEEDS, speak, stopSpeaking, useVoice, type SpeechLang, type SpeedId } from "@/lib/speech"
import type { QuestionGroup } from "@/lib/types"

/**
 * Reads a formatted bài aloud: "Nghe cả bài" goes block by block (not the
 * instruction), a block's own speaker reads just that block. `reading` is the
 * block being read. Stops on unmount, so the box (keyed by bài) stops when the
 * child moves to another bài or leaves; starting one bài's reader stops any other.
 */
export function usePassageReader(group: QuestionGroup, lang: SpeechLang | null) {
  const available = !!lang && !!group.layout
  const hasVoice = useVoice(lang ?? "en")
  const blocks = useMemo(() => (group.layout ? parsePassage(group.prompt, group.layout) : []), [group.prompt, group.layout])
  const [state, setState] = useState<ReaderState>({ playing: false })
  const [speed, setSpeed] = useState<SpeedId>("normal")
  const [reader] = useState(() => createPassageReader(stopSpeaking, setState))
  const rate = SPEEDS.find((s) => s.id === speed)?.rate ?? 1
  const say = (text: string, end: () => void) => speak(text, rate, { lang: lang ?? "en", end })

  useEffect(() => () => reader.stop(), [reader])

  const item = (index: number) => ({ index, text: speechText(blocks[index]) })
  return {
    available,
    hasVoice,
    reading: state.reading,
    playing: state.playing,
    speed,
    setSpeed,
    playAll: () => reader.play(blocks.flatMap((b, i) => (readable(b) ? [item(i)] : [])), true, say),
    playBlock: (index: number) => reader.play([item(index)], false, say),
    stop: () => reader.stop(),
  }
}
