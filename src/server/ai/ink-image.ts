import "server-only"
import { Resvg } from "@resvg/resvg-js"
import { inkPageSvg, pageIsEmpty, type Ink } from "@/lib/ink"

/** Width of the page images sent to the AI: large enough to read grade-3 handwriting. */
const AI_PAGE_WIDTH = 1500

/** PNG (base64) of every page with writing on it, with its 1-based page number. */
export function inkPagePngs(ink: Ink): { page: number; data: string }[] {
  return ink.pages.flatMap((p, i) => {
    if (pageIsEmpty(p)) return []
    const png = new Resvg(inkPageSvg(ink, i, { width: AI_PAGE_WIDTH })).render().asPng()
    return [{ page: i + 1, data: Buffer.from(png).toString("base64") }]
  })
}
