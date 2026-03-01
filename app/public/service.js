
const SERVICE_NAME = "coai";

self.addEventListener('activate', function (event) {
  console.debug("[service] service worker activated");
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SERVICE_NAME)
      .then(function (cache) {
        return cache.addAll([]);
      })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request)
      .then(function (response) {
        if (response) return response;
        return fetch(request).catch(function () {
          return new Response("", { status: 504, statusText: "Gateway Timeout" });
        });
      })
  );
});
