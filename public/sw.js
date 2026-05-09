const STATIC_CACHE = "xf-static-v3";
const PWA_ICON_WEBPS = [48, 72, 96, 128, 192, 256, 512].map((s) => `/icons/icon-${s}.webp`);
const STATIC_ASSETS = ["/manifest.webmanifest", "/pwa/atx-logo-512.png", ...PWA_ICON_WEBPS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const destination = request.destination;
  const canCache =
    destination === "script" ||
    destination === "style" ||
    destination === "image" ||
    destination === "font" ||
    destination === "manifest";

  if (!canCache) {
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            void cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? networkPromise;
    })
  );
});
