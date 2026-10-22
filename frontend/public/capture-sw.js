const CACHE = "motel-capture-shell-v4";
const SHELL = new Set(["/offline.html"]);
self.captureShouldHandle = (request, url) => { if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/portal") || url.pathname.startsWith("/capture") || url.searchParams.has("_rsc") || request.headers.has("RSC") || request.headers.has("Next-Router-State-Tree") || url.pathname.includes("signed")) return false; return SHELL.has(url.pathname); };

self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...SHELL]))); self.skipWaiting(); });
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = {}; }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 80) : "Cập nhật thanh toán";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 160) : "Hóa đơn của bạn có cập nhật mới.";
  const candidate = typeof payload.path === "string" ? payload.path : "";
  const path = candidate.startsWith("/portal/bills/") && !candidate.includes("//") && !candidate.includes("?") && !candidate.includes("#") ? candidate : "/portal";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/brand/favicon.svg", badge: "/brand/favicon.svg", data: { path }, tag: typeof payload.tag === "string" ? payload.tag.slice(0, 100) : undefined }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
const path = event.notification.data?.path;
   if (typeof path !== "string" || !path.startsWith("/portal") || path.startsWith("//") || path.includes("?") || path.includes("#")) return;
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin + "/portal"));
    if (existing) { void existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const request = event.request; const url = new URL(request.url);
  if (!self.captureShouldHandle(request, url)) return;
  event.respondWith(fetch(request).then((response) => { if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; }).catch(() => caches.match(request).then((cached) => cached ?? caches.match("/offline.html"))));
});
