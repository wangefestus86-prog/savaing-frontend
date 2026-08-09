// Minimal service worker. Its main job for now is just to exist and be
// registered, which is one of the requirements for a website to count as
// an "installable" app. We cache the app shell so it also opens instantly
// on repeat visits, even on a slow connection.
const CACHE_NAME = "njangi-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Never cache API calls to the backend - those must always be live/fresh.
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
