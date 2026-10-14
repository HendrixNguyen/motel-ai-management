import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("root layout hydration", () => {
  test("suppresses the expected pre-hydration theme attribute mismatch", async () => {
    const source = await readFile(new URL("../layout.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/<html[\s\S]*suppressHydrationWarning/);
  });
});
