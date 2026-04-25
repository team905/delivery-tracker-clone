/* sw.js — QuickGo app-shell service worker
 *
 * Strategy:
 *   • Static assets (CSS, JS, SVG, images, fonts) → stale-while-revalidate
 *   • HTML documents                              → network-first (cache fallback)
 *   • API & Socket.IO (/api/, /socket.io/)        → network-only (never cached)
 *
 * The cache name embeds a version. To bust caches on deploy, bump SW_VERSION.
 */

const SW_VERSION = "qg-2026-04-25-1";
const STATIC_CACHE = `qg-static-${SW_VERSION}`;
const HTML_CACHE = `qg-html-${SW_VERSION}`;

/* App-shell URLs we want available before any request actually needs them. */
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/styles.css",
  "/native.css",
  "/experience.css",
  "/native.js",
  "/experience.js",
  "/auth-client.js",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      /* Don't fail install if any single asset is unavailable. */
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {})
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(SW_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* Helper — never cache cross-origin POST or websocket-related requests. */
function isApi(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/");
}
function isHtml(req) {
  return req.mode === "navigate" || req.destination === "document";
}
function isStatic(req) {
  return ["style", "script", "image", "font"].includes(req.destination);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache POST/PUT/DELETE
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // pass-through CDN tiles, etc
  if (isApi(url)) return; // network only — important for live tracking & sockets

  if (isHtml(req)) {
    event.respondWith(networkFirst(req, HTML_CACHE));
    return;
  }
  if (isStatic(req)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }
  /* Fallback: try network, fall back to cache. */
  event.respondWith(
    fetch(req)
      .then((res) => res)
      .catch(() => caches.match(req).then((m) => m || new Response("", { status: 504 })))
  );
});

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(cacheName);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    /* Offline fallback — last known landing page. */
    const fallback = await caches.match("/");
    if (fallback) return fallback;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || new Response("", { status: 504 });
}

/* Listen for "skipWaiting" message so the page can request immediate update. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
