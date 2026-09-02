const CACHE_NAME = 'cylinder-tracker-v11';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(asset =>
            cache.add(asset).catch(e => console.warn('PWA Asset cache skip:', asset, e))
          )
        );
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Purging old PWA cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass external APIs (e.g., Supabase)
  if (url.origin !== self.location.origin) return;

  // Bypass this app's own dynamic API routes (e.g. /api/db) - these serve live database data
  // and must never be cached or intercepted. Letting them fall through to the network-first
  // handler below risked the SPA-fallback HTML (served for any unmatched same-origin path) being
  // cached under an /api/db?... key and replayed as a "200 OK" response with an HTML body instead
  // of JSON - this silently broke every hook's data fetch while looking like a success.
  if (url.pathname.startsWith('/api/')) return;

  // Network-First for HTML, Scripts & Styles so installed PWA always has latest code
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : null));
      })
  );
});