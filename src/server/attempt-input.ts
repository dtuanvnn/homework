import "server-only"
import { z } from "zod"
import type { Response } from "@/lib/grading"
import { inkSchema } from "@/lib/ink"
import { assertAccess, type Context } from "./access"
import { getAssignment, isUuid, type AssignmentRecord } from "./queries"

/*
 * Input checks shared by the student's attempt actions (server/actions/attempts.ts
 * and server/actions/offline.ts). Kept out of the "use server" files, which may
 * only export actions.
 */

const MAX_RESPONSE_CHARS = 2_000_000

/** Loose shapes of what the question components store (see lib/grading.ts). */
const responseSchema = z.union([
  z.number(),
  z.boolean(),
  z.string().max(5000),
  z.array(z.union([z.string().max(500), z.number()])).max(100),
  z.record(z.string().max(4), z.number()),
  z.object({ text: z.string().max(20_000), drawing: z.string().startsWith("data:image/").optional(), ink: inkSchema.optional() }),
])

const responsesSchema = z
  .record(z.string(), responseSchema.nullable())
  .refine((r) => Object.keys(r).length <= 300, "Quá nhiều câu trả lời")
  .refine((r) => JSON.stringify(r).length <= MAX_RESPONSE_CHARS, "Bài làm quá lớn")

/** Access check for the Result-returning actions: a refusal (PIN, lock) becomes an error result. */
export async function studentGate(): Promise<{ ctx: Context } | { denied: { ok: false; error: string } }> {
  try {
    const ctx = await assertAccess("student")
    return { ctx }
  } catch (e) {
    // Next uses thrown values for redirect()/notFound(); let those through (e.g. archived child → PIN page).
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e
    return { denied: { ok: false, error: e instanceof Error ? e.message : "Cần mã PIN để tiếp tục." } }
  }
}

export function parseResponses(input: unknown): Record<string, Response> | null {
  const parsed = responsesSchema.safeParse(input)
  if (!parsed.success) return null
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== null)) as Record<string, Response>
}

export async function loadWebAssignment(assignmentId: string): Promise<{ record: AssignmentRecord } | { error: string }> {
  if (!isUuid(assignmentId)) return { error: "Không tìm thấy bài." }
  const record = await getAssignment(assignmentId)
  if (!record) return { error: "Không tìm thấy bài." }
  if (record.mode !== "web") return { error: "Bài này làm trên giấy." }
  return { record }
}
