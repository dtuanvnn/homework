import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { LocalDraft } from "./drafts"
import type { OutboxItem } from "./outbox"
import type { PackEntry } from "./pack"

/*
 * The device's offline storage (browser only): downloaded assignments and their
 * figures, drafts written before any network call, and hand-ins waiting to be
 * sent. Everything a child owns is keyed by their student id.
 */

export interface OfflineMeta {
  /** Server clock minus device clock, from the last reply that carried server time. */
  clockOffsetMs: number
  lastStudentId: string
  lastStudentName: string
}

interface OfflineDB extends DBSchema {
  packs: { key: [string, string]; value: PackEntry; indexes: { student: string } }
  images: { key: string; value: Blob }
  drafts: { key: [string, string]; value: LocalDraft }
  outbox: { key: string; value: OutboxItem; indexes: { student: string } }
  meta: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

function db(): Promise<IDBPDatabase<OfflineDB>> {
  dbPromise ??= openDB<OfflineDB>("hh-offline", 1, {
    upgrade(d) {
      d.createObjectStore("packs", { keyPath: ["studentId", "assignmentId"] }).createIndex("student", "studentId")
      d.createObjectStore("images")
      d.createObjectStore("drafts", { keyPath: ["studentId", "assignmentId"] })
      d.createObjectStore("outbox", { keyPath: "clientId" }).createIndex("student", "studentId")
      d.createObjectStore("meta")
    },
  })
  return dbPromise
}

export const listPack = async (studentId: string) => (await db()).getAllFromIndex("packs", "student", studentId)
export const getPackEntry = async (studentId: string, assignmentId: string) => (await db()).get("packs", [studentId, assignmentId])
export const putPackEntry = async (entry: PackEntry) => void (await (await db()).put("packs", entry))
export const deletePackEntry = async (studentId: string, assignmentId: string) => (await db()).delete("packs", [studentId, assignmentId])

export async function clearPack(studentId: string): Promise<void> {
  const d = await db()
  const keys = await d.getAllKeysFromIndex("packs", "student", studentId)
  const tx = d.transaction("packs", "readwrite")
  await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done])
}

export const getImage = async (path: string) => (await db()).get("images", path)
export const putImage = async (path: string, blob: Blob) => void (await (await db()).put("images", blob, path))

export const getDraft = async (studentId: string, assignmentId: string) => (await db()).get("drafts", [studentId, assignmentId])
export const putDraft = async (draft: LocalDraft) => void (await (await db()).put("drafts", draft))
export const deleteDraft = async (studentId: string, assignmentId: string) => (await db()).delete("drafts", [studentId, assignmentId])
export const listDrafts = async (studentId: string) => (await (await db()).getAll("drafts")).filter((d) => d.studentId === studentId)

export const listOutbox = async (studentId: string) => (await db()).getAllFromIndex("outbox", "student", studentId)
export const putOutbox = async (item: OutboxItem) => void (await (await db()).put("outbox", item))
export const deleteOutbox = async (clientId: string) => (await db()).delete("outbox", clientId)

export async function getMeta<K extends keyof OfflineMeta>(key: K): Promise<OfflineMeta[K] | undefined> {
  return (await (await db()).get("meta", key)) as OfflineMeta[K] | undefined
}
export const setMeta = async <K extends keyof OfflineMeta>(key: K, value: OfflineMeta[K]) => void (await (await db()).put("meta", value, key))

/** Lets screens re-read the store after the sync runner changed it. */
export const OFFLINE_CHANGED = "hh-offline-changed"
export const notifyOfflineChanged = () => window.dispatchEvent(new Event(OFFLINE_CHANGED))
