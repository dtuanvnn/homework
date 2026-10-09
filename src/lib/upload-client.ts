import type { NewFile } from "@/server/actions/library"
import type { UploadTarget } from "@/server/storage"

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
