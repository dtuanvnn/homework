/**
 * Browser only: renders each page of a PDF to a JPEG file, so scans are
 * plain images (DeepSeek reads images, not PDFs) and every page shows in
 * the review viewer.
 */
export async function pdfToImages(file: File, maxSide = 2000, maxPages = 20): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const base = file.name.replace(/\.pdf$/i, "")
  const pages: File[] = []
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n)
      const unscaled = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: maxSide / Math.max(unscaled.width, unscaled.height) })
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvas, viewport }).promise
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
      if (blob) pages.push(new File([blob], `${base}-trang-${n}.jpg`, { type: "image/jpeg" }))
      page.cleanup()
    }
  } finally {
    await task.destroy()
  }
  return pages
}
