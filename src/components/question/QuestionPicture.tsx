'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { QuestionImage } from '@/lib/types'

/**
 * A question's figure. Width/height reserve space while it loads; an expired
 * signed URL (a page left open past an hour) triggers one refresh.
 */
export default function QuestionPicture({ question, className }: { question: { image?: QuestionImage; imageUrl?: string }; className?: string }) {
  const router = useRouter()
  const [retried, setRetried] = useState(false)
  if (!question.image) return null
  const { width, height } = question.image
  if (!question.imageUrl) {
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
      src={question.imageUrl}
      alt="Hình minh họa"
      width={width}
      height={height}
      draggable={false}
      className={cn('h-auto max-h-80 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain', className)}
      onError={() => {
        if (retried) return
        setRetried(true)
        router.refresh()
      }}
    />
  )
}
