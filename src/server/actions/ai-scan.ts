"use server"

import { z } from "zod"
import { runAction, type ActionResult } from "@/lib/action-result"
import {
  MAX_SCAN_BASE64_BYTES,
  MAX_SCAN_FILES,
  SCAN_SYSTEM_PROMPT,
  scanFileLabel,
  scanRequestText,
  scanResponseSchema,
  toScanResult,
  type ScanResult,
} from "@/lib/ai/scan"
import { assertAccess } from "../access"
import { ask, storageFileBlocks, type ContentBlock } from "../ai/llm"
import { isUploaded } from "../storage"

const scanInputSchema = z.object({
  setId: z.uuid(),
  files: z
    .array(z.object({ path: z.string().min(1), name: z.string().min(1).max(200), kind: z.enum(["image", "pdf"]) }))
    .min(1, "Chưa có tệp nào để quét")
    .max(MAX_SCAN_FILES, `Mỗi lần chỉ quét được tối đa ${MAX_SCAN_FILES} tệp. Hãy chia tài liệu thành nhiều lần.`),
  subject: z.enum(["toan", "tieng-viet", "tieng-anh"]),
  grade: z.number().int().min(1).max(12),
  kind: z.enum(["de-thi", "chu-de", "luyen-tap"]),
})

export type ScanInput = z.input<typeof scanInputSchema>

/** Base64 size of the file blocks, to stay under the API's request limit. */
function payloadBytes(blocks: ContentBlock[]): number {
  return blocks.reduce((sum, b) => sum + ((b.type === "image" || b.type === "document") && b.source.type === "base64" ? b.source.data.length : 0), 0)
}

/**
 * Reads uploaded photos/PDFs of a (not yet saved) set with Claude and returns
 * the transcribed questions plus suggested set details for the review step.
 */
export async function scanDocuments(input: ScanInput): Promise<ActionResult<ScanResult>> {
  return runAction(async () => {
    await assertAccess("parent")
    const { setId, files, ...meta } = scanInputSchema.parse(input)
    for (const f of files) {
      if (!(await isUploaded("sets", setId, f.path))) throw new Error(`Tệp “${f.name}” chưa tải lên xong`)
    }
    const fileBlocks = (await Promise.all(files.map((f, i) => storageFileBlocks(f.path, scanFileLabel(i, f))))).flat()
    if (payloadBytes(fileBlocks) > MAX_SCAN_BASE64_BYTES) {
      throw new Error("Tài liệu quá lớn để quét một lần. Hãy bớt tệp hoặc chia PDF thành nhiều phần.")
    }
    const response = await ask({
      system: SCAN_SYSTEM_PROMPT,
      content: [{ type: "text", text: scanRequestText(meta, files.length) }, ...fileBlocks],
      schema: scanResponseSchema,
      effort: "high",
      // Thinking plus every transcribed (and self-solved) question of up to 20 pages
      // overflows the default 32k; 128k is Claude's streaming cap (DeepSeek allows 384k).
      maxTokens: 128000,
    })
    const result = toScanResult(response, meta, files.length, () => crypto.randomUUID())
    if (!result.items.length) throw new Error("AI không tìm thấy câu hỏi nào trong tài liệu. Hãy thử ảnh rõ hơn.")
    return result
  })
}
