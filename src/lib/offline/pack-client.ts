import { getOfflinePack } from "@/server/actions/offline"
import { offsetFrom } from "./drafts"
import { planPackUpdate, staleDrafts, type PackEntry } from "./pack"
import {
  clearPack, deleteDraft, deletePackEntry, getImage, listDrafts, listOutbox, listPack, notifyOfflineChanged, putImage, putPackEntry, setMeta,
} from "./store"

/*
 * Downloads the child's open assignments to the device (browser only): pack
 * data into IndexedDB, figures as blobs keyed by their storage path (signed
 * URLs expire after an hour), and the MathLive chunk so the service worker
 * caches it.
 */

let running: Promise<void> | null = null

/** One download at a time; a second call while one runs waits for it. */
export function refreshPack(studentId: string): Promise<void> {
  running ??= download(studentId).finally(() => {
    running = null
  })
  return running
}

async function download(studentId: string): Promise<void> {
  const sentAt = Date.now()
  const res = await getOfflinePack().catch(() => null)
  if (!res) return // no network
  if (!res.ok) {
    if (res.locked) await clearPack(studentId)
    return
  }
  const { pack } = res
  if (pack.studentId !== studentId) return
  await Promise.all([
    setMeta("clockOffsetMs", offsetFrom(pack.serverNow, sentAt, Date.now())),
    setMeta("lastStudentId", pack.studentId),
    setMeta("lastStudentName", pack.studentName),
  ])

  const [stored, allDrafts, outbox] = await Promise.all([listPack(studentId), listDrafts(studentId), listOutbox(studentId)])
  const queued = new Set(outbox.map((o) => o.assignmentId))
  const stale = new Set(staleDrafts(allDrafts, pack.entries, queued))
  await Promise.all([...stale].map((id) => deleteDraft(studentId, id)))
  const drafts = allDrafts.filter((d) => !stale.has(d.assignmentId))
  const busy = new Set([...drafts.map((d) => d.assignmentId), ...queued])
  const { put, remove } = planPackUpdate(stored, pack.entries, busy)
  await Promise.all(remove.map((id) => deletePackEntry(studentId, id)))

  for (const entry of put) {
    let complete = true
    // Every câu of a bài carries the same shared figure: download it once.
    const saving = new Map<string, Promise<boolean>>()
    const save = (path: string, url: string | undefined) => {
      if (!saving.has(path)) saving.set(path, saveImage(path, url))
      return saving.get(path)!
    }
    const questions = await Promise.all(
      entry.questions.map(async (q) => {
        const { imageUrl, ...rest } = q as typeof q & { imageUrl?: string }
        if (q.image && !(await save(q.image.path, imageUrl))) complete = false
        if (!q.group) return rest as typeof q
        const { imageUrl: groupImageUrl, ...group } = q.group
        if (group.image && !(await save(group.image.path, groupImageUrl))) complete = false
        return { ...rest, group } as typeof q
      }),
    )
    const saved: PackEntry = { ...entry, questions, studentId, complete }
    await putPackEntry(saved)
  }
  if (put.length || remove.length || stale.size) notifyOfflineChanged()
}

async function saveImage(path: string, url: string | undefined): Promise<boolean> {
  if (await getImage(path)) return true
  if (!url) return false
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    await putImage(path, await res.blob())
    return true
  } catch {
    return false
  }
}
