"use server"

import { db, schema } from "@/db"
import { outboxPayloadSchema, type OutboxPayload } from "@/lib/offline/outbox"
import { decideSync, resolveOfflineTimes } from "@/lib/offline/sync-rules"
import { canTake, stateOf } from "@/lib/views/student"
import { closeAttempt } from "../attempt-finalize"
import { loadWebAssignment, parseResponses, studentGate } from "../attempt-input"
import { assertAssignmentInScope } from "../ownership"
import { getQuestions, getSetVersion } from "../queries"

/*
 * Work done on the child's device without network (see
 * docs/superpowers/specs/2026-10-17-pwa-offline-design.md): handing in what was
 * queued on the device. Like the other attempt actions, no refresh() here; the
 * device refreshes the router once its queue is sent.
 */

const { attempts } = schema

/** `refused`: the server will never take this hand-in; the device keeps it as "Không gửi được". */
export type SyncResult = { ok: true; attemptId: string; graded: boolean; score: number | null } | { ok: false; error: string; refused?: true }

const REFUSALS = {
  closed: "Bài này không làm tiếp được nữa.",
  "graded-by-parent": "Bài này đã được chấm, bản offline không được gửi",
} as const

/** Hands in an attempt that was done offline. Safe to repeat: the device's id finds an earlier sync. */
export async function syncOfflineAttempt(payload: OutboxPayload): Promise<SyncResult> {
  const gated = await studentGate()
  if ("denied" in gated) return gated.denied
  const parsedPayload = outboxPayloadSchema.safeParse(payload)
  if (!parsedPayload.success) return { ok: false, error: "Bài làm không hợp lệ.", refused: true }
  const item = parsedPayload.data
  try {
    await assertAssignmentInScope(gated.ctx, item.assignmentId)
  } catch {
    return { ok: false, error: "Không tìm thấy bài.", refused: true }
  }
  const responses = parseResponses(item.responses)
  if (!responses) return { ok: false, error: "Bài làm không hợp lệ.", refused: true }
  const loaded = await loadWebAssignment(item.assignmentId)
  if ("error" in loaded) return { ok: false, error: loaded.error, refused: true }
  const { record } = loaded
  const now = new Date()

  const target = decideSync({
    clientId: item.clientId,
    attemptNo: item.attemptNo,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    canTakeNow: canTake(stateOf(record, now)),
    timeLimitMinutes: record.timeLimitMinutes,
  })
  if (target.kind === "refuse") return { ok: false, error: REFUSALS[target.reason], refused: true }
  if (target.kind === "already-synced") {
    const done = record.attempts.find((a) => a.id === target.attemptId)!
    return { ok: true, attemptId: done.id, graded: done.gradedAt !== null, score: done.score }
  }

  const existing = target.kind === "create" ? null : record.attempts.find((a) => a.id === target.attemptId)!
  const times = resolveOfflineTimes({
    now,
    availableFrom: record.availableFrom,
    existingStartedAt: existing?.startedAt ?? null,
    startedAtClient: item.startedAtClient,
    submittedAtClient: item.submittedAtClient,
    timeLimitMinutes: record.timeLimitMinutes,
    timed: item.timed,
    existingDurationSeconds: existing?.durationSeconds ?? null,
    activeSeconds: item.activeSeconds,
  })

  let attemptId = existing?.id
  if (target.kind === "create") {
    const [created] = await db
      .insert(attempts)
      .values({ assignmentId: record.id, attemptNo: target.attemptNo, mode: "web", startedAt: times.startedAt })
      .onConflictDoNothing({ target: [attempts.assignmentId, attempts.attemptNo] })
      .returning({ id: attempts.id })
    // Another request created it first: the device tries again and finds it.
    if (!created) return { ok: false, error: "Chưa gửi được bài, sẽ thử lại." }
    attemptId = created.id
  }

  const questions = await getQuestions(record.setId)
  const setChanged = (await getSetVersion(record.setId)) !== item.setVersion
  // Answers to questions deleted since the download have nothing to be graded against.
  const kept = setChanged ? Object.fromEntries(Object.entries(responses).filter(([id]) => questions.some((q) => q.id === id))) : responses

  const result = await closeAttempt({
    attemptId: attemptId!,
    questions,
    responses: kept,
    submittedAt: times.submittedAt,
    durationSeconds: times.durationSeconds,
    offline: { offlineId: item.clientId, setChanged },
    reopen: target.kind === "replace-auto-settled",
  })
  if (!result.closed) return { ok: false, error: "Chưa gửi được bài, sẽ thử lại." }
  return { ok: true, attemptId: attemptId!, graded: result.graded, score: result.score }
}
