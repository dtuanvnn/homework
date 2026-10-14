import "server-only"
import { figurePaths } from "@/lib/figures"
import type { QuestionImage } from "@/lib/types"
import { signedUrls } from "./storage"

type WithImages = { image?: QuestionImage; imageUrl?: string; solutionImage?: QuestionImage; solutionImageUrl?: string }

/** Adds short-lived `imageUrl` / `solutionImageUrl` to every question with pictures. Never store the result. */
export async function withImageUrls<T extends WithImages>(items: T[]): Promise<T[]> {
  const urls = await signedUrls(items.flatMap(figurePaths))
  return items.map((q) => {
    const imageUrl = q.image && urls[q.image.path]
    const solutionImageUrl = q.solutionImage && urls[q.solutionImage.path]
    return imageUrl || solutionImageUrl ? { ...q, ...(imageUrl ? { imageUrl } : {}), ...(solutionImageUrl ? { solutionImageUrl } : {}) } : q
  })
}
