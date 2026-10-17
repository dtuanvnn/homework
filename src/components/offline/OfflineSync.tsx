"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MathFieldPreload } from "@/components/take/MathAnswerInput"
import type { OutboxItem } from "@/lib/offline/outbox"
import { refreshPack } from "@/lib/offline/pack-client"
import { OFFLINE_CHANGED, listOutbox, listPack } from "@/lib/offline/store"
import { flushOutbox } from "@/lib/offline/sync-client"

/*
 * Student mode only: keeps the child's open assignments downloaded and sends
 * hand-ins queued on the device whenever there is network (see lib/offline/*).
 * Screens read the device's state through useOffline().
 */

export interface OfflineState {
  studentId: string | null
  online: boolean
  /** Assignments fully downloaded ("Đã tải ✓"). */
  downloaded: Set<string>
  /** Assignments handed in on the device, waiting to be sent ("Chờ gửi"). */
  pending: Set<string>
  /** Hand-ins the server will not take ("Không gửi được"), with the title from the pack. */
  refused: (OutboxItem & { title: string })[]
  /** The PIN expired or the child is locked: queued work waits for a new PIN. */
  authError: boolean
  /** Downloaded work needs the math keyboard. */
  math: boolean
  reload: () => void
}

const EMPTY: OfflineState = { studentId: null, online: true, downloaded: new Set(), pending: new Set(), refused: [], authError: false, math: false, reload: () => {} }
const OfflineContext = createContext<OfflineState>(EMPTY)

export const useOffline = () => useContext(OfflineContext)

const FLUSH_EVERY_MS = 30_000
const PACK_EVERY_MS = 10 * 60_000

export default function OfflineSync({ studentId, refreshKey, children }: { studentId: string | null; refreshKey: string; children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<Omit<OfflineState, "reload" | "studentId">>(EMPTY)

  const reload = useCallback(() => {
    if (!studentId) return
    void Promise.all([listPack(studentId), listOutbox(studentId)])
      .then(([pack, outbox]) => {
        const titles = new Map(pack.map((e) => [e.assignmentId, e.title]))
        setState((s) => ({
          ...s,
          downloaded: new Set(pack.filter((e) => e.complete).map((e) => e.assignmentId)),
          pending: new Set(outbox.filter((o) => o.status === "pending").map((o) => o.assignmentId)),
          refused: outbox.filter((o) => o.status === "refused").map((o) => ({ ...o, title: titles.get(o.assignmentId) ?? "Bài làm offline" })),
          math: pack.some((e) => e.subject === "toan" || e.questions.some((q) => "math" in q && q.math)),
        }))
      })
      .catch(() => {})
  }, [studentId])

  const sync = useCallback(async () => {
    if (!studentId || !navigator.onLine) return
    const res = await flushOutbox(studentId).catch(() => null)
    if (res) setState((s) => ({ ...s, authError: res.authError }))
    if (res?.sent) {
      toast.success(`Đã gửi ${res.sent} bài`)
      router.refresh()
    }
    await refreshPack(studentId).catch(() => {})
  }, [studentId, router])

  useEffect(() => {
    if (!studentId) return
    const setOnline = () => setState((s) => ({ ...s, online: navigator.onLine }))
    const onOnline = () => { setOnline(); void sync() }
    const onVisible = () => { if (document.visibilityState === "visible") void sync() }
    setOnline()
    reload()
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", setOnline)
    window.addEventListener(OFFLINE_CHANGED, reload)
    document.addEventListener("visibilitychange", onVisible)
    const flushTimer = window.setInterval(() => {
      if (navigator.onLine) void flushOutbox(studentId).then((r) => { if (r.sent) { toast.success(`Đã gửi ${r.sent} bài`); router.refresh() } }).catch(() => {})
    }, FLUSH_EVERY_MS)
    const packTimer = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") void refreshPack(studentId).catch(() => {})
    }, PACK_EVERY_MS)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", setOnline)
      window.removeEventListener(OFFLINE_CHANGED, reload)
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(flushTimer)
      window.clearInterval(packTimer)
    }
  }, [studentId, sync, reload, router])

  // Every server render of the layout (new assignments, a regrade…) refreshes the download.
  useEffect(() => {
    const timer = window.setTimeout(() => void sync(), 0)
    return () => window.clearTimeout(timer)
  }, [refreshKey, sync])

  return (
    <OfflineContext.Provider value={{ ...state, studentId, reload }}>
      {children}
      {/* Fetches the math keyboard's code once, so the service worker can serve it offline. */}
      {state.math && state.online && <MathFieldPreload />}
    </OfflineContext.Provider>
  )
}
