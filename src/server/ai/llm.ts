import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { z } from "zod"
import { downloadFromStorage } from "../storage"

/*
 * Every AI feature (scan, generate, grade, summarize) goes through ask():
 * one request that returns an object validated by a zod schema, with
 * Vietnamese error messages. Two providers, picked by AI_PROVIDER (default:
 * DeepSeek when DEEPSEEK_API_KEY is set, else Claude):
 *
 * - "deepseek": deepseek-flash through DeepSeek's Anthropic-compatible
 *   endpoint. It has no structured outputs, so the schema is sent as a
 *   forced tool and the tool input is validated (one retry on mismatch).
 *   Images only — no PDF document blocks (the browser turns PDFs into page
 *   images before upload).
 * - "anthropic": Claude with structured outputs and server-side refusal fallback.
 */

type Provider = "deepseek" | "anthropic"

function provider(): Provider {
  const chosen = process.env.AI_PROVIDER
  if (chosen === "deepseek" || chosen === "anthropic") return chosen
  return process.env.DEEPSEEK_API_KEY ? "deepseek" : "anthropic"
}

const MODELS: Record<Provider, string> = {
  deepseek: "deepseek-flash",
  anthropic: "claude-opus-5-5",
}

const clients: Partial<Record<Provider, Anthropic>> = {}
function client(p: Provider): Anthropic {
  if (p === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error("Chưa cấu hình DEEPSEEK_API_KEY nên chưa dùng được tính năng AI.")
    return (clients.deepseek ??= new Anthropic({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com/anthropic" }))
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chưa cấu hình khóa AI (DEEPSEEK_API_KEY hoặc ANTHROPIC_API_KEY) nên chưa dùng được tính năng AI.")
  return (clients.anthropic ??= new Anthropic())
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

export async function ask<S extends z.ZodType>(options: AskOptions<S>): Promise<z.infer<S>> {
  const p = provider()
  try {
    return p === "deepseek" ? await askViaTool(options) : await askStructured(options)
  } catch (err) {
    throw new Error(friendlyError(err))
  }
}

/** Claude: structured outputs, streamed so long outputs (many-page scans) don't trip the SDK's non-streaming guard. */
async function askStructured<S extends z.ZodType>({ system, content, schema, effort = "medium", maxTokens = 32000 }: AskOptions<S>): Promise<z.infer<S>> {
  const response = await client("anthropic")
    .beta.messages.stream({
      model: MODELS.anthropic,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    })
    .finalMessage()
  checkStop(response.stop_reason)
  if (response.parsed_output == null) throw new AiError("AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")
  return response.parsed_output as z.infer<S>
}

const RESULT_TOOL = "submit_result"

/** DeepSeek: the schema becomes a forced tool; its input is the result. */
async function askViaTool<S extends z.ZodType>({ system, content, schema, effort = "medium", maxTokens = 32000 }: AskOptions<S>): Promise<z.infer<S>> {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(schema) as Record<string, unknown>
  const tool: Anthropic.Tool = {
    name: RESULT_TOOL,
    description: "Return the complete result. Call this exactly once with every field filled.",
    input_schema: inputSchema as Anthropic.Tool.InputSchema,
  }
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: content as Anthropic.ContentBlockParam[] }]

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client("deepseek")
      .messages.stream({
        model: MODELS.deepseek,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [tool],
        tool_choice: { type: "tool", name: RESULT_TOOL },
        output_config: { effort },
      })
      .finalMessage()
    checkStop(response.stop_reason)
    const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === RESULT_TOOL)
    const parsed = schema.safeParse(call?.input)
    if (parsed.success) return parsed.data
    if (!call) throw new AiError("AI không trả về kết quả. Vui lòng thử lại.")
    // Tell the model what was wrong once, then give up.
    messages.push(
      { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: call.id,
            content: `Invalid result: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Call ${RESULT_TOOL} again with a corrected, complete result.`,
          },
        ],
      },
    )
  }
  throw new AiError("AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")
}

/** Errors whose message is already meant for the parent. */
class AiError extends Error {}

function checkStop(reason: string | null) {
  if (reason === "refusal") throw new AiError("AI không xử lý được nội dung này. Hãy thử lại với tài liệu khác.")
  if (reason === "max_tokens") throw new AiError("Nội dung quá dài để AI xử lý một lần. Hãy chia nhỏ tài liệu.")
}

function friendlyError(err: unknown): string {
  if (err instanceof AiError) return err.message
  if (err instanceof Error && err.message.startsWith("Chưa cấu hình")) return err.message
  if (err instanceof Anthropic.AuthenticationError) return "Khóa API của dịch vụ AI không hợp lệ."
  if (err instanceof Anthropic.PermissionDeniedError) return "Tài khoản AI không có quyền dùng model này (hoặc đã hết tiền)."
  if (err instanceof Anthropic.RateLimitError) return "AI đang quá tải. Vui lòng thử lại sau ít phút."
  if (err instanceof Anthropic.BadRequestError) return `Yêu cầu gửi AI không hợp lệ: ${err.message}`
  if (err instanceof Anthropic.APIConnectionError) return "Không kết nối được tới AI. Kiểm tra mạng rồi thử lại."
  if (err instanceof Anthropic.APIError) {
    // DeepSeek answers 402 when the balance is empty.
    if (err.status === 402) return "Tài khoản AI đã hết tiền. Hãy nạp thêm rồi thử lại."
    return `AI gặp lỗi (${err.status ?? "?"}). Vui lòng thử lại.`
  }
  console.error(err)
  return "AI gặp lỗi. Vui lòng thử lại."
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

/** A Storage file as a content block (image, or PDF document on Claude), preceded by a page label. */
export async function storageFileBlocks(path: string, label: string): Promise<ContentBlock[]> {
  const { data, contentType } = await downloadFromStorage(path)
  const base64 = data.toString("base64")
  const media = contentType.split(";")[0].trim().toLowerCase()
  const isPdf = media === "application/pdf" || path.toLowerCase().endsWith(".pdf")
  if (isPdf && provider() === "deepseek") {
    throw new AiError("AI hiện tại chỉ đọc được ảnh. Hãy tải lên ảnh chụp các trang thay vì tệp PDF.")
  }
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
