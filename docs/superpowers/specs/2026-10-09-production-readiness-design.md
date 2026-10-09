# Production Readiness and Payment Readiness — Architectural Spec

- **Date:** 2026-10-09
- **Status:** Draft for implementation planning
- **Scope:** Production hardening and renter payment readiness only. No product code changes in this document.
- **Related:** [`docs/api-contract.md`](../../api-contract.md), [`docs/testing-strategy.md`](../../testing-strategy.md), [`docs/full-flow-test-plan.md`](../../full-flow-test-plan.md), [`docs/superpowers/specs/2026-10-08-renter-capture-zalo-design.md`](2026-10-08-renter-capture-zalo-design.md), [ADR-0001](../../adr/0001-renter-magic-link-auth.md), [ADR-0002](../../adr/0002-manual-payment-confirmation.md), [ADR-0003](../../adr/0003-zalo-oa-vs-zns-routing.md), [ADR-0008](../../adr/0008-frontend-transport-same-origin-proxy.md).

## 1. Approved decisions

1. Initial production runs **one backend replica**. Horizontal scaling is not a launch requirement.
2. Production schema changes run in a separate, one-shot migration job. Backend replicas never migrate on startup in production.
3. Renter notifications use **Web Push as primary after renter activation**. A renter may use the portal without granting push permission.
4. Activation and fallback use configured **ZNS/ZBS** or manager-generated manual link/QR fallback. Zalo OA is used only when verified follower state allows it. **SMS is not MVP** and requires an explicit scope change.
5. Payment remains VietQR plus manager confirmation. Renter submits one private proof image; manager approves/rejects it or confirms cash payment. No gateway and no automatic bank reconciliation.
6. Secrets, object keys, OTPs, tokens, provider payload credentials, and database URLs never enter client responses or logs.

## 2. Current system names and boundaries

- Backend entrypoint: `backend/src/index.ts`; application composition: `backend/src/app.ts`.
- Database: PostgreSQL through Drizzle; migration runner: `backend/src/db/migrate.ts` and `bun run db:migrate`.
- Manager auth: `manager_session` httpOnly cookie, JWT secret `MANAGER_JWT_SECRET`.
- Renter auth: single-use magic link exchanged for 24-hour `renter_session`; secret `RENTER_SESSION_SECRET`.
- Browser transport: relative `/api/...` through the Next.js same-origin rewrite; `BACKEND_URL` remains server-only.
- Storage: private Cloudflare R2 through storage adapter; signed reads are short-lived and authorization-gated.
- Payment proof: `payment_proofs`, status `pending | approved | rejected`, partial unique current-proof index per invoice.
- Payment routes: `/api/renter/invoices/:invoiceId/payment-proof`, manager approve/reject, and `cash-confirmation` routes documented in `docs/api-contract.md`.
- Notifications: `notification_events` outbox, `eventKey` uniqueness, bounded retry, lease fields, `notification.service.ts`, `scheduler.service.ts`, and `notification.webhook.ts`.
- Webhook: `POST /api/webhooks/zalo`, HMAC-SHA256 over raw body using `ZALO_WEBHOOK_SECRET`, idempotent event storage.

## 3. Production topology

### Launch topology

```text
Internet
  -> HTTPS reverse proxy / same-origin Next.js frontend
  -> one backend container
  -> private PostgreSQL network
  -> private R2 bucket
  -> Web Push and configured ZNS/ZBS providers
```

PostgreSQL has no public port mapping. R2 remains private; `R2_PUBLIC_URL` is not used as a capability. Only the reverse proxy exposes HTTP(S). TLS terminates at the edge or trusted reverse proxy and redirects HTTP to HTTPS.

The first production release uses one backend replica because the current process owns an in-process timer and the database advisory lease protects duplicate scheduler work. The lease is defense-in-depth, not permission to run unsafe multi-replica migrations. Any future multi-replica design requires a separate scale-out spec covering worker ownership, readiness, connection limits, and deployment ordering.

### Process roles

- **Migration job:** one-shot process, same image and production environment as backend, runs `bun run db:migrate`, exits non-zero on failure.
- **Backend:** starts only after migration job succeeds; serves API and `/health`/`/ready`.
- **Frontend:** built with server-only `BACKEND_URL`; browser calls same-origin `/api`.
- **Scheduler:** current expiry scheduler remains enabled for one replica, with advisory lease and observable outcomes. Notification delivery retries must be durable in `notification_events`, not timer memory.

