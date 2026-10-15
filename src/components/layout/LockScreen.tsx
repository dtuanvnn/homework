"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { formatLockEnd } from "@/lib/dates"
import HoldToOpen from "./HoldToOpen"

/** The child's device while they are locked; re-checks every minute and on focus. */
export default function LockScreen({ avatarEmoji, name, reason, until }: { avatarEmoji: string; name: string; reason: string | null; until: string | null }) {
  const router = useRouter()
  useEffect(() => {
    document.documentElement.dataset.mode = "locked"
    const check = () => router.refresh()
    const timer = window.setInterval(check, 60_000)
    window.addEventListener("focus", check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
    }
  }, [router])
  return (
    <main className="grid min-h-dvh place-items-center bg-indigo-50/60 p-6">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg shadow-indigo-600/10">
        <HoldToOpen onOpen={() => window.location.assign("/parent")} className="mx-auto w-fit">
          <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-4xl" aria-hidden>
            {avatarEmoji}
          </span>
        </HoldToOpen>
        <div className="mt-4 text-3xl" aria-hidden>🔒</div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Tài khoản đang tạm khoá</h1>
        {reason && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-amber-900">&ldquo;{reason}&rdquo;</p>}
        <p className="mt-3 text-slate-500">
          {until
            ? `Mở lại lúc ${formatLockEnd(until)}`
            : `Hỏi bố mẹ để mở khoá nhé, ${name}.`}
        </p>
        <a href="/pin?role=student" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Đổi học sinh
        </a>
      </div>
    </main>
  )
}
