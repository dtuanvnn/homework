"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { CloudOff, Hourglass, KeyRound, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { deleteDraft, deleteOutbox } from "@/lib/offline/store"
import { cn } from "@/lib/utils"
import { checkParentPin } from "@/server/actions/pin"
import { useOffline } from "./OfflineSync"

/** Top of the student shell: no network, hand-ins waiting, PIN needed, or hand-ins the server refused. */
export default function OfflineBanner() {
  const { online, pending, authError, refused } = useOffline()
  const [discarding, setDiscarding] = useState<(typeof refused)[number] | null>(null)
  const show = !online || pending.size > 0 || authError || refused.length > 0
  return (
    <>
      <AnimatePresence initial={false}>
        {show && (
          <motion.div
            className="mb-4 flex flex-col gap-2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
          >
            {(!online || pending.size > 0) && (
              <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3 text-base font-bold", online ? "bg-violet-50 text-violet-800" : "bg-slate-800 text-white")}>
                {!online && (
                  <span className="inline-flex items-center gap-2">
                    <CloudOff className="size-5" aria-hidden />
                    Đang không có mạng — bài làm được lưu trên máy
                  </span>
                )}
                {pending.size > 0 && (
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm", online ? "bg-violet-100" : "bg-white/15")}>
                    <Hourglass className="size-4" aria-hidden />
                    Chờ gửi ({pending.size})
                  </span>
                )}
              </div>
            )}
            {authError && (
              <Link href="/pin?role=student" className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-base font-bold text-amber-800 underline-offset-4 hover:underline">
                <KeyRound className="size-5" aria-hidden />
                Nhập lại mã PIN để gửi bài
              </Link>
            )}
            {refused.map((item) => (
              <div key={item.clientId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-red-800">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">Không gửi được: {item.title}</p>
                  {item.refusal && <p className="text-sm">{item.refusal}</p>}
                </div>
                <Button variant="outline" size="sm" className="border-red-200 bg-white text-red-700" onClick={() => setDiscarding(item)}>
                  Bỏ bài này
                </Button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <DiscardDialog item={discarding} onClose={() => setDiscarding(null)} />
    </>
  )
}

/** Discarding a refused hand-in needs the parent's PIN, checked by the server. */
function DiscardDialog({ item, onClose }: { item: { clientId: string; studentId: string; assignmentId: string; title: string } | null; onClose: () => void }) {
  const { reload } = useOffline()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => {
    setPin("")
    setError(null)
    onClose()
  }
  const confirm = async () => {
    if (!item) return
    setBusy(true)
    const ok = await checkParentPin(pin).catch(() => null)
    setBusy(false)
    if (ok === null) return setError("Cần có mạng để kiểm tra mã PIN.")
    if (!ok) return setError("Mã PIN chưa đúng. Thử lại nhé!")
    await deleteOutbox(item.clientId)
    await deleteDraft(item.studentId, item.assignmentId)
    reload()
    close()
  }
  return (
    <Dialog open={item !== null} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bỏ bài làm offline?</DialogTitle>
          <DialogDescription>{item ? `Bài "${item.title}" sẽ bị xoá khỏi máy. Bố mẹ nhập mã PIN để xác nhận.` : ""}</DialogDescription>
        </DialogHeader>
        <Input inputMode="numeric" autoComplete="off" aria-label="Mã PIN của bố mẹ" placeholder="Mã PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={close}>Huỷ</Button>
          <Button variant="destructive" disabled={busy || !pin} onClick={() => void confirm()}>Bỏ bài này</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Chip on a student's assignment card: downloaded, waiting to be sent, or needs network (paper work). */
export function OfflineChip({ assignmentId, mode }: { assignmentId: string; mode: "web" | "paper" }) {
  const { online, downloaded, pending } = useOffline()
  if (pending.has(assignmentId)) return <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-bold text-violet-700">Chờ gửi</span>
  if (mode === "paper") return online ? null : <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm font-bold text-slate-600">Cần có mạng</span>
  if (downloaded.has(assignmentId)) return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-700">Đã tải ✓</span>
  return null
}
