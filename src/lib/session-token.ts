/*
 * The hh_pin cookie: base64url(JSON payload).base64url(HMAC-SHA256). Web Crypto
 * only, so the proxy can verify it without the database. Names the mode, the
 * household and (student mode) the child.
 */

export type SessionRole = "parent" | "student"

export interface SessionPayload {
  v: 1
  role: SessionRole
  householdId: string
  studentId?: string
  /** Issued at, seconds since epoch. */
  iat: number
}

export const SESSION_MAX_AGE: Record<SessionRole, number> = { parent: 30 * 86_400, student: 180 * 86_400 }

const enc = new TextEncoder()

const toB64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

function fromB64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signToken(payload: SessionPayload, secret: string): Promise<string> {
  const body = toB64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${await hmac(secret, body)}`
}

function isPayload(p: unknown): p is SessionPayload {
  if (!p || typeof p !== "object") return false
  const o = p as Record<string, unknown>
  if (o.v !== 1 || (o.role !== "parent" && o.role !== "student")) return false
  if (typeof o.householdId !== "string" || typeof o.iat !== "number") return false
  if (o.role === "student" && typeof o.studentId !== "string") return false
  return true
}

export async function verifyToken(value: string | undefined, secret: string, nowMs = Date.now()): Promise<SessionPayload | null> {
  if (!value) return null
  const parts = value.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  if (!safeEqual(await hmac(secret, parts[0]), parts[1])) return null
  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])))
  } catch {
    return null
  }
  if (!isPayload(payload)) return null
  const age = nowMs / 1000 - payload.iat
  if (age > SESSION_MAX_AGE[payload.role] || age < -300) return null
  return payload
}

export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET
  if (env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set")
  return "homework-hub-dev-secret"
}
