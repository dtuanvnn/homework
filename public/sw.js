/*
 * Homework Hub service worker (see docs/superpowers/specs/2026-10-17-pwa-offline-design.md).
 *
 * - Build assets (/_next/static, hashed and immutable), the math keyboard's
 *   fonts, icons and the manifest: cache-first, filled as the app loads them.
 * - The /offline screen and the assets it needs: cached at install and again
 *   whenever an online page asks ("refresh-offline").
 * - Page navigations: always the network. Without network, child pages and
 *   the home page get the cached /offline screen; parent pages a short notice.
 * - Never cached: dynamic HTML, RSC payloads, Server Actions, anything not GET.
 */

const STATIC = "hh-static-v1"
const SHELL = "hh-shell-v1"
const OFFLINE_URL = "/offline"

const CACHE_FIRST = [/^\/_next\/static\//, /^\/mathlive\//, /^\/icon/, /^\/apple-icon/, /^\/manifest\.webmanifest$/, /^\/sounds\//]

/** Caches the offline screen and every build asset its HTML references. */
async function cacheOfflineShell() {
  const res = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "same-origin" })
  if (!res.ok || res.redirected) return
  const html = await res.clone().text()
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])]
  const shell = await caches.open(SHELL)
  await shell.put(OFFLINE_URL, res)
  const statics = await caches.open(STATIC)
  await Promise.all(assets.map((url) => statics.match(url).then((hit) => hit || statics.add(url)).catch(() => {})))
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflineShell().catch(() => {}).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "refresh-offline") event.waitUntil(cacheOfflineShell().catch(() => {}))
})

const offlineNotice = () =>
  new Response(
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Không có mạng</title>' +
      '<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;color:#334155">' +
      "<div><p style=\"font-size:48px;margin:0\">📡</p><h1>Không có mạng</h1><p>Trang này cần có mạng. Em kết nối wifi rồi thử lại nhé.</p></div></body></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  )

async function navigate(request, url) {
  try {
    return await fetch(request)
  } catch {
    if (url.pathname === "/" || url.pathname === "/student" || url.pathname.startsWith("/student/") || url.pathname === OFFLINE_URL) {
      const shell = await caches.match(OFFLINE_URL, { cacheName: SHELL })
      if (shell) return shell
    }
    return offlineNotice()
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request, { cacheName: STATIC })
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) {
    const copy = res.clone()
    void caches.open(STATIC).then((c) => c.put(request, copy))
  }
  return res
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.headers.has("RSC") || request.headers.has("Next-Action") || url.searchParams.has("_rsc")) return
  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url))
    return
  }
  if (CACHE_FIRST.some((re) => re.test(url.pathname))) event.respondWith(cacheFirst(request))
})
