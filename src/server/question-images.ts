import "server-only"
import { figurePaths } from "@/lib/figures"
import type { QuestionGroup, QuestionImage } from "@/lib/types"
import { signedUrls } from "./storage"

type WithImages = { image?: QuestionImage; imageUrl?: string; solutionImage?: QuestionImage; solutionImageUrl?: string; group?: QuestionGroup }

/** Adds short-lived `imageUrl` / `solutionImageUrl` / `group.imageUrl` to every question with pictures. Never store the result. */
export async function withImageUrls<T extends WithImages>(items: T[]): Promise<T[]> {
  const urls = await signedUrls([...new Set(items.flatMap(figurePaths))])
  return items.map((q) => {
    const imageUrl = q.image && urls[q.image.path]
    const solutionImageUrl = q.solutionImage && urls[q.solutionImage.path]
    const groupImageUrl = q.group?.image && urls[q.group.image.path]
    if (!imageUrl && !solutionImageUrl && !groupImageUrl) return q
    return {
      ...q,
      ...(imageUrl ? { imageUrl } : {}),
      ...(solutionImageUrl ? { solutionImageUrl } : {}),
      ...(groupImageUrl ? { group: { ...q.group, imageUrl: groupImageUrl } } : {}),
    }
  })
}
