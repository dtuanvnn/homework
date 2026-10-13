import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/*
 * Supabase Storage, server side only. The bucket is private: the browser
 * gets short-lived signed URLs, never a key.
 */

const BUCKET = process.env.STORAGE_BUCKET ?? "homework"
const SIGNED_URL_SECONDS = 60 * 60

let client: SupabaseClient | null = null
function storage() {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set for file storage")
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client.storage
}

let bucketReady: Promise<void> | null = null
/** Creates the private bucket on first use (idempotent). */
export function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const { data } = await storage().getBucket(BUCKET)
    if (data) return
    const { error } = await storage().createBucket(BUCKET, { public: false, fileSizeLimit: "20MB" })
    if (error && !/already exists/i.test(error.message)) throw error
  })().catch((err) => {
    bucketReady = null
    throw err
  })
  return bucketReady
}

/** ASCII-only object names: strips Vietnamese tone marks, keeps letters, digits, dot, dash, underscore. */
function safeName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w.-]+/g, "-").slice(-80)
}

export type StorageFolder = "sets" | "attempts"

export interface UploadTarget {
  path: string
  /** PUT the raw file body here; valid for 2 hours. */
  signedUrl: string
}

/**
 * Files go straight from the browser to Storage (Vercel caps request bodies
 * at ~4.5 MB, smaller than a single iPad photo can be). The server only hands
 * out one-time upload URLs and later records the paths.
 */
export async function createUploadTargets(folder: StorageFolder, ownerId: string, names: string[]): Promise<UploadTarget[]> {
  await ensureBucket()
  return Promise.all(
    names.map(async (name) => {
      const path = `${folder}/${ownerId}/${crypto.randomUUID()}-${safeName(name)}`
      const { data, error } = await storage().from(BUCKET).createSignedUploadUrl(path)
      if (error) throw error
      return { path, signedUrl: data.signedUrl }
    }),
  )
}

/** True when `path` was issued for this owner and the object exists. */
export async function isUploaded(folder: StorageFolder, ownerId: string, path: string): Promise<boolean> {
  const prefix = `${folder}/${ownerId}/`
  if (!path.startsWith(prefix) || path.includes("..")) return false
  const { data } = await storage().from(BUCKET).exists(path)
  return Boolean(data)
}

/** Reads an object server side (e.g. to send a scan to Claude). */
export async function downloadFromStorage(path: string): Promise<{ data: Buffer; contentType: string }> {
  const { data, error } = await storage().from(BUCKET).download(path)
  if (error || !data) throw new Error("Không đọc được tệp đã tải lên")
  return { data: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" }
}

export async function removeFromStorage(paths: string[]) {
  if (!paths.length) return
  const { error } = await storage().from(BUCKET).remove(paths)
  if (error) throw error
}

export async function attachmentUrl(row: { storagePath: string | null; externalUrl: string | null }): Promise<string | undefined> {
  if (row.externalUrl) return row.externalUrl
  if (!row.storagePath) return undefined
  const { data, error } = await storage().from(BUCKET).createSignedUrl(row.storagePath, SIGNED_URL_SECONDS)
  if (error) return undefined
  return data.signedUrl
}

/** Signed read URLs for many objects at once, keyed by path (missing ones are left out). */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  if (!unique.length) return {}
  const { data, error } = await storage().from(BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS)
  if (error || !data) return {}
  return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])))
}

/** Full paths of the objects directly inside an owner's folder. */
export async function listFolder(folder: StorageFolder, ownerId: string): Promise<string[]> {
  const prefix = `${folder}/${ownerId}`
  const { data, error } = await storage().from(BUCKET).list(prefix, { limit: 1000 })
  if (error || !data) return []
  return data.map((o) => `${prefix}/${o.name}`)
}
