const CACHE = "motel-capture-shell-v1";
const SHELL = ["/", "/login", "/offline.html"];

self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => { const request = event.request; if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return; event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match("/offline.html")))); });
