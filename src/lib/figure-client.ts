import { unwrap } from "@/lib/action-result"
import { cropRect, type Box } from "@/lib/figure-crop"
import { FIGURE_FILE_NAME } from "@/lib/figures"
import type { QuestionImage } from "@/lib/types"
import { uploadFiles } from "@/lib/upload-client"
import { requestSetUploads } from "@/server/actions/library"

/** Cuts a box out of a page image (a picked file or a signed URL) into a JPEG on white. */
export async function cropFigure(source: Blob | string, box: Box, { padding = 0.03, maxSide = 1200 } = {}) {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source
  const bitmap = await createImageBitmap(blob)
  const r = cropRect(box, bitmap.width, bitmap.height, padding)
  const scale = Math.min(1, maxSide / Math.max(r.width, r.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(r.width * scale))
  canvas.height = Math.max(1, Math.round(r.height * scale))
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88))
  if (!jpeg) throw new Error("Không cắt được hình")
  return { file: new File([jpeg], FIGURE_FILE_NAME, { type: "image/jpeg" }), width: canvas.width, height: canvas.height }
}

/** Crops, uploads under the set's folder, and returns the question image plus a local preview URL. */
export async function makeFigure(setId: string, source: Blob | string, box: Box, opts: { padding?: number } = {}) {
  const { file, width, height } = await cropFigure(source, box, opts)
  const [uploaded] = await uploadFiles([file], async (names) => unwrap(await requestSetUploads(setId, names)))
  const image: QuestionImage = { path: uploaded.path, width, height }
  return { image, imageUrl: URL.createObjectURL(file) }
}
