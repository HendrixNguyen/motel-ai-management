import { describe, expect, it, vi } from "vitest";

type Event = { type: string; request?: Request; respondWith?: ReturnType<typeof vi.fn>; waitUntil?: ReturnType<typeof vi.fn> };

describe("capture service worker behavior", () => {
  it("executes install, activate, and fetch boundaries", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../../../public/capture-sw.js", import.meta.url), "utf8"));
    const listeners = new Map<string, (event: Event) => void>();
    const shell = new Map<string, Response>();
    const cache = { addAll: vi.fn(async (urls: string[]) => { for (const url of urls) shell.set(url, new Response(`shell:${url}`)); }), put: vi.fn(async (request: Request, response: Response) => { shell.set(request.url, response); }), match: vi.fn(async (request: Request | string) => { const response = shell.get(typeof request === "string" ? request : new URL(request.url).pathname); return response?.clone(); }) };
    let captureFetches = 0; const fetchMock = vi.fn(async (request: Request) => { if (request.url.includes("/capture/") && captureFetches++ > 0) throw new Error("offline"); return new Response(`network:${new URL(request.url).pathname}`); });
    const context = { location: { origin: "http://localhost" }, addEventListener: (type: string, handler: (event: Event) => void) => listeners.set(type, handler), skipWaiting: vi.fn(), clients: { claim: vi.fn() }, caches: { open: vi.fn(async () => cache), match: cache.match }, fetch: fetchMock };
    new Function("self", "caches", "fetch", source)(context, context.caches, fetchMock);
    const install: Event = { type: "install", waitUntil: vi.fn() }; listeners.get("install")!(install); await install.waitUntil!.mock.calls[0]![0];
    expect(cache.addAll).toHaveBeenCalledWith(["/", "/login", "/capture", "/offline.html"]);
    const activate: Event = { type: "activate", waitUntil: vi.fn() }; listeners.get("activate")!(activate); await activate.waitUntil!.mock.calls[0]![0]; expect(context.clients.claim).toHaveBeenCalled();
    const fetchCase = async (url: string, init: RequestInit = {}) => { const request = { method: init.method ?? "GET", mode: init.mode ?? "same-origin", headers: new Headers(init.headers), url: `http://localhost${url}` } as unknown as Request; const event: Event = { type: "fetch", request, respondWith: vi.fn() }; listeners.get("fetch")!(event); if (event.respondWith!.mock.calls.length) return event.respondWith!.mock.calls[0]![0] as Promise<Response>; return undefined; };
    const online = await fetchCase("/capture/period/room", { mode: "navigate" as RequestMode });
    const onlineResponse = await online!; expect(onlineResponse.status).toBe(200); expect(await onlineResponse.clone().text()).toContain("network:/capture/period/room"); expect(cache.put).toHaveBeenCalled();
    const api = await fetchCase("/api/auth/me"); expect(api).toBeUndefined();
    const signed = await fetchCase("/capture/signed-url"); expect(signed).toBeUndefined();
    const exclusions = [
      ["/capture", { method: "POST" }], ["/_next/static/app.js", {}], ["/capture?_rsc=1", {}], ["/capture", { headers: { RSC: "1" } }], ["/capture", { headers: { "Next-Router-State-Tree": "1" } }],
    ] as const;
    for (const [url, init] of exclusions) expect(await fetchCase(url, init)).toBeUndefined();
    const crossOrigin = { method: "GET", mode: "navigate", headers: new Headers(), url: "https://other.example/capture" } as unknown as Request; const crossEvent: Event = { type: "fetch", request: crossOrigin, respondWith: vi.fn() }; listeners.get("fetch")!(crossEvent); expect(crossEvent.respondWith).not.toHaveBeenCalled();
    const offline = await fetchCase("/capture/period/room", { mode: "navigate" as RequestMode }); const offlineResponse = await offline!; expect(offlineResponse.status).toBe(200); expect(await offlineResponse.text()).toContain("shell:/offline.html");
    shell.set("/capture/period/other", new Response("cached capture")); captureFetches = 2; const fallback = await fetchCase("/capture/period/other", { mode: "navigate" as RequestMode }); const fallbackResponse = await fallback!; expect(fallbackResponse.status).toBe(200); expect(await fallbackResponse.text()).toContain("cached capture"); expect(cache.match).toHaveBeenCalled();
  });
});
