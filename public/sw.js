// LOOP service worker — makes the app installable and speeds up repeat loads.
//
// IMPORTANT: this file is GENERATED from scripts/sw.template.js by
// scripts/generate-sw.mjs (wired as the npm `prebuild` step). Do NOT edit
// public/sw.js by hand — edit this template instead. The generator injects a
// per-deploy build id into CACHE_VERSION so every deploy gets a unique cache
// name; the `activate` handler then purges ALL caches from previous builds,
// which is what guarantees a returning device converges onto the new bundle
// instead of serving a dead cached shell / stale chunks.
//
// Caching policy (deliberate):
// - /api/* and non-GET requests: NEVER cached, always live (auth + job data).
// - /_next/static/*: cache-first, but keyed under the per-build cache. Next.js
//   fingerprints these per build, and `activate` deletes previous builds'
//   caches, so old chunks cannot survive a deploy.
// - Page navigations: network-first, falling back to the cached app shell when
//   offline. LOOP has no offline data mode — the fallback just avoids a dead
//   browser error page until connectivity returns. The shell lives in the
//   per-build cache, so it is purged on every deploy and can never pin a device
//   to an old build while online (network-first always wins when reachable).

const CACHE_VERSION = "loop-pwa-dev";
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

  // Versioned build assets: safe to cache aggressively within a build. Old
  // builds' assets are purged by the `activate` handler above.
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
