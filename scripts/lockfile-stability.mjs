import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export function assertLockfileDiffStable(diff, packageName) {
  const changedLines = diff
    .split("\n")
    .filter(
      (line) =>
        (line.startsWith("+") && !line.startsWith("+++")) ||
        (line.startsWith("-") && !line.startsWith("---")),
    );
  assert.deepEqual(
    changedLines,
    [],
    `${packageName}/bun.lock must not change for package version-only bump`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const base = process.argv[2];
  if (!base)
    throw new Error("Usage: node scripts/lockfile-stability.mjs <base-sha>");
  for (const dir of ["frontend", "backend"]) {
    const diff = execFileSync(
      "git",
      ["diff", "--no-ext-diff", "--unified=0", base, "--", `${dir}/bun.lock`],
      { encoding: "utf8" },
    );
    assertLockfileDiffStable(diff, dir);
  }
}
