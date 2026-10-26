import { spawnSync } from "node:child_process";
import { extname, resolve } from "node:path";

const base = process.argv[2];
if (!base)
  throw new Error("Usage: node scripts/check-changed-files.mjs <base-ref>");

const root = process.cwd();
const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], {
  cwd: root,
  encoding: "utf8",
});
if (diff.status !== 0) throw new Error(diff.stderr || "git diff failed");

const supported = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".yaml",
  ".yml",
  ".css",
  ".html",
]);
const files = diff.stdout
  .split("\n")
  .filter((file) => file && supported.has(extname(file)));
if (files.length === 0) {
  console.log("No changed files require formatting or lint checks.");
  process.exit(0);
}

function run(command, args, cwd) {
  if (args.length === 0) return;
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const name of ["frontend", "backend"]) {
  const packageFiles = files
    .filter((file) => file.startsWith(`${name}/`))
    .map((file) => file.slice(name.length + 1));
  if (packageFiles.length === 0) continue;
  const cwd = resolve(root, name);
  const formatFiles = packageFiles.filter((file) =>
    /\.[cm]?[jt]sx?$/.test(file),
  );
  const lintFiles = packageFiles.filter((file) => /\.[cm]?[jt]sx?$/.test(file));
  if (formatFiles.length > 0)
    run("bun", ["x", "prettier", "--check", ...formatFiles], cwd);
  if (lintFiles.length > 0) run("bun", ["x", "eslint", ...lintFiles], cwd);
}

const rootFiles = files.filter(
  (file) => !file.startsWith("frontend/") && !file.startsWith("backend/"),
);
if (rootFiles.length > 0) {
  run(
    "bun",
    [
      "x",
      "prettier",
      "--check",
      "--ignore-unknown",
      ...rootFiles.map((file) => resolve(root, file)),
    ],
    resolve(root, "frontend"),
  );
  for (const file of rootFiles.filter(
    (file) => file.startsWith("scripts/") && /\.[cm]?[jt]sx?$/.test(file),
  ))
    run("node", ["--check", resolve(root, file)], root);
}
