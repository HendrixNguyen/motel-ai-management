import { expect, test } from "vitest";

// Proves the runner is installed and that it collects unit tests under `src/` in Vitest's default
// `node` environment — no DOM, no database, no backend. Task 3 replaces this with real formatter
// tests; this file exists so the harness is proven before anything is built on top of it.
test("vitest runs a test under src/ in the node environment", () => {
  expect(typeof window).toBe("undefined");
  expect(process.env.NODE_ENV).toBe("test");
});
