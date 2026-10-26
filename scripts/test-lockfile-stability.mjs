import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const packages = ["frontend", "backend"];
for (const dir of packages) {
  const diff = execFileSync("git", ["diff", "--", `${dir}/bun.lock`], {
    encoding: "utf8",
  });
  const added = diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  const removed = diff
    .split("\n")
    .filter((line) => line.startsWith("-") && !line.startsWith("---"));
  const stripRootName = (line) =>
    line.replace(/"name": "(?:frontend|backend)"/g, '"name": "<package>"');
  assert.deepEqual(
    added.map(stripRootName),
    removed.map(stripRootName),
    `${dir}/bun.lock changes dependency resolution`,
  );
}
