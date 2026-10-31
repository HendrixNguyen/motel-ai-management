import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dockerfile = await readFile(
  fileURLToPath(new URL("../../Dockerfile", import.meta.url)),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"),
) as { version: string };

const buildStage = dockerfile.split("FROM deps AS build")[1]?.split("FROM deps AS runner")[0] ?? "";

function stampVersion(version: string, channel: string): string {
  const baseVersion = version.replace(/-qa$/, "");
  return channel === "qa" ? `${baseVersion}-qa` : baseVersion;
}

describe("frontend version stamp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads release version from frontend package.json", () => {
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i);
  });

  it("adds qa suffix and removes it for production", () => {
    expect(stampVersion("2.4.1", "qa")).toBe("2.4.1-qa");
    expect(stampVersion("2.4.1-qa", "qa")).toBe("2.4.1-qa");
    expect(stampVersion("2.4.1-qa", "production")).toBe("2.4.1");
  });

  it("builds from package version and selected channel rather than Git SHA", () => {
    expect(buildStage).toContain('node -p "require(\'./package.json\').version"');
    expect(buildStage).toContain('ARG APP_CHANNEL=production');
    expect(buildStage).toContain('NEXT_PUBLIC_BUILD_VERSION="$BUILD_VERSION"');
    expect(buildStage).not.toContain("BUILD_SHA=");
    expect(buildStage).not.toContain("git -C /app rev-parse HEAD");
  });
});
