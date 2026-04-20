const CACHE_NAME = 'distromax-v1'
const OFFLINE_URL = '/offline.html'
const ASSETS = ['/', OFFLINE_URL, '/manifest.webmanifest', '/pwa-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      return cached || caches.match(OFFLINE_URL)
    }),
  )
})

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'DistroMaxi', {
      body: data.body || 'Nueva actualización disponible.',
      icon: '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      data: data.data || {},
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const orderId = event.notification.data?.order_id
  const url = orderId ? `/tracking/${orderId}` : '/orders'
  event.waitUntil(self.clients.openWindow(url))
})
