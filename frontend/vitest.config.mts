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
//
// `.mts`, not `.ts`: `frontend/package.json` has no `"type": "module"`, so Vite would load a `.ts`
// config as CommonJS and warn about the ESM syntax on every single run.
export default defineConfig({
  // `@/*` → `src/*` is the import convention this repo mandates (AGENTS.md, tsconfig `paths`), and
  // Vite does not read tsconfig `paths` unless asked: `resolve.tsconfigPaths` defaults to false in
  // Vite 8. Without this, every test written under the convention fails with
  // "Cannot find package '@/...'". Reading tsconfig is the built-in option, so this costs no
  // dependency; an explicit alias would work too but would duplicate a mapping that already exists.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
