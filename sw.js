const CACHE_NAME = 'microsenses-dogs-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/engine-369.js',
  '/js/bark-analysis-engine.js',
  '/js/dog-emotion-engine.js',
  '/js/dog-vision-analyzer.js',
  '/js/canine-translator.js',
  '/js/scan-report-agent.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for ALL JavaScript and HTML — always get latest code
  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isCodeAsset = url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/';

  if (!isLocal) {
    // CDN resources (TensorFlow etc) — network with cache fallback
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else if (isCodeAsset) {
    // JS and HTML — NETWORK FIRST, fall back to cache only if offline
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // CSS, images, manifest — cache first (these change rarely)
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
