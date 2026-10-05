# ADR-0008 — The browser reaches the backend through a same-origin rewrite proxy

- **Date:** 2026-10-05
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)
- **Contract:** [`docs/api-contract.md`](../api-contract.md)

## Context

The backend authenticates with cookies, not headers. `POST /api/auth/login` and
`POST /api/renter/magic-links/exchange` both answer with a `Set-Cookie`, and every other
manager or renter endpoint reads that cookie and nothing else. There is no bearer token a
client can hold and replay, and `manager_session` is `httpOnly`, so script on the page cannot
read it back out either.

That single fact decides the transport, because a cookie only arrives with a request when the
browser considers the request in-bounds. `backend/src/modules/auth/auth.route.ts:23-30` sets
`manager_session` as:

- `httpOnly` — invisible to `document.cookie`, so a client-side fetch cannot attach it itself
- `sameSite: "lax"` — sent on same-site requests, withheld from cross-site ones
- **no `domain` attribute** — host-only, so the browser scopes it to the exact host that set it
- `secure` in production
- `maxAge` 7 days

Three transports were considered.

| Option | Mechanism | Verdict |
|--------|-----------|---------|
| **Rewrite proxy** (chosen) | `next.config.ts` rewrites `/api/:path*` → `${BACKEND_URL}/api/:path*`. The browser's request never leaves the page's own origin; Next forwards it server-side. | Same-origin, so the cookie is in-bounds and no `Set-Cookie` rewriting is needed. |
| Cross-origin + CORS allowlist | Browser calls `http://api.<host>` directly. | Fails three ways — below. |
| BFF / Next route handlers | Hand-written `app/api/*` handlers that call the backend and copy headers onto the response. | Same cookie outcome as the proxy, but every `Set-Cookie`, status and header becomes code this project has to get right. The proxy already does it. |

The cross-origin option fails on the cookie first, and on CORS only after that has been
overridden:

1. **`manager_session` is host-only.** No `domain` attribute means the browser scopes it to the
   host that set it. Serve the app from `app.<domain>` and call `api.<domain>` and the cookie
   is simply not sent — the manager is logged out on every request. The fix is to add
   `domain=<domain>`, which widens a session credential to every subdomain of a domain this
   project does not control, to buy a convenience the proxy already provides for free.
2. **`sameSite: "lax"` survives that, but not a second site.** `app.<domain>` and
   `api.<domain>` are cross-origin yet same-site, so the cookie would travel. Host the app
   anywhere else — a CDN, a platform subdomain, a staging host — and it becomes cross-*site*,
   at which point `lax` withholds the cookie on every subresource request. Recovering means
   `SameSite=None; Secure`, which drops the CSRF protection the current attribute was chosen
   for.
3. **`origin: false` in production blocks the response even if the cookie arrives.** A
   cross-origin `fetch` needs `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`
   to read the body at all. `backend/src/app.ts:24` deliberately sends neither, so a manager
   login would appear to succeed and then fail on every subsequent call. Admitting the origin
   means adding and maintaining an allowlist — new configuration that has to be right for every
   environment the product is deployed to, and whose failure mode is a credential sent to an
   origin somebody got into.

Each of those is individually survivable and together they are not: the cheapest fix is the
option that removes all three questions at once.

## Decision

The browser calls **relative `/api/...` paths only**. `frontend/next.config.ts` rewrites them
onto the backend, so every browser request is same-origin and the session cookie travels with
it unmodified, in development and in production alike.

`BACKEND_URL` is a **server-only** variable — no `NEXT_PUBLIC_` prefix. It is read by
`next.config.ts` and by server-side `fetch` only. Two consequences follow from that and both
have to be respected:

1. **It must exist at build time.** `next.config.ts` is evaluated by `next build`, so a value
   missing from the build environment silently points the rewrite at `http://localhost:3000`
   rather than failing loudly. `frontend/.env.example` says so where someone will look.
2. **It must never be renamed `NEXT_PUBLIC_*`.** The `NEXT_PUBLIC_` prefix inlines a value into
   the client bundle, which would publish the backend's internal address to anyone who loads
   the page — and would invite the cross-origin calls that cannot carry the cookie anyway. The
   browser is never given a base URL to construct; it is given a path.

No origin allowlist is added, and `backend/src/app.ts` keeps `origin: false` in production.
CORS is not an authorisation control: it constrains what a browser will let a page *read*, and
it does nothing about a server-to-server caller. The tenant boundary stays where it belongs —
the session cookie plus `motel-scope`, with cross-tenant denial returning `404`.

## Consequences

**Good**

- One origin for the app, so `manager_session` and `renter_session` work with no per-environment
  cookie configuration and no `Domain` attribute to get wrong.
- A `POST /api/auth/login` from a client component stores the cookie directly. No server action,
  no `Set-Cookie` forwarding, no second indirection between the click and the session.
- The internal backend URL never reaches the browser.
- `origin: false` in production is not a blocker, because production requests are same-origin.

**Bad**

- **The proxy is a new blast radius.** `/api/*` on the frontend origin now forwards to the
  backend, so a mistake in the rewrite exposes backend endpoints at the public origin. The
  rewrite is deliberately scoped to `/api/:path*` and nothing else.
- **The frontend cannot be deployed without the backend's address at build time.** A build
  pipeline that omits `BACKEND_URL` produces a frontend that compiles and then silently proxies
  to localhost. Worth a build-time log line or an assertion later.
- **Server-side fetches bypass the rewrite.** An RSC calling `${BACKEND_URL}/api/...` directly
  does not go through Next, so it has to forward the `cookie` header itself or it will be
  unauthenticated. The failure is a `401` and a redirect to `/login`, not a wrong answer, so it
  is loud.
- **`RENTER_PORTAL_URL` on the backend is now named for what it is.** It builds the renter's
  magic-link URL, so it is the *frontend's* origin. It was previously undeclared and defaulted
  to the backend's own port, which happened to be right in development and wrong everywhere
  else.

**Revisit when** a second front end needs the same backend and is served from a different
origin — at that point the question is not CORS but whether one `sameSite: "lax"` cookie
should ever authenticate two origins.