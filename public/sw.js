/*
 * incREDible service worker.
 *
 * Deliberately minimal: its job is to make the app installable and give
 * previously-visited pages a basic offline fallback — not to aggressively
 * cache. It is network-first, so an online user always gets fresh content and
 * never a stale session, and it stays entirely out of the way of auth and API
 * traffic (those are never cached).
 */
const CACHE = "incredible-runtime-v1"

self.addEventListener("install", () => {
  // Take over as soon as possible so the very first visit becomes installable.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Only same-origin static/page GETs. Auth and API responses are per-session
  // and must never be served from a shared cache.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)
        // Cache a copy of successful, cacheable responses for offline reuse.
        if (response && response.ok && response.type === "basic") {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      } catch (error) {
        const cached = await caches.match(request)
        if (cached) return cached
        throw error
      }
    })(),
  )
})
