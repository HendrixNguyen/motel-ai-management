import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dockerfile = await readFile(
  fileURLToPath(new URL("../../Dockerfile", import.meta.url)),
  "utf8",
);

const buildStage = dockerfile.split("FROM deps AS build")[1]?.split("FROM deps AS runner")[0] ?? "";

describe("frontend Docker build metadata", () => {
  it("installs git in the build stage before reading commit metadata", () => {
    expect(buildStage).toMatch(/apk add --no-cache git[\s\S]*?git -C \/app rev-parse HEAD/);
  });

  it("fails the build rather than embedding unknown SHA or timestamp", () => {
    expect(buildStage).toContain('git -C /app rev-parse HEAD');
    expect(buildStage).toContain('git -C /app show -s --format=%cI HEAD');
    expect(buildStage).not.toContain('echo unknown');
    expect(buildStage).toContain('NEXT_PUBLIC_BUILD_SHA="$BUILD_SHA" BUILD_TIMESTAMP="$BUILD_TIMESTAMP" bun run build');
  });
});
