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
      <div
        aria-label="Đang tải hình"
        className={cn('max-h-80 w-full max-w-md animate-pulse rounded-xl border border-slate-200 bg-slate-100', className)}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    )
  }
  return (
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
