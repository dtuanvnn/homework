import { useState } from "react"
import { SlidersHorizontal, Volume2, VolumeX } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useSound } from "@/hooks/useSound"
import { cn } from "@/lib/utils"

/** 🔊/🔇 toggle plus a small settings sheet. Student mode only. */
export default function SoundControls({ className, stacked }: { className?: string; stacked?: boolean }) {
  const { enabled, volume, setEnabled, setVolume, play } = useSound()
  const [open, setOpen] = useState(false)
  const Icon = enabled ? Volume2 : VolumeX
  const btn = "flex size-[44px] items-center justify-center rounded-[12px] text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div className={cn("flex items-center", stacked ? "flex-col" : "gap-[2px]", className)}>
      <button type="button" className={cn(btn, !enabled && "text-slate-400")} aria-pressed={enabled} aria-label={enabled ? "Tắt âm thanh" : "Bật âm thanh"} onClick={() => setEnabled(!enabled)}>
        <Icon className="size-[22px]" />
      </button>
      <button type="button" className={btn} aria-label="Cài đặt âm thanh" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-[20px]" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="md:inset-x-auto md:right-6 md:bottom-6 md:w-96 md:rounded-3xl">
          <SheetHeader>
            <SheetTitle className="text-xl">Âm thanh</SheetTitle>
            <SheetDescription className="text-base">Tiếng động vui khi em làm bài.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-8">
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
              <span className="flex items-center gap-3 text-lg font-bold text-slate-800">
                <span className="text-2xl" aria-hidden>{enabled ? "🔊" : "🔇"}</span>
                Âm thanh
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled(!enabled)}
                className={cn("relative h-8 w-14 rounded-full transition-colors", enabled ? "bg-indigo-600" : "bg-slate-300")}
              >
                <span className={cn("absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform", enabled && "translate-x-6")} />
              </button>
            </label>
            <div className={cn("space-y-3", !enabled && "opacity-40")}>
              <div className="flex justify-between text-base font-bold text-slate-700">
                <label htmlFor="sound-volume">Âm lượng</label>
                <span className="tabular-nums">{Math.round(volume * 100)}%</span>
              </div>
              <input
                id="sound-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                disabled={!enabled}
                onChange={(e) => setVolume(Number(e.target.value))}
                onPointerUp={() => play("select")}
                className="h-3 w-full cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
