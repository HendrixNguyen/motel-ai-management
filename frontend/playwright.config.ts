import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const REAL_STACK = process.env.E2E_REAL === "1";
const FIXTURE_BACKEND_URL = "http://127.0.0.1:3002";

// Two projects, two jobs.
//
// `chromium-mobile` drives the UI at 375x667. Browser API fixtures use `e2e/fixtures/api.ts`;
// Server Component reads use the test-only loopback backend below. No PostgreSQL, no Elysia
// backend, no seeded data — CI here has no database.
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
      // The live-stack invocation uses the real backend; its Server Component reads cannot be
      // browser-intercepted, so fixture flows are run in the normal invocation instead.
      grepInvert: REAL_STACK ? /.*/ : undefined,
    },
    {
      name: "real-stack",
      testMatch: "e2e/real/**",
      // Playwright 1.63 no longer reads a per-project `skip`, so the gate is an inverted grep that
      // matches no title. The project stays declared — never silently absent — and its tests run
      // only on a machine that has a backend and PostgreSQL.
      grepInvert: REAL_STACK ? undefined : /.*/,
    },
  ],
  webServer: [
    ...(!REAL_STACK ? [{
      command: "bun e2e/fixtures/backend-server.ts",
      url: `${FIXTURE_BACKEND_URL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    }] : []),
    {
      // The port lives in the `dev` script; `BASE_URL` above has to agree with it. Readiness is
      // checked on the port, so the harness does not depend on a particular application route.
      command: "bun run build && node .next/standalone/server.js",
      url: `${BASE_URL}/login`,
      // A reused dev server may have a different BACKEND_URL and bypass our hermetic RSC fixture.
      reuseExistingServer: REAL_STACK && !process.env.CI,
      env: REAL_STACK ? undefined : { BACKEND_URL: FIXTURE_BACKEND_URL },
      timeout: 300_000,
    },
  ],
});
