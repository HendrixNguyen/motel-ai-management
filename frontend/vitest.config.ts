import { configDefaults, defineConfig } from "vitest/config";

// Unit tests only: pure functions under `src/` (formatters, the VND digit guard).
//
// `include` is a single glob rooted at `src`, so a Playwright spec in `e2e/` can never be
// collected here even if someone names it like a unit test. `e2e/` is excluded as well, because
// `e2e/fixtures/api.ts` imports `@playwright/test`, which is not available in a Vitest worker.
//
// The environment stays Vitest's default `node`: the units under test are string and BigInt
// arithmetic. Adding `jsdom` or `happy-dom` would be a third dependency and a lie about what these
// tests need.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
