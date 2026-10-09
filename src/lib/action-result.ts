import { ZodError } from "zod"

/*
 * Production Next.js hides the message of errors thrown inside Server
 * Actions, so actions return failures as values. Server side wraps the body
 * in runAction(); client side calls unwrap() to get the data or throw an
 * Error carrying the readable (Vietnamese) message.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() }
  } catch (err) {
    // Next uses thrown values for redirect()/notFound(); let those through.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
    if (err instanceof Error) {
      console.error(err)
      return { ok: false, error: err.message }
    }
    return { ok: false, error: "Đã có lỗi xảy ra. Vui lòng thử lại." }
  }
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}
