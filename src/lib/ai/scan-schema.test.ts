import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { describe, expect, it } from "vitest"
import { scanResponseSchema } from "./scan"

/** Claude structured outputs allow at most 16 union-typed (e.g. nullable) fields per schema. */
function unionFields(node: unknown): number {
  if (!node || typeof node !== "object") return 0
  const own = "anyOf" in node || ("type" in node && Array.isArray((node as { type: unknown }).type)) ? 1 : 0
  return own + Object.values(node).reduce((sum: number, child) => sum + unionFields(child), 0)
}

describe("scan response schema", () => {
  it("stays within Claude's limit on union-typed fields", () => {
    const format = betaZodOutputFormat(scanResponseSchema) as unknown as { schema: unknown }
    expect(unionFields(format.schema)).toBeLessThanOrEqual(16)
  })
})
