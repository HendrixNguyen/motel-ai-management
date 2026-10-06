import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError, GENERIC_ERROR_MESSAGE, assertRelativePath, decodeResponse } from "./client";

/**
 * The Server-Component transport. Three differences from `client.ts`, and each is load-bearing:
 *
 * 1. **An absolute URL.** The browser resolves `/api/...` against its own origin; `fetch` on the
 *    server has no origin, so a relative path resolves in development (where a polyfill or a
 *    dev-server quirk can cover for it) and throws in production. Hence `${BACKEND_URL}${path}`.
 * 2. **The `cookie` header, forwarded.** `manager_session` is `httpOnly`, so no Server Component can
 *    read it as a value — only `cookies()` can, and only by putting it on the outgoing request. That
 *    is the entire reason a Server Component may call the backend at all.
 * 3. **`cache: "no-store"`.** The answer is one manager's data, behind one manager's session. A
 *    cached response is that data served to somebody else, so there is no cache policy to configure:
 *    this one call opts out of every layer of it.
 *
 * `import "server-only"` is what makes the mistake impossible rather than merely discouraged. Next
 * resolves the marker itself — installing the package is optional and its contents are not used
 * (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`) — and
 * a Client Component that reaches this module, directly or through `motels.ts` and friends, fails
 * the build with a message naming `server-only` instead of failing at runtime with
 * `cookies() can only be called in a Server Component`.
 *
 * It is also why the domain modules are split in two. D3 puts reads in Server Components and
 * mutations in client components, and a single `motels.ts` holding both would drag this module into
 * every client bundle — so the reads live in `motels.ts` and the writes in `motels.client.ts`.
 */
export async function serverGet<T>(path: string): Promise<T> {
  assertRelativePath(path);
  const res = await request(path);

  // Redirect rather than throw. Every screen in the plan sits behind this call, and "your session
  // ended" is the one answer a manager cannot act on — so it has one answer, from one place, instead
  // of each screen inventing an inline 401. `redirect` throws, so the `ApiError` below is never
  // reached, and the status is checked before the body so a 401 cannot be rendered as data.
  if (res.status === 401) redirect("/login");

  return decodeResponse<T>(res);
}

/**
 * The backend's address, read per call.
 *
 * `next.config.ts` reads the same variable, and the two must agree: the proxy sends the browser's
 * requests to one host and this sends the Server Component's to another, so a mismatch would read
 * data through one address and mutate it through the other. The default is deliberately the same
 * literal as `next.config.ts:10` so a fresh clone works with no `.env.local` at all.
 */
function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:3000";
}

/**
 * `GET` only. D3 keeps mutations in client components, so nothing on this path sends a body — and
 * the API is a set of reads plus the four auth calls, none of which is a Server Component's to make:
 * `login`, `register` and `logout` have to be browser calls so the backend's `Set-Cookie` reaches the
 * browser itself, and `me` is a read.
 */
async function request(path: string): Promise<Response> {
  const cookie = (await cookies()).toString();

  try {
    return await fetch(`${backendUrl()}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        // Nothing, not `cookie: ""`, when the request carries no cookie: the visitor is anonymous
        // and saying otherwise would be a lie about them.
        ...(cookie === "" ? {} : { cookie }),
      },
    });
  } catch {
    // The backend is down, or `BACKEND_URL` names a host that does not resolve. `fetch`'s `TypeError`
    // and its `cause` can carry that host, and a Server Component error boundary renders whatever
    // message it is given.
    throw new ApiError(0, "INTERNAL_ERROR", GENERIC_ERROR_MESSAGE);
  }
}
