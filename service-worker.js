// N199RF Pilot Reference - Service Worker
// Caches all pages for offline use after first visit

const CACHE_NAME = 'n199rf-v4-flights';
const ASSETS = [
  '/',
  '/course/',
  '/ppl/',
  '/c150/',
  '/g3x-pfd/',
  '/gtn750/',
  '/gfc500/',
  '/flight-1-flint-hills/',
  '/flight-2-kict-class-c/',
  '/flight-3-beaumont/',
  '/flight-4-hutchinson/',
  '/flight-5-jabara/',
  '/manifest.json',
  // Google Fonts (cached on first load)
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap',
];

// Install: pre-cache the core pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Try to cache each one individually so a single failure doesn't break install
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('Failed to cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for pages, network-first for GitHub API (sync)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache GitHub API calls (sync needs to be live)
  if (url.hostname === 'api.github.com' || url.hostname === 'gist.githubusercontent.com') {
    return; // Let browser handle normally
  }

  // For navigation requests and assets, use cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached version, but also fetch in background to update cache
        fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }

      // Not in cache — try network
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => {
        // Network failed and not in cache — return basic offline message
        if (event.request.mode === 'navigate') {
          return new Response(
            '<html><body style="font-family:system-ui;padding:40px;text-align:center"><h1>Offline</h1><p>This page isn\'t cached yet. Connect to wifi and visit it once to make it available offline.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      });
    })
  );
});
