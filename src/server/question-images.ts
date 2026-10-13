import "server-only"
import type { QuestionImage } from "@/lib/types"
import { signedUrls } from "./storage"

/** Adds a short-lived `imageUrl` to every question with a figure. Never store the result. */
export async function withImageUrls<T extends { image?: QuestionImage; imageUrl?: string }>(items: T[]): Promise<T[]> {
  const urls = await signedUrls(items.flatMap((q) => (q.image ? [q.image.path] : [])))
  return items.map((q) => (q.image && urls[q.image.path] ? { ...q, imageUrl: urls[q.image.path] } : q))
}
