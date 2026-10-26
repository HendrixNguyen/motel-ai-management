import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testPath = new URL("./bump-package-versions.mjs", import.meta.url);

async function loadBumpModule() {
  return import(testPath.href + `?t=${Date.now()}-${Math.random()}`);
}

test("increments stable versions by one patch", async () => {
  const { bumpPatch } = await loadBumpModule();
  assert.equal(bumpPatch("0.1.0"), "0.1.1");
  assert.equal(bumpPatch("1.0.50"), "1.0.51");
});

test("rejects malformed and prerelease versions", async () => {
  const { bumpPatch } = await loadBumpModule();
  assert.throws(() => bumpPatch("1.2"), /stable semver/i);
  assert.throws(() => bumpPatch("1.2.3-qa"), /stable semver/i);
  assert.throws(() => bumpPatch("1.2.3+build.7"), /stable semver/i);
});

test("CLI changes only version fields and preserves package metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "package-bump-"));
  const frontend = join(dir, "frontend.json");
  const backend = join(dir, "backend.json");
  const front = {
    name: "frontend",
    version: "0.1.0",
    private: true,
    dependencies: { next: "16.3.8" },
  };
  const back = {
    name: "backend",
    version: "1.0.50",
    type: "module",
    dependencies: { elysia: "latest" },
  };
  try {
    await writeFile(frontend, `${JSON.stringify(front, null, 2)}\n`);
    await writeFile(backend, `${JSON.stringify(back, null, 2)}\n`);
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(testPath), frontend, backend],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const frontNext = JSON.parse(await readFile(frontend, "utf8"));
    const backNext = JSON.parse(await readFile(backend, "utf8"));
    assert.deepEqual({ ...frontNext, version: front.version }, front);
    assert.deepEqual({ ...backNext, version: back.version }, back);
    assert.equal(frontNext.version, "0.1.1");
    assert.equal(backNext.version, "1.0.51");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
