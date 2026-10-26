import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export function assertLockfileDiffStable(diff, packageName) {
  const rootLine = /^\s*"(name|version)":/;
  const changedLines = diff
    .split("\n")
    .filter(
      (line) =>
        (line.startsWith("+") && !line.startsWith("+++")) ||
        (line.startsWith("-") && !line.startsWith("---")),
    );
  const dependencyChanges = changedLines.filter(
    (line) => !rootLine.test(line.slice(1)),
  );
  assert.equal(
    dependencyChanges.length,
    0,
    `${packageName}/bun.lock contains dependency resolution changes`,
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
