import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Two projects, two jobs.
//
// `chromium-mobile` is the suite that must always pass: it drives the UI at 375x667 with every
// `**/api/**` request answered by a fixture from `e2e/fixtures/api.ts`. No PostgreSQL, no Elysia
// backend, no seeded data — that is the whole point, since CI here has no database.
//
// `real-stack` runs the same flow against a live backend and PostgreSQL, so it is gated on
// `E2E_REAL=1` rather than silently skipped. Its specs live in `e2e/real/`, which
// `chromium-mobile` ignores: a real-stack spec talks to a real backend and must never be collected
// by the fixture-backed project.
//
// `testDir` is left at the frontend root and both projects name their own glob, so Playwright's
// default match cannot sweep `src` unit tests (Vitest's files) into this runner.
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
      testMatch: "e2e/**/*.spec.ts",
      testIgnore: "e2e/real/**",
    },
    {
      name: "real-stack",
      testMatch: "e2e/real/**",
      // Playwright 1.63 no longer reads a per-project `skip`, so the gate is an inverted grep that
      // matches no title. The project stays declared — never silently absent — and its tests run
      // only on a machine that has a backend and PostgreSQL.
      grepInvert: process.env.E2E_REAL === "1" ? undefined : /.*/,
    },
  ],
  webServer: {
    // The port lives in the `dev` script; `BASE_URL` above has to agree with it. Readiness is
    // checked on the port, not on a URL, because Playwright treats a 404 as "not up yet" and no
    // screen is guaranteed to exist — the harness must not depend on a route.
    command: "bun run dev",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
