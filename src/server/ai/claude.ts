import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import type { z } from "zod"
import { downloadFromStorage } from "../storage"

/*
 * Every AI feature (scan, generate, grade, summarize) goes through ask():
 * one structured-output request, validated against a zod schema, with
 * server-side refusal fallback and Vietnamese error messages.
 */

export const AI_MODEL = "claude-opus-5-5"

let client: Anthropic | null = null
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chưa cấu hình ANTHROPIC_API_KEY nên chưa dùng được tính năng AI.")
  client ??= new Anthropic()
  return client
}

export type ContentBlock = Anthropic.Beta.BetaContentBlockParam

interface AskOptions<S extends z.ZodType> {
  system: string
  content: ContentBlock[]
  schema: S
  /** Thinking depth: "low" for quick suggestions, "high" for reading handwriting or building a test. */
  effort?: "low" | "medium" | "high"
  maxTokens?: number
}

// Streamed so long outputs (many-page scans) don't hit the SDK's non-streaming request timeout guard.
export async function ask<S extends z.ZodType>({ system, content, schema, effort = "medium", maxTokens = 32000 }: AskOptions<S>): Promise<z.infer<S>> {
  let response
  try {
    const stream = anthropic().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    })
    response = await stream.finalMessage()
  } catch (err) {
    throw new Error(friendlyError(err))
  }
  if (response.stop_reason === "refusal") throw new Error("AI không xử lý được nội dung này. Hãy thử lại với tài liệu khác.")
  if (response.stop_reason === "max_tokens") throw new Error("Nội dung quá dài để AI xử lý một lần. Hãy chia nhỏ tài liệu.")
  if (response.parsed_output == null) throw new Error("AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")
  return response.parsed_output as z.infer<S>
}

function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message.startsWith("Chưa cấu hình")) return err.message
  if (err instanceof Anthropic.AuthenticationError) return "Khóa API của Claude không hợp lệ."
  if (err instanceof Anthropic.RateLimitError) return "AI đang quá tải. Vui lòng thử lại sau ít phút."
  if (err instanceof Anthropic.BadRequestError) return `Yêu cầu gửi AI không hợp lệ: ${err.message}`
  if (err instanceof Anthropic.APIConnectionError) return "Không kết nối được tới AI. Kiểm tra mạng rồi thử lại."
  if (err instanceof Anthropic.APIError) return `AI gặp lỗi (${err.status ?? "?"}). Vui lòng thử lại.`
  console.error(err)
  return "AI gặp lỗi. Vui lòng thử lại."
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

/** A Storage file as a Claude content block (image or PDF document), preceded by a page label. */
export async function storageFileBlocks(path: string, label: string): Promise<ContentBlock[]> {
  const { data, contentType } = await downloadFromStorage(path)
  const base64 = data.toString("base64")
  const media = contentType.split(";")[0].trim().toLowerCase()
  const isPdf = media === "application/pdf" || path.toLowerCase().endsWith(".pdf")
  const file: ContentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: (IMAGE_TYPES.has(media) ? media : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64,
        },
      }
  return [{ type: "text", text: label }, file]
}
