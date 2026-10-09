import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("Core UI v2 migration contracts", () => {
  test("empty state action is optional", async () => {
    const source = await import("../empty-state");
    expect(source.default).toBeTypeOf("function");
  });

  test("dark theme defines semantic surface tokens", async () => {
    const css = await readFile(new URL("../../../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/html\[data-theme="dark"\]\s*\{[\s\S]*--color-surface:\s*#111827;[\s\S]*--color-canvas:\s*#0F172A;/);
  });
});
