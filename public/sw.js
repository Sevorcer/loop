// LOOP service worker — makes the app installable and speeds up repeat loads.
//
// Caching policy (deliberate):
// - /api/* and non-GET requests: NEVER cached, always live (auth + job data).
// - /_next/static/*: cache-first (Next.js fingerprints these per build, so stale
//   assets are impossible across deploys).
// - Page navigations: network-first, falling back to the cached app shell when
//   offline. Note: LOOP has no offline data mode — the fallback just avoids a
//   dead browser error page until connectivity returns.

const CACHE_VERSION = "loop-pwa-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API + auth traffic always goes to the network. Never cache it.
  if (url.pathname.startsWith("/api/")) return;

  // Versioned build assets: safe to cache aggressively.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  // Navigations: live when online, app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_VERSION)
            .then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
  }
});
