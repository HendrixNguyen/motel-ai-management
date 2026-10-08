import { describe, expect, it } from "vitest";

describe("capture service worker behavior", () => {
  it("executes capture-sw decision logic", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../../../public/capture-sw.js", import.meta.url), "utf8"));
    const context = { location: { origin: "http://localhost" }, captureShouldHandle: undefined as unknown } as { location: { origin: string }; captureShouldHandle?: (request: Request, url: URL) => boolean };
    const script = new Function("self", source.replace(/self\.addEventListener\([\s\S]*/, "")); script(context);
    const decide = context.captureShouldHandle!;
    const navigation = (url: string, headers: Record<string, string> = {}) => ({ method: "GET", mode: "navigate", headers: new Headers(headers) }) as unknown as Request;
    expect(decide(navigation("http://localhost/capture/p/room"), new URL("http://localhost/capture/p/room"))).toBe(true);
    expect(decide(new Request("http://localhost/api/auth/me", { method: "GET" }), new URL("http://localhost/api/auth/me"))).toBe(false);
    expect(decide(new Request("http://localhost/capture", { method: "GET", headers: { RSC: "1" } }), new URL("http://localhost/capture"))).toBe(false);
  });
});
