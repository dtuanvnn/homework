import { cn } from "@/lib/utils"

/** First scanned page of a paper attempt, or a stylised mini page when there is no image. */
export default function ScanThumb({ url, className }: { url?: string; className?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn("shrink-0 rotate-[-3deg] rounded-md border border-slate-200 bg-[#fffdf6] object-cover shadow-sm", className)}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex shrink-0 rotate-[-3deg] flex-col gap-1 rounded-md border border-slate-200 bg-[#fffdf6] p-1.5 shadow-sm",
        className,
      )}
    >
      {[80, 60, 90, 50, 75, 65].map((w, i) => (
        <span key={i} className="h-0.5 rounded bg-slate-300" style={{ width: `${w}%` }} />
      ))}
      <span className="absolute right-1 bottom-1 size-2.5 rounded-full border border-red-400" />
    </div>
  )
}
