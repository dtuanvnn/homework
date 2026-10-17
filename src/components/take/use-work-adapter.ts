"use client"

import { useEffect, useRef } from "react"
import { classify, submitRoute } from "@/lib/offline/adapter-logic"
import { correctedNow, offsetFrom, type LocalDraft } from "@/lib/offline/drafts"
import type { OfflineTimed } from "@/lib/offline/sync-rules"
import { deleteDraft, notifyOfflineChanged, putDraft, putOutbox, setMeta } from "@/lib/offline/store"
import { saveDraft, startAttempt, submitAttempt } from "@/server/actions/attempts"
import type { Answers } from "./TakeAssignment"

/*
 * Where the take screen's work goes: always to the device first, then to the
 * server when there is network. Work started offline (a timed attempt whose
 * clock runs on the iPad) stays on the device until it is handed in, and the
 * hand-in waits in the outbox (see lib/offline/*).
 */

export interface WorkAdapter {
  start(): Promise<{ deadline: string; serverNow: string } | { error: string; expired?: boolean }>
  save(answers: Answers, seconds: number): Promise<"server" | "local" | false>
  submit(answers: Answers, seconds: number): Promise<{ graded: boolean; attemptId: string } | { queued: true } | { error: string; expired?: boolean }>
}

const ERR_SUBMIT = "Chưa nộp được bài. Em kiểm tra mạng rồi thử lại nhé!"

export function useWorkAdapter(p: {
  studentId: string
  assignmentId: string
  attemptNo: number
  setVersion: string
  timeLimitMinutes: number | null
  /** The server already has an open draft for this attempt. */
  serverDraft: boolean
  /** The device's draft from an earlier visit, if any. */
  local: LocalDraft | null
  clockOffsetMs: number
  /** The server says time is up (or the attempt is already handed in). */
  onExpired: (message: string) => void
}): WorkAdapter {
  const props = useRef(p)
  useEffect(() => { props.current = p })
  // Mutable on purpose: the attempt's origin and clock change as the work moves between device and server.
  const state = useRef<{ origin: "server" | "device"; startedAtClient: number | null; timed: OfflineTimed; serverDraft: boolean; offset: number } | null>(null)
  const st = () => {
    if (!state.current) {
      const { local, attemptNo, serverDraft, clockOffsetMs } = props.current
      const mine = local && local.attemptNo === attemptNo ? local : null
      state.current = { origin: mine?.origin ?? "server", startedAtClient: mine?.startedAtClient ?? null, timed: mine?.timed ?? null, serverDraft, offset: clockOffsetMs }
    }
    return state.current
  }

  const writeLocal = async (answers: Answers, seconds: number): Promise<boolean> => {
    const s = st()
    const { studentId, assignmentId, attemptNo, setVersion } = props.current
    try {
      await putDraft({
        studentId, assignmentId, attemptNo, setVersion,
        origin: s.origin, responses: answers, activeSeconds: seconds,
        startedAtClient: s.startedAtClient, timed: s.timed, updatedAt: Date.now(),
      })
      return true
    } catch {
      return false // private browsing or storage full: the server copy is all there is
    }
  }

  return {
    async start() {
      const s = st()
      const { assignmentId, timeLimitMinutes } = props.current
      if (navigator.onLine) {
        const sentAt = Date.now()
        const out = classify(await startAttempt(assignmentId).catch(() => null))
        if (out.kind === "ok") {
          s.offset = offsetFrom(out.value.serverNow, sentAt, Date.now())
          void setMeta("clockOffsetMs", s.offset).catch(() => {})
          s.origin = "server"
          s.serverDraft = true
          s.timed = { deadlineMs: Date.parse(out.value.deadline), source: "server" }
          await writeLocal({}, 0)
          return { deadline: out.value.deadline, serverNow: out.value.serverNow }
        }
        if (out.kind === "server") return { error: out.error, expired: out.expired }
      }
      // No network: the clock starts on the iPad and the hand-in is sent later.
      const now = correctedNow(s.offset)
      s.origin = "device"
      s.startedAtClient = now
      s.timed = { deadlineMs: now + (timeLimitMinutes ?? 0) * 60_000, source: "device" }
      await writeLocal({}, 0)
      notifyOfflineChanged()
      return { deadline: new Date(s.timed.deadlineMs).toISOString(), serverNow: new Date(now).toISOString() }
    },

    async save(answers, seconds) {
      const s = st()
      const { assignmentId, timeLimitMinutes } = props.current
      if (!s.serverDraft && s.startedAtClient === null && timeLimitMinutes === null) s.startedAtClient = correctedNow(s.offset)
      const local = await writeLocal(answers, seconds)
      if (s.origin === "device" || !navigator.onLine) return local ? "local" : false
      // Untimed work begun offline: the server's draft starts when the device's did.
      const startedAt = !s.serverDraft && s.startedAtClient !== null ? new Date(s.startedAtClient).toISOString() : undefined
      const out = classify(await saveDraft(assignmentId, answers, seconds, startedAt).catch(() => null))
      if (out.kind === "ok") {
        s.serverDraft = true
        return "server"
      }
      if (out.kind === "server" && out.expired) props.current.onExpired(out.error)
      if (out.kind === "network") return local ? "local" : false
      return false
    },

    async submit(answers, seconds) {
      const s = st()
      const { studentId, assignmentId, attemptNo, setVersion } = props.current
      await writeLocal(answers, seconds)
      if (submitRoute(s.origin, navigator.onLine) === "server") {
        const out = classify(await submitAttempt(assignmentId, answers, seconds).catch(() => null))
        if (out.kind === "ok") {
          await deleteDraft(studentId, assignmentId).catch(() => {})
          return { graded: out.value.graded, attemptId: out.value.attemptId }
        }
        if (out.kind === "server") return { error: out.error, expired: out.expired }
      }
      const now = correctedNow(s.offset)
      try {
        await putOutbox({
          clientId: crypto.randomUUID(),
          studentId, assignmentId, attemptNo, setVersion,
          responses: answers,
          activeSeconds: seconds,
          startedAtClient: s.startedAtClient,
          // Time ran out on the device: the hand-in counts at the deadline.
          submittedAtClient: s.timed ? Math.min(now, s.timed.deadlineMs) : now,
          timed: s.timed,
          status: "pending",
        })
      } catch {
        return { error: ERR_SUBMIT }
      }
      notifyOfflineChanged()
      return { queued: true }
    },
  }
}
