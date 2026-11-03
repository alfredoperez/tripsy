// Tripsy service worker: photos download once, and the app opens with no signal.
//
// - Images: cache first. A photo is fetched the first time it is shown and
//   served from the phone after that. Stored copies are named by content hash,
//   so they never go stale.
// - Next.js build files (/_next/static): cache first; their names change on
//   every deploy.
// - Pages and other same-origin requests: network first, falling back to the
//   last copy when offline.
// - Everything else (Supabase API, Mapbox) goes straight to the network; trip
//   data is kept by the app itself in localStorage.

const VERSION = "v1";
const IMAGES = `tripsy-images-${VERSION}`;
const STATIC = `tripsy-static-${VERSION}`;
const PAGES = `tripsy-pages-${VERSION}`;
const KEEP = [IMAGES, STATIC, PAGES];
const MAX_IMAGES = 500;
const MAX_STATIC = 300;
const MAX_PAGES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add("/"))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name.startsWith("tripsy-") && !KEEP.includes(name)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Drop the oldest entries past the limit; Cache keys come back in insertion order. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Only this app's own hashed build files may be added on the page's say-so. */
function isBuildFile(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === self.location.origin && parsed.pathname.startsWith("/_next/static/");
  } catch {
    return false;
  }
}

function cacheable(response) {
  // Opaque responses come from <img> tags pointing at hosts without CORS;
  // they cannot be inspected but still render, so keep them.
  return response && (response.ok || response.type === "opaque");
}

async function cacheFirst(event, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (cacheable(response)) {
    event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(cacheName, max)));
  }
  return response;
}

async function networkFirst(event, cacheName, max) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(event.request);
    if (response.ok) {
      event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(cacheName, max)));
    }
    return response;
  } catch (error) {
    const hit = await cache.match(event.request, { ignoreVary: true });
    if (hit) return hit;
    if (event.request.mode === "navigate") return offlinePage();
    throw error;
  }
}

/** A page never opened online: say so instead of showing a different page. */
function offlinePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tripsy</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f2f2f0;color:#111}main{max-width:24rem;margin:0 auto;padding:4rem 1rem}h1{font-size:2.5rem;margin:0 0 .5rem}a{color:inherit}</style></head>
<body><main><h1>Offline</h1><p>This page isn’t saved on this phone yet. Trips you opened before work offline.</p><p><a href="/">Your trips</a></p></main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.protocol !== "https:" && url.hostname !== "localhost") return;

  if (request.destination === "image") {
    event.respondWith(cacheFirst(event, IMAGES, MAX_IMAGES));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, STATIC, MAX_STATIC));
    return;
  }

  event.respondWith(networkFirst(event, PAGES, MAX_PAGES));
});

// From the app: save the page being viewed (its first load may have happened
// before this worker took control), or, on sign-out, clear the photo and page
// caches along with the saved trips.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "tripsy:remember" && typeof data.path === "string" && data.path.startsWith("/")) {
    const assets = Array.isArray(data.assets) ? data.assets.filter(isBuildFile) : [];
    event.waitUntil(
      Promise.all([
        caches
          .open(PAGES)
          .then((cache) => cache.add(new Request(data.path, { credentials: "same-origin" })))
          .then(() => trim(PAGES, MAX_PAGES)),
        caches.open(STATIC).then((cache) =>
          Promise.all(
            assets.map((url) => cache.match(url).then((hit) => hit || cache.add(url).catch(() => {}))),
          ),
        ),
      ]).catch(() => {}),
    );
    return;
  }
  if (data === "tripsy:clear") {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith("tripsy-")).map((n) => caches.delete(n)))));
  }
});
