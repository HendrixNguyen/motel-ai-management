import type { NextConfig } from "next";

/**
 * Server-only. Never give this a `NEXT_PUBLIC_` prefix: the browser bundle must not learn
 * where the API lives, and every call it makes has to stay same-origin so the `httpOnly`
 * session cookie travels with it. See ADR-0008.
 *
 * The default keeps a fresh clone runnable with no setup: the backend listens on 3000.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * The browser only ever calls relative `/api/...`. This rewrites those onto the backend so
   * the request is same-origin — the `manager_session` / `renter_session` cookies are
   * `httpOnly`, host-only, `sameSite: "lax"`, which a cross-origin fetch could not send.
   *
   * Read at build time: `next.config.ts` is evaluated by `next build`, so `BACKEND_URL` has to
   * be in the build environment and not only at runtime.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
