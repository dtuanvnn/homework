import { z } from "zod"
import { isFigurePath } from "./figures"
import { isValidWord } from "./flashcard"
import type { QuestionContent } from "./types"

/**
 * Runtime validation for questions arriving from the client (and, later,
 * from AI output). Mirrors the Question union in types.ts.
 */

const imageSchema = z.object({
  path: z.string().refine(isFigurePath, "Hình minh họa không hợp lệ"),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
})

const groupSchema = z.object({
  id: z.string().min(1).max(64),
  label: z
    .string()
    .trim()
    .max(40, "Nhãn bài tối đa 40 ký tự")
    .optional()
    .transform((v) => v || undefined),
  prompt: z.string().trim().max(10000),
  image: imageSchema.optional(),
})

const base = {
  prompt: z.string().trim().min(1, "Câu hỏi cần có nội dung"),
  points: z.number().positive().max(100),
  skills: z.array(z.string().trim().min(1)).max(10),
  image: imageSchema.optional(),
  answerStatus: z.enum(["missing", "ai", "ai-check"]).optional(),
  solution: z.string().max(10000).optional(),
  solutionImage: imageSchema.optional(),
  group: groupSchema.optional(),
}

const mathFlags = { math: z.boolean().optional(), simplest: z.boolean().optional() }

export const questionContentSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("trac-nghiem"),
      options: z.array(z.string()).min(2).max(6),
      correctIndex: z.number().int().min(0),
      correctIndexes: z.array(z.number().int().min(0)).min(2).optional(),
    })
    .refine((q) => !q.correctIndexes || (new Set(q.correctIndexes).size === q.correctIndexes.length && q.correctIndexes.every((i) => i < q.options.length)), {
      path: ["correctIndexes"],
      message: "Đáp án đúng không hợp lệ",
    }),
  z.object({ ...base, type: z.literal("dung-sai"), answer: z.boolean() }),
  z.object({ ...base, ...mathFlags, type: z.literal("dien-cho-trong"), answers: z.array(z.string()).min(1) }),
  // Without an answer key yet ("missing") the answer is an empty placeholder.
  z
    .object({
      ...base,
      ...mathFlags,
      // A blank câu of a split passage needs no text of its own (the passage is the bài's prompt).
      prompt: z.string().trim(),
      type: z.literal("tra-loi-ngan"),
      answer: z.string(),
      blank: z.number().int().positive().optional(),
    })
    .refine((q) => q.blank !== undefined || q.prompt !== "", { path: ["prompt"], message: "Câu hỏi cần có nội dung" })
    .refine((q) => q.answerStatus === "missing" || q.answer.trim() !== "", { path: ["answer"], message: "Câu hỏi cần có đáp án" }),
  z.object({
    ...base,
    type: z.literal("noi"),
    pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1), picture: z.string().optional() })).min(2),
  }),
  z.object({ ...base, type: z.literal("sap-xep"), tokens: z.array(z.string().min(1)).min(2), shuffled: z.array(z.number().int().min(0)) }),
  z.object({ ...base, type: z.literal("tu-luan"), rubric: z.string() }),
  z.object({
    ...base,
    type: z.literal("tu-vung"),
    word: z.string().trim().refine(isValidWord, "Từ chỉ gồm chữ cái, dấu cách, gạch nối hoặc dấu nháy (tối đa 60 ký tự)"),
    prompt: z.string().trim().min(1, "Từ cần có giải thích").max(300, "Giải thích tối đa 300 ký tự"),
  }),
]) satisfies z.ZodType<QuestionContent>

/** A question as edited in the UI: content plus a client-side id. */
export const editedQuestionSchema = z.intersection(z.object({ id: z.string() }), questionContentSchema).transform((q) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { imageUrl: _imageUrl, solutionImageUrl: _solutionImageUrl, ...rest } = q as typeof q & { imageUrl?: string; solutionImageUrl?: string }
  if (!rest.group) return rest
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { imageUrl: _groupImageUrl, ...group } = rest.group as typeof rest.group & { imageUrl?: string }
  return { ...rest, group }
})