## 4. Security defaults and authentication hardening

### Secrets and configuration

- Production refuses startup when required secrets are absent, short, placeholder, development, or shared with another environment.
- Use distinct high-entropy `MANAGER_JWT_SECRET` and `RENTER_SESSION_SECRET`; rotate through an overlap plan, never by silently invalidating all active users without an operator action.
- Keep `ZALO_OA_ID`, `ZALO_OA_SECRET`, `ZALO_ACCESS_TOKEN`, `ZALO_WEBHOOK_SECRET`, `ZNS_TEMPLATE_*`, R2 credentials, database URLs, and Web Push VAPID private key server-side.
- Do not use compose fallback credentials in production. PostgreSQL credentials differ between local compose and `.env.example`; production values must be explicit and tested before rollout.

### Cookies, JWT, and invalidation

- `manager_session` and `renter_session`: `httpOnly`, `secure`, `sameSite=lax`, host-only, explicit 24-hour renter lifetime; manager lifetime follows the approved production policy but must be finite.
- Logout clears the cookie and invalidates the server-side session subject or token version. Password change, manager disablement, secret rotation, and suspected compromise revoke all sessions for that identity.
- Renter magic-link tokens remain random, single-use, hash-at-rest, and expire after 24 hours. Exchange consumes token and redirects to token-free portal path. URL tokens never appear in logs, analytics, referrers, or error bodies.
- JWT verification must reject malformed, expired, wrong-secret, and wrong-purpose tokens. Do not accept client-supplied manager/renter IDs as scope.
- Cross-tenant and foreign-resource responses remain `404`, never `403`, except valid-role authorization failures where existence is not disclosed.

### Timing-safe and enumeration-safe auth

- Login performs password verification against a fixed dummy Argon2id hash when email is unknown, so unknown-email and wrong-password paths have comparable work.
- Webhook signature comparison uses constant-time byte comparison after validating expected encoding and length.
- Magic-link and OTP comparisons use hashes and constant-time comparison; raw values never persist.
- Login, register, magic-link issue/exchange, OTP request/verify, push subscription mutation, payment-proof upload, and webhook endpoints have route-specific limits.
- Rate-limit keys combine IP and normalized account/recipient where available. Return `429 RATE_LIMITED` with bounded `retryAfterSeconds`; do not reveal whether an email, phone, renter, invoice, or provider identity exists.

### Minimum launch limits

| Operation | Limit | Key |
|---|---:|---|
| Manager login | 5 failures / 15 min, exponential backoff | IP + normalized email |
| Manager register | 3 / hour | IP |
| Magic-link issue/exchange | 5 / hour; 1 active issue cooldown | manager/renter + IP |
| OTP request | 1 / 5 min; 5 / hour | contract + renter + IP |
| OTP verify | 3 attempts / challenge | challenge + renter |
| Payment-proof upload | 5 / hour; 10 MB body ceiling | renter + invoice + IP |
| Push subscribe/revoke | 20 / hour | renter + IP |
| Webhook | provider-appropriate burst limit | IP/provider signature |

Limits are enforced before expensive storage/provider work and emit metrics without credential values.

## 5. Payment-proof runtime architecture

### Renter PWA flow

1. Renter exchanges magic link and receives `renter_session`.
2. Portal reads invoice, itemized amounts, VietQR payload, payment status, and current proof state.
3. Renter uploads exactly one JPEG or PNG through `POST /api/renter/invoices/:invoiceId/payment-proof`.
4. Backend authenticates renter, verifies invoice ownership and payable state, validates multipart count, declared MIME, magic bytes, decoded size, and 10 MB maximum before committing metadata.
5. Backend writes private object and `payment_proofs` metadata in a transactionally safe sequence. Orphan cleanup is required if metadata commit fails.
6. Response returns proof metadata only; never object key or reusable URL. Renter can request a 300-second signed read only when authorized.
7. PWA shows pending state, preserves safe retry state, and never treats upload success as payment success.

A pending or approved proof blocks replacement. A rejected proof remains immutable history and permits one replacement current proof. Database constraints remain authoritative: one non-rejected proof per invoice, JPEG/PNG content type, 1–10 MB size, and review-state consistency.

