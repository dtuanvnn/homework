import { Square, Volume2 } from "lucide-react"
import { noVoiceMessage, SPEEDS, type SpeechLang } from "@/lib/speech"
import type { usePassageReader } from "./use-passage-reader"

/** "Nghe cả bài" / "Dừng" and the reading speed, or why the device can't read. */
export default function PassageListen({ reader, lang }: { reader: ReturnType<typeof usePassageReader>; lang: SpeechLang }) {
  if (!reader.hasVoice) return <span className="text-xs font-medium tracking-normal text-slate-500 normal-case">{noVoiceMessage(lang)}</span>
  const speedIndex = SPEEDS.findIndex((s) => s.id === reader.speed)
  const nextSpeed = SPEEDS[(speedIndex + 1) % SPEEDS.length]
  return (
    <span className="flex items-center gap-1.5 tracking-normal normal-case">
      <button
        type="button"
        onClick={() => reader.setSpeed(nextSpeed.id)}
        aria-label={`Tốc độ đọc: ${SPEEDS[speedIndex].label}. Nhấn để đổi sang ${nextSpeed.label}`}
        className="h-9 rounded-full border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        {SPEEDS[speedIndex].label}
      </button>
      <button
        type="button"
        onClick={reader.playing ? reader.stop : reader.playAll}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 text-sm font-bold text-white hover:bg-indigo-700"
      >
        {reader.playing ? <Square className="size-3.5 fill-current" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        {reader.playing ? "Dừng" : "Nghe cả bài"}
      </button>
    </span>
  )
}
