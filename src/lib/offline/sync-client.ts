import { syncOfflineAttempt } from "@/server/actions/offline"
import { toPayload } from "./outbox"
import { deleteDraft, deleteOutbox, deletePackEntry, listOutbox, notifyOfflineChanged, putOutbox } from "./store"

/** Refusals that a new PIN or an unlock fixes: keep the item and ask for the PIN. */
const AUTH_ERRORS = new Set(["Cần mã PIN để tiếp tục.", "Tài khoản đang tạm khoá."])

let running: Promise<{ sent: number; refused: number; authError: boolean }> | null = null

/** Sends the child's queued hand-ins one at a time; stops at the first network failure. */
export function flushOutbox(studentId: string): Promise<{ sent: number; refused: number; authError: boolean }> {
  running ??= flush(studentId).finally(() => {
    running = null
  })
  return running
}

async function flush(studentId: string) {
  let sent = 0
  let refused = 0
  const items = (await listOutbox(studentId)).filter((i) => i.status === "pending")
  for (const item of items) {
    const res = await syncOfflineAttempt(toPayload(item)).catch(() => null)
    if (!res) break // no network: try again later
    if (res.ok) {
      await deleteOutbox(item.clientId)
      await deleteDraft(studentId, item.assignmentId)
      // Handed in: the next download brings it back only if a retry is allowed.
      await deletePackEntry(studentId, item.assignmentId)
      sent++
      continue
    }
    if (AUTH_ERRORS.has(res.error)) {
      notifyOfflineChanged()
      return { sent, refused, authError: true }
    }
    if (res.refused) {
      await putOutbox({ ...item, status: "refused", refusal: res.error })
      refused++
    }
    // Anything else (a race on the server): leave it pending for the next round.
  }
  if (sent || refused) notifyOfflineChanged()
  return { sent, refused, authError: false }
}
