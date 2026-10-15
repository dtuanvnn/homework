'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { unwrap } from '@/lib/action-result'
import type { RedemptionItem } from '@/lib/views/rewards'
import { decideRedemption } from '@/server/actions/rewards'

/** Pending reward requests with "Đã trao" / "Từ chối" (dashboard card and rewards page). */
export default function RedemptionRequests({ items, studentName }: { items: RedemptionItem[]; studentName: string }) {
  const [busy, setBusy] = useState<string | null>(null)

  const decide = async (item: RedemptionItem, decision: 'given' | 'declined') => {
    setBusy(item.id)
    try {
      unwrap(await decideRedemption(item.id, decision))
      toast.success(decision === 'given' ? `Đã trao “${item.name}”` : `Đã từ chối, hoàn ${item.cost} sao cho ${studentName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chưa lưu được')
    } finally {
      setBusy(null)
    }
  }

  if (!items.length) return <p className="text-sm text-slate-500">Không có yêu cầu nào đang chờ.</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
          <span className="text-2xl" aria-hidden>{r.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{r.name}</p>
            <p className="text-xs text-slate-500">
              {r.cost} sao · {r.requestedLabel}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r, 'declined')}>
              <X />
              Từ chối
            </Button>
            <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, 'given')}>
              <Check />
              Đã trao
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
