const CACHE = "motel-capture-shell-v2";
const SHELL = new Set(["/", "/login", "/capture", "/offline.html"]);

self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...SHELL]))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.searchParams.has("_rsc") || request.headers.has("RSC") || request.headers.has("Next-Router-State-Tree") || url.pathname.includes("signed")) return;
  const captureNavigation = request.mode === "navigate" && (url.pathname === "/capture" || url.pathname.startsWith("/capture/"));
  if (!SHELL.has(url.pathname) && !captureNavigation) return;
  event.respondWith(fetch(request).then((response) => { if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; }).catch(() => caches.match(request).then((cached) => cached ?? caches.match("/offline.html"))));
});
