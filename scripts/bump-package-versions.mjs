import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function bumpPatch(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match)
    throw new Error(`Expected stable semver x.y.z, received: ${version}`);
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

async function bumpPackage(path) {
  const source = await readFile(path, "utf8");
  const pkg = JSON.parse(source);
  pkg.version = bumpPatch(pkg.version);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const paths = process.argv.slice(2);
  for (const path of paths.length
    ? paths
    : ["frontend/package.json", "backend/package.json"])
    await bumpPackage(path);
}
