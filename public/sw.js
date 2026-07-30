// Caches the app shell (same-origin only) so the planner still opens and runs
// with no signal out on the Sound. Chart tiles are cross-origin and deliberately
// left uncached here to avoid unbounded storage growth.
//
// Bump CACHE_NAME on every deploy that should reach already-installed clients
// immediately. Network-first below already refreshes the cache on every
// successful fetch, but a version bump forces `activate` to drop the old
// cache outright instead of leaving a stale entry a flaky connection could
// still serve.
const CACHE_NAME = 'lis-trip-planner-v2'
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
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
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // Network-first: a boater underway wants this trip's fix, not the build that
  // was current when the app was first installed. `cached || network` here
  // used to hand back the stale cache forever once a request had ever been
  // cached, since the network response was only used to refresh the cache for
  // a *future* request rather than for this one — so a deployed fix (like
  // making the AI briefing opt-in) never reached anyone who'd already loaded
  // the app. Falling back to cache only on a failed fetch keeps the offline
  // guarantee while letting a live connection always win.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
