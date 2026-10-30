import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("backend Dockerfile has a dedicated one-shot migration target", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const migrationStage = dockerfile.split("FROM deps AS migration-job")[1]?.split("\nFROM ")[0];
  expect(migrationStage).toBeDefined();
  expect(migrationStage).toContain('CMD ["bun", "run", "db:migrate"]');
  expect(dockerfile).toContain('CMD ["bun", "run", "start:server"]');
});
