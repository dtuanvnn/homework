import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface OfflineBannerProps {
  /** Optional override to preview the offline banner even when the browser is online. */
  forceOffline?: boolean
  className?: string
}

export default function OfflineBanner({
  forceOffline = false,
  className,
}: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!isOffline && !forceOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-white shadow-sm md:text-sm",
        className,
      )}
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        Không có mạng · Bài học, giọng đọc trên máy và bài viết tay vẫn được lưu an toàn
      </span>
    </div>
  )
}
