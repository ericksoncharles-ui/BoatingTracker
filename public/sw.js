// Caches the app shell (same-origin only) so the planner still opens and runs
// with no signal out on the Sound. Chart tiles are cross-origin and deliberately
// left uncached here to avoid unbounded storage growth.
//
// Bump CACHE_NAME on every deploy that should reach already-installed clients
// immediately. Network-first below already refreshes the cache on every
// successful fetch, but a version bump forces `activate` to drop the old
// cache outright instead of leaving a stale entry a flaky connection could
// still serve.
const CACHE_NAME = 'lis-trip-planner-v3'
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

// The built JS and CSS carry a content hash in their names, so they can't be
// listed above; they are read out of the page itself instead. Caching the page
// alone was not enough. The first visit fetches the code before this worker is
// in control, so none of it was cached, and the first launch with no signal
// opened a cached page onto a blank screen.
const ASSET = /(?:src|href)="(\/assets\/[^"]+)"/g

async function assetsOf(cache) {
  const page = await cache.match('/')
  if (!page) return []
  return [...new Set([...(await page.text()).matchAll(ASSET)].map((m) => m[1]))]
}

// A deploy that keeps this file unchanged never reinstalls it, so the old
// build's files would stay in the cache next to the new ones for good. Once
// the page has been replaced, anything under /assets/ it no longer names goes.
async function pruneAssets(cache) {
  const current = new Set(await assetsOf(cache))
  if (current.size === 0) return
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/assets/') && !current.has(pathname)) await cache.delete(request)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)
    await cache.addAll(await assetsOf(cache))
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // The briefing and the fishing summary are answers for now, and their cards
  // say so when the server can't be reached. An old one from the cache would
  // pass for a fresh one.
  if (url.pathname.startsWith('/api/')) return

  // A hashed file never changes under its name, so the cache is always right
  // for it, and going to the network first would only make a flaky connection
  // hold the page up.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      }))
    )
    return
  }

  // Network-first: a boater underway wants this trip's fix, not the build that
  // was current when the app was first installed. `cached || network` here
  // used to hand back the stale cache forever once a request had ever been
  // cached, since the network response was only used to refresh the cache for
  // a *future* request rather than for this one — so a deployed fix (like
  // making the AI briefing opt-in) never reached anyone who'd already loaded
  // the app. Falling back to cache only on a failed fetch keeps the offline
  // guarantee while letting a live connection always win.
  const navigate = request.mode === 'navigate'
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          // The shell is stored under '/' whatever address opened it, which is
          // the key the offline fallback and the asset list both read. Only a
          // page, though: opening the icon in a tab is a navigation too.
          const page = navigate && (response.headers.get('content-type') || '').includes('text/html')
          caches.open(CACHE_NAME).then(async (cache) => {
            await cache.put(page ? '/' : request, copy)
            if (page) await pruneAssets(cache)
          })
        }
        return response
      })
      // Any address in the app is the same single page, so a launch from a
      // bookmarked or shared link opens offline as well as one from the icon.
      .catch(() => caches.match(request).then((cached) => cached || (navigate ? caches.match('/') : undefined)))
  )
})
