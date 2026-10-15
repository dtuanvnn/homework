"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Gift, Hourglass, Lock, X } from "lucide-react"
import { toast } from "sonner"
import CountUp from "@/components/fun/CountUp"
import Mascot from "@/components/fun/Mascot"
import Press from "@/components/fun/Press"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { play } from "@/hooks/useSound"
import { unwrap } from "@/lib/action-result"
import { celebrate, list, listItem, pressable } from "@/lib/animations"
import { cn } from "@/lib/utils"
import type { RewardItem, StudentRewardsView } from "@/lib/views/rewards"
import { cancelRedemption, requestRedemption } from "@/server/actions/rewards"

const HISTORY_STEP = 15

export default function StudentRewards({ view }: { view: StudentRewardsView }) {
  const reduced = useReducedMotion()
  const [confirm, setConfirm] = useState<RewardItem | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [historyShown, setHistoryShown] = useState(HISTORY_STEP)
  const { balance, streak } = view
  const earned = view.badges.filter((b) => b.earnedLabel)

  const redeem = async (reward: RewardItem) => {
    setBusy(reward.id)
    try {
      unwrap(await requestRedemption(reward.id))
      setConfirm(null)
      play("celebrate")
      celebrate("small")
      toast.success("Đã gửi cho bố mẹ!", { description: `${reward.emoji} ${reward.name} đang chờ bố mẹ trao nhé.` })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa đổi được, em thử lại nhé")
    } finally {
      setBusy(null)
    }
  }

  const cancel = async (id: string) => {
    setBusy(id)
    try {
      unwrap(await cancelRedemption(id))
      toast("Đã hủy yêu cầu, sao đã trả lại cho em")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa hủy được")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-16 text-lg">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-400 via-orange-400 to-pink-500 p-6 text-white shadow-lg shadow-orange-500/20 md:p-8">
        <div className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-white/15" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Phần thưởng</h1>
            <p className="mt-1 text-base font-medium text-amber-50 md:text-lg">Làm bài chăm chỉ để có sao đổi quà nhé!</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-2xl font-extrabold text-amber-600 shadow-sm" data-testid="star-balance">
              <span aria-hidden>⭐</span>
              <span><CountUp value={balance} /> sao</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-base font-bold">
              <span aria-hidden>🔥</span>
              {streak.current} ngày liên tiếp
            </span>
          </div>
        </div>
        <p className="relative mt-4 rounded-2xl bg-white/20 px-4 py-2 text-base font-semibold">
          Còn {streak.next.days - streak.current} ngày nữa đến mốc {streak.next.days} ngày (+{streak.next.bonus} ⭐)
          {streak.longest > streak.current && <span className="opacity-80"> · Kỷ lục: {streak.longest} ngày</span>}
        </p>
      </section>

      {/* Shop */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-slate-900">Đổi quà</h2>
        {!view.rewards.length && (
          <div className="flex flex-col items-center gap-2 rounded-[28px] border-2 border-dashed border-amber-200 bg-white px-6 py-10 text-center">
            <Mascot mood="cheer" />
            <p className="text-xl font-extrabold text-slate-800">Bố mẹ chưa đặt phần thưởng nào</p>
            <p className="text-base text-slate-600">Em cứ chăm chỉ tích sao trước nhé!</p>
          </div>
        )}
        <motion.ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" variants={list} initial="initial" animate="animate">
          {view.rewards.map((r) => {
            const missing = r.cost - balance
            return (
              <motion.li key={r.id} variants={listItem(reduced)} {...pressable(reduced)} className="flex flex-col gap-3 rounded-[28px] border-2 border-amber-100 bg-white p-5">
                <div className="flex items-center gap-4">
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-4xl" aria-hidden>{r.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xl leading-snug font-extrabold text-slate-900">{r.name}</p>
                    <p className="text-base font-bold text-amber-600">⭐ {r.cost} sao</p>
                  </div>
                </div>
                <div className="mt-auto">
                  {r.pending ? (
                    <Button disabled className="h-12 w-full rounded-2xl bg-violet-100 text-base font-bold text-violet-700 disabled:opacity-100">
                      <Hourglass />
                      Đang chờ bố mẹ
                    </Button>
                  ) : missing > 0 ? (
                    <div className="space-y-1.5">
                      <div className="h-3 overflow-hidden rounded-full bg-amber-100" role="progressbar" aria-valuenow={Math.max(0, balance)} aria-valuemin={0} aria-valuemax={r.cost}>
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(0, Math.min(100, (balance / r.cost) * 100))}%` }} />
                      </div>
                      <p className="text-sm font-bold text-slate-500">Còn thiếu {missing} ⭐</p>
                    </div>
                  ) : (
                    <Press>
                      <Button className="h-12 w-full rounded-2xl bg-amber-500 text-lg font-bold hover:bg-amber-600" onClick={() => setConfirm(r)}>
                        <Gift />
                        Đổi
                      </Button>
                    </Press>
                  )}
                </div>
              </motion.li>
            )
          })}
        </motion.ul>
      </section>

      {/* Pending */}
      {view.pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-extrabold text-slate-900">Đang chờ bố mẹ</h2>
          <ul className="space-y-2">
            {view.pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-3xl border-2 border-violet-100 bg-violet-50 px-4 py-3">
                <span className="text-3xl" aria-hidden>{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900">{p.name}</p>
                  <p className="text-sm font-semibold text-slate-500">{p.cost} sao · gửi ngày {p.requestedLabel}</p>
                </div>
                <Button variant="outline" className="rounded-2xl" disabled={busy === p.id} onClick={() => cancel(p.id)}>
                  <X />
                  Hủy
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Badges */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-slate-900">
          Huy hiệu <span className="text-lg font-bold text-slate-500">({earned.length}/{view.badges.length})</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {view.badges.map((b) => (
            <li
              key={b.id}
              className={cn(
                "flex flex-col items-center gap-1 rounded-3xl border-2 p-4 text-center",
                b.earnedLabel ? "border-amber-200 bg-gradient-to-b from-amber-50 to-white" : "border-slate-100 bg-slate-50",
              )}
            >
              <span className={cn("text-5xl", !b.earnedLabel && "opacity-30 grayscale")} aria-hidden>{b.emoji}</span>
              <p className={cn("text-base leading-snug font-extrabold", b.earnedLabel ? "text-slate-900" : "text-slate-500")}>{b.name}</p>
              {b.earnedLabel ? (
                <p className="text-xs font-semibold text-amber-700">Đạt ngày {b.earnedLabel}</p>
              ) : (
                <p className="flex items-center gap-1 text-xs text-slate-500"><Lock className="size-3 shrink-0" />{b.hint}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold text-slate-900">Lịch sử sao</h2>
        {!view.history.length && <p className="text-base text-slate-500">Chưa có gì. Làm bài đầu tiên để nhận sao nhé!</p>}
        <ul className="divide-y divide-slate-100 rounded-3xl border-2 border-slate-100 bg-white">
          {view.history.slice(0, historyShown).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-base">
              <span
                className={cn(
                  "w-14 shrink-0 text-right font-extrabold tabular-nums",
                  e.amount > 0 ? "text-emerald-600" : e.amount < 0 ? "text-red-500" : "text-slate-400",
                )}
              >
                {e.amount > 0 ? `+${e.amount}` : e.amount === 0 ? "0" : `−${-e.amount}`}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                {e.label}
                {e.status === "pending" && <span className="text-slate-500"> (chờ bố mẹ)</span>}
                {e.status === "declined" && <span className="text-slate-500"> (bố mẹ chưa đồng ý)</span>}
              </span>
              <span className="shrink-0 text-sm text-slate-500">{e.dateLabel}</span>
            </li>
          ))}
        </ul>
        {view.history.length > historyShown && (
          <Button variant="ghost" className="w-full rounded-2xl text-base" onClick={() => setHistoryShown((n) => n + HISTORY_STEP * 2)}>
            Xem thêm
          </Button>
        )}
      </section>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="rounded-[28px] text-center">
          {confirm && (
            <>
              <DialogHeader className="items-center">
                <span className="text-6xl" aria-hidden>{confirm.emoji}</span>
                <DialogTitle className="text-2xl font-extrabold">Đổi {confirm.name}?</DialogTitle>
                <DialogDescription className="text-base">
                  Em sẽ dùng {confirm.cost} sao, còn lại {balance - confirm.cost} sao. Bố mẹ sẽ trao quà cho em.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button variant="outline" className="h-12 rounded-2xl text-base" onClick={() => setConfirm(null)}>
                  Để sau
                </Button>
                <Button className="h-12 rounded-2xl bg-amber-500 text-base font-bold hover:bg-amber-600" disabled={busy === confirm.id} onClick={() => redeem(confirm)}>
                  <Gift />
                  Đổi ngay
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
