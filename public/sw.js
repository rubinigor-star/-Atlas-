const CACHE = "atlas-office-v2";
const SHELL = ["/atlas-app-icon.svg"];
const ALLOWED_PREFIXES = ["/office", "/admin", "/scanner"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("atlas-office-") && key !== CACHE).map((key) => caches.delete(key))),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isOfficeRoute = ALLOWED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  const isStaticAsset = url.pathname === "/atlas-app-icon.svg";
  if (!isOfficeRoute && !isStaticAsset) return;

  if (isStaticAsset) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }

  event.respondWith(fetch(event.request));
});