### Manager review and cash

- Manager lists pending proofs within owned motel scope and opens a short-lived signed image URL.
- Approve runs one transaction: validate proof and invoice state, set proof `approved`, set invoice `paymentStatus=paid`, `paymentMethod=bank_transfer`, `paidAt`, reviewer identity, and audit event.
- Reject runs one transaction: set proof `rejected`, reviewer identity, timestamp, and bounded non-empty reason; invoice remains `unpaid` or `overdue`.
- Cash confirmation runs one transaction with no renter-controlled payment fields: set invoice paid, `paymentMethod=cash`, `paidAt`, audit event. It does not approve a proof implicitly.
- Repeated same valid action is idempotent. Conflicting payment races return `409 CONFLICT`. No operation moves paid invoice back to unpaid/overdue.
- Payment events enqueue after domain commit using stable keys: `invoice:<id>:proof-submitted`, `invoice:<id>:proof-approved`, `invoice:<id>:proof-rejected`, and `invoice:<id>:cash-confirmed`.

## 6. Webhook and notification delivery

`POST /api/webhooks/zalo` is unauthenticated only because provider callbacks cannot hold app sessions. It must:

1. Read raw body before JSON parsing.
2. Verify `x-zalo-signature` with HMAC-SHA256 and constant-time comparison.
3. Reject invalid signatures with `401 UNAUTHORIZED` and malformed events with `400 VALIDATION_ERROR`.
4. Deduplicate `event_id`; when absent, use a raw-body digest.
5. Map `follow` only after verified `oa_id` and phone match a configured motel mapping. Unknown mapping is an internal retryable failure, not a tenant `404`.
6. Process `unfollow` idempotently and clear follower state.
7. Return no provider IDs, payloads, secrets, or mapping details.

After renter activation, Web Push is first channel. Permission denial, missing subscription, expired endpoint, or permanent push failure must not block portal or payment state. Permanent push failure deactivates subscription and queues configured ZNS/ZBS fallback. ZNS/ZBS activation/fallback must be explicitly configured and smoke-tested; if unavailable, manager manual link/QR fallback remains the recovery path. SMS is excluded.

Outbox requirements:

- Domain mutation and `notification_events` insert commit atomically when notification enqueue is required.
- Delivery runs post-commit; provider failure never rolls back invoice/proof state.
- Stable `eventKey` is unique. Attempts are bounded (current ceiling three), leased, and redacted.
- Persist channel, status, attempt count, next retry, failure class/reason, provider ID, timestamps, and correlation ID. Do not persist OTP, token, password, signed URL, or full provider payload.
- Expose operator metrics and an admin-safe failure view; no browser-callable provider-send endpoint.

## 7. Upload hardening

All uploads pass through backend and private storage adapter. Enforce:

- request body and multipart part limits before buffering;
- declared MIME plus magic-byte validation; decode/re-encode or virus scanning when provider/runtime permits;
- resource-specific count and size rules: payment proof exactly one JPEG/PNG up to 10 MB; meter photo one JPEG/PNG up to 10 MB; ticket up to five JPEG/PNG up to 10 MB; contract proof 1–3 PDF/JPEG/PNG up to 10 MB each;
- opaque server-generated keys scoped by motel and resource; no user-controlled path traversal or extension trust;
- checksum and content type metadata; no public bucket/object ACL;
- authorization before signed URL issuance, 300-second default TTL, and no signed URL in service worker caches;
- orphan cleanup, storage timeout, bounded retries, and `502 EXTERNAL_SERVICE_ERROR` without provider details;
- logs containing IDs and sizes only, never file bytes, keys, URLs, or credentials.

## 8. Health, readiness, and observability

Keep `GET /health` shallow and unauthenticated: process is alive, response `200 {"status":"ok"}`. Add `GET /ready` for traffic admission:

- returns `200` only when configuration validation passed, PostgreSQL can execute a bounded readiness query, required migrations are at expected version, and required provider/storage configuration is present for enabled features;
- returns `503` with stable safe status fields when not ready; never returns connection strings or provider errors;
- reverse proxy routes traffic only to ready backend;
- startup logs emit release SHA, environment name, migration version, and dependency status without secrets.

