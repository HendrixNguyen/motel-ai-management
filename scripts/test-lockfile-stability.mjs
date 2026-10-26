import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLockfileDiffStable } from "./lockfile-stability.mjs";

test("allows unchanged lockfile for package version-only bump", () => {
  assert.doesNotThrow(() => assertLockfileDiffStable("", "frontend"));
});

test("rejects unexpected lockfile changes", () => {
  const diff = ['-"next": ["next@16.3.8"', '+"next": ["next@16.3.9"'].join(
    "\n",
  );
  assert.throws(
    () => assertLockfileDiffStable(diff, "frontend"),
    /must not change/,
  );
});
