// SERVICE WORKER — DISABLED
// This SW immediately unregisters itself and clears all caches.
// The old cache-first SW was blocking all code updates from reaching the browser.
// Until caching is properly needed, run without a service worker.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => {
      // Unregister this service worker
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Pass ALL requests straight to network — no caching
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