Structured logs require request ID, route, status, latency, actor role, motel scope hash or safe ID, and error code. Redact authorization, cookies, OTP, magic links, JWTs, passwords, signed URLs, object keys, provider payloads, and database URLs. Metrics cover auth failures/rate limits, upload acceptance/rejection, proof state transitions, payment transitions, notification queue age/retry/failure, scheduler lease acquisition, DB pool saturation, readiness failures, and backup results.

Scheduler observability must record each expiry run: scheduled time, start/end, lease acquired, count, failure class, and next run. Alert when no successful run occurs within one expected interval plus grace, queue age exceeds threshold, or pending events exceed threshold. Advisory lease loss is normal coordination, not an error.

## 9. Backups and restore

- PostgreSQL backups run at least daily, encrypted at rest, retained according to the production retention policy, and stored separately from the database host.
- Backup success is not assumed from scheduler logs: verify object existence, size, timestamp, and checksum/manifest.
- R2 uploads use provider versioning or equivalent retention where available; backup metadata must include bucket/object scope without exposing credentials.
- Define RPO and RTO before production enablement; launch gate requires a documented restore drill to a disposable PostgreSQL and a disposable/private object store.
- Restore validation must run migrations/status checks, application readiness, invoice/payment-proof reads, signed URL authorization, and notification outbox consistency. Never restore production over live data as a test.
- Keep database and object-storage retention aligned so payment proofs and referenced records do not silently disappear first.

## 10. Rollout gates

### Gate 1 — security and operations

- Production secrets and HTTPS configured; no placeholder values.
- PostgreSQL private, no public port; least-privilege DB user; connection limits sized for one replica.
- Migration job succeeds from clean and representative production-like data; backend starts with migration disabled.
- `/health` and `/ready` pass; reverse proxy admits only ready instances.
- Auth rate limits, timing-safe checks, cookie flags, logout/session invalidation, redaction, and 404 tenant isolation tested.
- Private R2 upload, signed URL expiry, orphan cleanup, and negative public-URL test pass.
- Backup completes and restore drill evidence recorded.

### Gate 2 — payment runtime

- Renter sees invoice arithmetic, VietQR, and payment state through `renter_session` only.
- Exactly-one proof upload, byte/MIME/size/count validation, private metadata, signed read, rejection replacement, and duplicate prevention pass.
- Manager approve/reject and cash confirmation are tenant-scoped, auditable, idempotent, and race-safe.
- Paid invoice cannot be mutated by renter; payment status never depends on notification success.
- Stable payment event keys and outbox insertion are atomic with domain mutations.

### Gate 3 — notification and release readiness

- Web Push subscription ownership/deduplication and permanent-failure handling pass.
- Activation/fallback smoke passes with configured ZNS/ZBS; manual link/QR fallback works when providers are disabled.
- Webhook signature, replay, mapping, follow/unfollow, and redaction tests pass.
- Scheduler lease/retry/queue-age metrics and alerts verified.
- Fixture-backed E2E passes at 360, 375, 430, and 1280 widths; real QA smoke uses `E2E_REAL=1` only against QA.
- Deploy exact reviewed image SHA, run migrations first, then backend, then frontend; verify rollback/redeploy procedure.

## 11. Exact non-goals

- No VNPay, MoMo, ZaloPay, card, wallet, or payment gateway integration.
- No bank transaction webhook, automatic reconciliation, OCR, or automatic proof approval.
- No SMS in MVP, including SMS OTP or SMS fallback, unless a new approved scope explicitly adds it.
- No native mobile app; renter and capture surfaces remain web/PWA.
- No multi-replica production rollout in this spec; no distributed worker redesign.
- No public uploads, permanent download URLs, client-supplied object keys, or client-side payment mutation.
- No in-app chat, certified digital signature provider, multi-currency, or multilingual UI.
- No broad refactor of domain modules unrelated to launch gates.

## 12. Verification contract

Implementation must update owning docs and tests when behavior changes. At minimum, run backend typecheck, targeted auth/payment/upload/notification tests sequentially against disposable PostgreSQL, frontend typecheck/lint/build/test, fixture E2E, and QA deployment smoke. Run `/review-security` and `/review-code` before release. Record blocked provider, browser, or infrastructure checks explicitly; a skipped check is not a passed gate.
