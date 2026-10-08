import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("capture service worker cache boundaries", () => {
  const source = readFileSync(resolve(process.cwd(), "public/capture-sw.js"), "utf8");
  it("caches explicit shell only and bypasses API/RSC/Next assets", () => {
    expect(source).toContain("const SHELL = new Set");
    expect(source).toContain("url.pathname.startsWith(\"/api/\")");
    expect(source).toContain("url.pathname.startsWith(\"/_next/\")");
    expect(source).toContain("url.searchParams.has(\"_rsc\")");
    expect(source).toContain("request.headers.has(\"RSC\")");
    expect(source).toContain("if (!SHELL.has(url.pathname)) return");
  });
});
