import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLockfileDiffStable } from "./lockfile-stability.mjs";

test("allows package name/version metadata changes with unchanged dependency resolutions", () => {
  const diff = [
    ' "name": "frontend"',
    '+ "name": "frontend"',
    '- "version": "0.1.0"',
    '+ "version": "0.1.1"',
  ].join("\n");
  assert.doesNotThrow(() => assertLockfileDiffStable(diff, "frontend"));
});

test("rejects dependency resolution drift in Bun lockfile", () => {
  const diff = ['-"next": ["next@16.3.8"', '+"next": ["next@16.3.9"'].join(
    "\n",
  );
  assert.throws(
    () => assertLockfileDiffStable(diff, "frontend"),
    /dependency resolution changes/,
  );
});
