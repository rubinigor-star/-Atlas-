const CACHE = "atlas-office-v1";
const SHELL = ["/office", "/atlas-app-icon.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).then((response) => { const copy=response.clone(); void caches.open(CACHE).then((cache)=>cache.put(event.request,copy)); return response; }).catch(() => caches.match(event.request).then((response) => response || caches.match("/office"))));
});
