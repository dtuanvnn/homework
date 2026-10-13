import type { ScanResult } from "@/lib/ai/scan"
import type { Attachment, ExerciseKind, SubjectId } from "@/lib/types"
import type { ReviewItem } from "@/components/upload/review-utils"

/*
 * Unsaved scan results, kept in localStorage so an accidental back, reload
 * or closed tab doesn't lose a scan. The files are already in Storage (under
 * `setId`), so restoring needs no new upload or scan.
 */

const KEY = "hh-scan-draft"
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface ScanDraft {
  version: 1
  setId: string
  savedAt: string
  meta: { subject: SubjectId; grade: number; kind: ExerciseKind }
  title: string
  details: Omit<ScanResult, "items" | "title"> | null
  items: ReviewItem[]
  /** Only uploaded files: their Storage path survives, blob previews don't. */
  files: Pick<Attachment, "id" | "name" | "kind" | "sizeKb" | "pages" | "uploaded">[]
  /** How many of `files` were scanned; later ones were added but not scanned yet. Missing in older drafts: all. */
  scannedCount?: number
}

export function loadScanDraft(): ScanDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as ScanDraft
    const fresh = Date.now() - new Date(draft.savedAt).getTime() < MAX_AGE_MS
    if (draft.version !== 1 || !fresh || !Array.isArray(draft.items) || !draft.items.length || !Array.isArray(draft.files)) {
      localStorage.removeItem(KEY)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function saveScanDraft(draft: Omit<ScanDraft, "version" | "savedAt">) {
  try {
    const files = draft.files.filter((f) => f.uploaded).map(({ id, name, kind, sizeKb, pages, uploaded }) => ({ id, name, kind, sizeKb, pages, uploaded }))
    localStorage.setItem(KEY, JSON.stringify({ ...draft, files, version: 1, savedAt: new Date().toISOString() } satisfies ScanDraft))
  } catch {
    // Private mode or storage full: the scan still works, it just can't be restored.
  }
}

export function clearScanDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
