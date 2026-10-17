import { z } from "zod"
import type { OfflineTimed } from "./sync-rules"

/** A hand-in made on the device, waiting to be sent (or refused by the server). */
export interface OutboxItem {
  clientId: string
  studentId: string
  assignmentId: string
  attemptNo: number
  /** `exerciseSets.updatedAt` (ISO) when the assignment was downloaded. */
  setVersion: string
  responses: Record<string, unknown>
  activeSeconds: number
  /** Device times in ms, corrected by the last known server clock offset. */
  startedAtClient: number | null
  submittedAtClient: number
  timed: OfflineTimed
  status: "pending" | "refused"
  refusal?: string
}

/** What the device sends; the answers themselves are checked by the server's response schema. */
export type OutboxPayload = Omit<OutboxItem, "studentId" | "status" | "refusal">

const ms = z.number().finite().nonnegative()

export const outboxPayloadSchema = z.object({
  clientId: z.uuid(),
  assignmentId: z.string().min(1).max(100),
  attemptNo: z.number().int().min(1).max(2),
  setVersion: z.string().max(40),
  responses: z.record(z.string(), z.unknown()),
  activeSeconds: z.number().finite(),
  startedAtClient: ms.nullable(),
  submittedAtClient: ms,
  timed: z.object({ deadlineMs: ms, source: z.enum(["server", "device"]) }).nullable(),
}) satisfies z.ZodType<OutboxPayload>

export function toPayload(item: OutboxItem): OutboxPayload {
  const { clientId, assignmentId, attemptNo, setVersion, responses, activeSeconds, startedAtClient, submittedAtClient, timed } = item
  return { clientId, assignmentId, attemptNo, setVersion, responses, activeSeconds, startedAtClient, submittedAtClient, timed }
}
