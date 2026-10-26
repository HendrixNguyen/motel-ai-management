import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const prWorkflow = await readFile(
  `${root}/.github/workflows/pr-checks.yml`,
  "utf8",
);
const changedFileChecker = await readFile(
  `${root}/scripts/check-changed-files.mjs`,
  "utf8",
);
const versionWorkflow = await readFile(
  `${root}/.github/workflows/version-bump.yml`,
  "utf8",
);
const bumpScript = await readFile(
  `${root}/scripts/bump-package-versions.mjs`,
  "utf8",
);
const lockfileCheck = await readFile(
  `${root}/scripts/test-lockfile-stability.mjs`,
  "utf8",
);

assert.match(prWorkflow, /pull_request:/);
assert.match(prWorkflow, /branches:\s*\n\s+- qa\s*\n\s+- main/);
assert.match(prWorkflow, /contents:\s*read/);
assert.match(prWorkflow, /pull-requests:\s*read/);
assert.doesNotMatch(
  prWorkflow,
  /contents:\s*write|pull-requests:\s*write|secrets\.GITHUB_TOKEN/,
);
assert.match(prWorkflow, /setup-bun/);
assert.match(prWorkflow, /working-directory: frontend/);
assert.match(prWorkflow, /working-directory: backend/);
assert.match(prWorkflow, /bun install --frozen-lockfile/);
assert.match(prWorkflow, /check-changed-files\.mjs/);
assert.match(changedFileChecker, /"diff", "--name-only"/);
assert.match(changedFileChecker, /prettier/);
assert.match(changedFileChecker, /eslint/);
assert.doesNotMatch(changedFileChecker, /bun run (?:format|lint)(?!:check)/);
assert.match(versionWorkflow, /pull_request:/);
assert.match(versionWorkflow, /types:\s*\n\s+- closed/);
assert.match(versionWorkflow, /pull_request\.merged == true/);
assert.match(versionWorkflow, /pull_request\.base\.ref == 'qa'/);
assert.match(versionWorkflow, /pull_request\.base\.ref == 'main'/);
assert.match(versionWorkflow, /pull_request\.merge_commit_sha/);
assert.doesNotMatch(versionWorkflow, /\n  push:/);
assert.match(versionWorkflow, /contents:\s*write/);
assert.match(versionWorkflow, /\[skip ci\]/);
assert.match(versionWorkflow, /bump-package-versions\.mjs/);
assert.match(versionWorkflow, /test-lockfile-stability\.mjs/);
assert.match(versionWorkflow, /git rev-parse HEAD/);
assert.match(versionWorkflow, /oven-sh\/setup-bun/);
assert.match(bumpScript, /export function bumpPatch/);
assert.match(lockfileCheck, /"diff"/);
