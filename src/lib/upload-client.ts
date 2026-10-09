import type { NewFile } from "@/server/actions/library"
import type { UploadTarget } from "@/server/storage"

/**
 * Downscales a photo in the browser before upload: iPad/phone photos are
 * often 3–12 MB, while ~2000 px is plenty for reading handwriting and keeps
 * each image under Claude's per-image limit. PDFs and small images pass through.
 */
export async function shrinkImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
}

/**
 * Uploads files straight to Storage with one-time signed URLs issued by a
 * Server Action, and returns the metadata to save alongside the paths.
 */
export async function uploadFiles(files: File[], requestTargets: (names: string[]) => Promise<UploadTarget[]>): Promise<NewFile[]> {
  if (!files.length) return []
  const targets = await requestTargets(files.map((f) => f.name))
  return Promise.all(
    files.map(async (file, i) => {
      const target = targets[i]
      const res = await fetch(target.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
      })
      if (!res.ok) throw new Error(`Không tải lên được “${file.name}”`)
      return {
        path: target.path,
        name: file.name,
        kind: file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "pdf" : "image",
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      } satisfies NewFile
    }),
  )
}
