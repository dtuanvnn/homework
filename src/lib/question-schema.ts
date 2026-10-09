import { z } from "zod"
import type { QuestionContent } from "./types"

/**
 * Runtime validation for questions arriving from the client (and, later,
 * from AI output). Mirrors the Question union in types.ts.
 */

const base = {
  prompt: z.string().trim().min(1, "Câu hỏi cần có nội dung"),
  points: z.number().positive().max(100),
  skills: z.array(z.string().trim().min(1)).max(10),
}

export const questionContentSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("trac-nghiem"), options: z.array(z.string()).min(2).max(6), correctIndex: z.number().int().min(0) }),
  z.object({ ...base, type: z.literal("dung-sai"), answer: z.boolean() }),
  z.object({ ...base, type: z.literal("dien-cho-trong"), answers: z.array(z.string()).min(1) }),
  z.object({ ...base, type: z.literal("tra-loi-ngan"), answer: z.string().trim().min(1) }),
  z.object({
    ...base,
    type: z.literal("noi"),
    pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1), picture: z.string().optional() })).min(2),
  }),
  z.object({ ...base, type: z.literal("sap-xep"), tokens: z.array(z.string().min(1)).min(2), shuffled: z.array(z.number().int().min(0)) }),
  z.object({ ...base, type: z.literal("tu-luan"), rubric: z.string() }),
]) satisfies z.ZodType<QuestionContent>

/** A question as edited in the UI: content plus a client-side id. */
export const editedQuestionSchema = z.intersection(z.object({ id: z.string() }), questionContentSchema)
