"use client"

import { useEffect, useState } from "react"
import { Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const KEY = "hh-a2hs-tip"

/**
 * One-time tip for the parent: on the child's iPad, adding the app to the home
 * screen keeps downloaded work (Safari may clear a site's storage after 7 days
 * without a visit otherwise) and opens it full screen.
 */
export default function HomeScreenTip() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(localStorage.getItem(KEY) !== "seen"), 0)
    return () => window.clearTimeout(timer)
  }, [])
  if (!show) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
      <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1">
        Trên iPad của con: mở Safari → Chia sẻ → Thêm vào Màn hình chính để làm bài khi không có mạng.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-indigo-700"
        aria-label="Ẩn gợi ý"
        onClick={() => {
          localStorage.setItem(KEY, "seen")
          setShow(false)
        }}
      >
        <X />
      </Button>
    </div>
  )
}
