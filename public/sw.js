const CACHE = 'hermes-topics-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const clone = r.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
          return r
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  )
})
