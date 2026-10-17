'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getImage } from '@/lib/offline/store'
import { cn } from '@/lib/utils'
import type { QuestionImage } from '@/lib/types'

/**
 * A question's figure. Width/height reserve space while it loads; an expired
 * signed URL (a page left open past an hour) triggers one refresh. Without
 * network (or a URL), the copy downloaded for offline work is shown instead.
 */
export default function QuestionPicture({ question, className }: { question: { image?: QuestionImage; imageUrl?: string }; className?: string }) {
  const router = useRouter()
  const [retried, setRetried] = useState(false)
  const [failed, setFailed] = useState(false)
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null)
  const path = question.image?.path
  const wantsOffline = Boolean(path) && (!question.imageUrl || failed || (typeof navigator !== 'undefined' && !navigator.onLine))

  useEffect(() => {
    if (!wantsOffline || !path) return
    let url: string | null = null
    let live = true
    void getImage(path)
      .then((blob) => {
        if (!blob || !live) return
        url = URL.createObjectURL(blob)
        setOfflineUrl(url)
      })
      .catch(() => {})
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [wantsOffline, path])

  if (!question.image) return null
  const { width, height } = question.image
  const src = offlineUrl ?? question.imageUrl
  if (!src) {
    return (
      // No signed URL (e.g. the file is gone from Storage): keep the space, say so, don't pulse forever.
      <div
        className={cn('flex max-h-80 w-full max-w-md items-center justify-center rounded-xl border border-slate-200 bg-slate-100', className)}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <span className="text-xs text-slate-400">Không tải được hình</span>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Signed Storage URLs can't use next/image optimization
    <img
      src={src}
      alt="Hình minh họa"
      width={width}
      height={height}
      draggable={false}
      className={cn('h-auto max-h-80 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain', className)}
      onError={() => {
        if (offlineUrl) return
        setFailed(true)
        if (retried || !navigator.onLine) return
        setRetried(true)
        router.refresh()
      }}
    />
  )
}
