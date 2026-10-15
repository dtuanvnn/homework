'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStudent } from '@/components/layout/AppFrame'
import RedemptionRequests from '@/components/rewards/RedemptionRequests'
import SectionHeader from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { unwrap, type ActionResult } from '@/lib/action-result'
import { cn } from '@/lib/utils'
import type { ParentRewardsView, RewardItem } from '@/lib/views/rewards'
import { adjustStars, deleteReward, reorderRewards, saveReward, type RewardInput } from '@/server/actions/rewards'

const EMOJIS = ['🎁', '📺', '🎮', '🍦', '📚', '🧸', '🚲', '🎨', '⚽', '🍕', '🎬', '🏊']
const HISTORY_STEP = 20

const card = 'rounded-2xl border border-slate-200 bg-white p-4'

async function run(action: Promise<ActionResult<unknown>>, success?: string): Promise<boolean> {
  try {
    unwrap(await action)
    if (success) toast.success(success)
    return true
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Chưa lưu được')
    return false
  }
}

export default function ParentRewards({ view }: { view: ParentRewardsView }) {
  const student = useStudent()
  const [editing, setEditing] = useState<RewardInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [historyShown, setHistoryShown] = useState(HISTORY_STEP)

  const save = async () => {
    if (!editing) return
    setBusy(true)
    if (await run(saveReward(editing), editing.id ? 'Đã lưu phần thưởng' : 'Đã thêm phần thưởng')) setEditing(null)
    setBusy(false)
  }

  const remove = async (r: RewardItem) => {
    if (!window.confirm(`Xóa “${r.name}”?`)) return
    try {
      const { hidden } = unwrap(await deleteReward(r.id))
      toast.success(hidden ? 'Phần thưởng đã có lượt đổi nên được ẩn đi' : 'Đã xóa phần thưởng')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chưa xóa được')
    }
  }

  const move = (index: number, delta: number) => {
    const ids = view.rewards.map((r) => r.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + delta, 0, id)
    void run(reorderRewards(ids))
  }

  const adjust = async (sign: 1 | -1) => {
    const n = Number(amount)
    if (!Number.isInteger(n) || n <= 0) return toast.error('Nhập số sao là số nguyên dương')
    setBusy(true)
    if (await run(adjustStars(sign * n, reason), sign > 0 ? `Đã cộng ${n} sao` : `Đã trừ ${n} sao`)) {
      setAmount('')
      setReason('')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Phần thưởng</h1>
        <p className="mt-1 text-slate-500">Đặt quà để {student.name} đổi bằng sao, duyệt yêu cầu và điều chỉnh sao.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className={card}>
          <p className="text-xs font-medium text-slate-500">Sao hiện có</p>
          <p className="mt-1 text-xl font-bold text-slate-900" data-testid="parent-star-balance">{view.balance}</p>
        </div>
        <div className={card}>
          <p className="text-xs font-medium text-slate-500">Đã kiếm được</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{view.earned}</p>
        </div>
        <div className={card}>
          <p className="text-xs font-medium text-slate-500">Chuỗi ngày</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{view.streak.current}</p>
          <p className="text-xs text-slate-500">Kỷ lục {view.streak.longest}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Yêu cầu đang chờ" description="Sao của con đang được giữ cho đến khi bạn quyết định" />
        <div className={card}>
          <RedemptionRequests items={view.pending} studentName={student.name} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Danh sách phần thưởng"
          description="Con chỉ thấy các phần thưởng đang hiện"
          action={
            <Button size="sm" onClick={() => setEditing({ name: '', emoji: '🎁', cost: 20, active: true })}>
              <Plus />
              Thêm
            </Button>
          }
        />
        <ul className="flex flex-col gap-2">
          {!view.rewards.length && <li className={cn(card, 'text-sm text-slate-500')}>Chưa có phần thưởng nào.</li>}
          {view.rewards.map((r, i) => (
            <li key={r.id} className={cn(card, 'flex flex-wrap items-center gap-3 py-3', !r.active && 'bg-slate-50')}>
              <span className={cn('text-2xl', !r.active && 'opacity-40')} aria-hidden>{r.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-semibold', r.active ? 'text-slate-900' : 'text-slate-400')}>{r.name}</p>
                <p className="text-xs text-slate-500">
                  {r.cost} sao{r.given > 0 && ` · đã trao ${r.given} lần`}
                  {!r.active && ' · đang ẩn'}
                </p>
              </div>
              <div className="-my-1 flex w-full justify-end gap-1 sm:my-0 sm:w-auto">
                <Button size="icon" variant="ghost" className="size-9" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Lên trên">
                  <ArrowUp />
                </Button>
                <Button size="icon" variant="ghost" className="size-9" disabled={i === view.rewards.length - 1} onClick={() => move(i, 1)} aria-label="Xuống dưới">
                  <ArrowDown />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => run(saveReward({ id: r.id, name: r.name, emoji: r.emoji, cost: r.cost, active: !r.active }), r.active ? 'Đã ẩn phần thưởng' : 'Đã hiện phần thưởng')}
                  aria-label={r.active ? 'Ẩn' : 'Hiện'}
                >
                  {r.active ? <Eye /> : <EyeOff />}
                </Button>
                <Button size="icon" variant="ghost" className="size-9" onClick={() => setEditing({ id: r.id, name: r.name, emoji: r.emoji, cost: r.cost, active: r.active })} aria-label="Sửa">
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" className="size-9 text-red-600" onClick={() => remove(r)} aria-label="Xóa">
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Cộng / trừ sao" description="Ví dụ: +5 vì tự giác ôn bài. Con sẽ thấy lý do trong lịch sử sao." />
        <div className={cn(card, 'flex flex-col gap-3 sm:flex-row sm:items-end')}>
          <div className="flex flex-col gap-1.5 sm:w-28">
            <Label htmlFor="adjust-amount">Số sao</Label>
            <Input id="adjust-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="5" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="adjust-reason">Lý do</Label>
            <Input id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tự giác ôn bài" maxLength={200} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => adjust(-1)}>Trừ sao</Button>
            <Button disabled={busy} onClick={() => adjust(1)}>Cộng sao</Button>
          </div>
        </div>
      </section>

      {view.decided.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Lịch sử đổi thưởng" />
          <ul className={cn(card, 'divide-y divide-slate-100 py-0')}>
            {view.decided.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span aria-hidden>{r.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800">{r.name}</span>
                <span className="text-slate-500">{r.cost} sao</span>
                <span className={cn('w-16 text-right font-medium', r.status === 'given' ? 'text-emerald-600' : 'text-slate-400')}>
                  {r.status === 'given' ? 'Đã trao' : 'Từ chối'}
                </span>
                <span className="w-20 text-right text-slate-500">{r.decidedLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Lịch sử sao" />
        <ul className={cn(card, 'divide-y divide-slate-100 py-0')}>
          {!view.history.length && <li className="py-3 text-sm text-slate-500">Chưa có gì.</li>}
          {view.history.slice(0, historyShown).map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={cn('w-12 shrink-0 text-right font-semibold tabular-nums', e.amount > 0 ? 'text-emerald-600' : e.amount < 0 ? 'text-red-500' : 'text-slate-400')}>
                {e.amount > 0 ? `+${e.amount}` : e.amount === 0 ? '0' : `−${-e.amount}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-800">
                {e.label}
                {e.status === 'pending' && <span className="text-slate-500"> (đang chờ)</span>}
                {e.status === 'declined' && <span className="text-slate-500"> (từ chối)</span>}
              </span>
              <span className="shrink-0 text-slate-500">{e.dateLabel}</span>
            </li>
          ))}
        </ul>
        {view.history.length > historyShown && (
          <Button variant="ghost" onClick={() => setHistoryShown((n) => n + HISTORY_STEP * 2)}>
            Xem thêm
          </Button>
        )}
      </section>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <DialogHeader>
                <DialogTitle>{editing.id ? 'Sửa phần thưởng' : 'Thêm phần thưởng'}</DialogTitle>
                <DialogDescription>Con dùng sao để đổi; bạn duyệt trước khi trao.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Biểu tượng</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setEditing({ ...editing, emoji: e })}
                        className={cn('flex size-10 items-center justify-center rounded-xl border text-xl', editing.emoji === e ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200')}
                        aria-label={e}
                        aria-pressed={editing.emoji === e}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reward-name">Tên phần thưởng</Label>
                  <Input id="reward-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Xem TV 30 phút" maxLength={100} autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reward-cost">Số sao</Label>
                  <Input
                    id="reward-cost"
                    inputMode="numeric"
                    value={editing.cost || ''}
                    onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value.replace(/\D/g, '')) })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="size-4" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                  Hiện cho con
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
                <Button type="submit" disabled={busy}>Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
