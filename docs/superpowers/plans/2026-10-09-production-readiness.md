# Production Readiness and Payment Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the motel system for single-replica production and ship renter payment-proof workflows with private uploads, manager-only payment transitions, durable notifications, restore evidence, and release gates defined by the authoritative production-readiness spec.

**Architecture:** Keep the modular Elysia/Drizzle monolith and current Next same-origin transport. Add production readiness as explicit configuration, health/readiness, migration, storage, rate-limit, redaction, and observability seams; keep payment transitions in billing services and payment-proof orchestration in the payment module. Launch one backend replica after a one-shot migration job; preserve manual renter link/QR fallback when providers are disabled.

**Tech Stack:** Bun, ElysiaJS, Drizzle, PostgreSQL, Next.js 16.3.8, Vitest, Playwright, private R2 storage adapter, Web Push plus configured ZNS/ZBS adapters.

**Spec:** `docs/superpowers/specs/2026-10-09-production-readiness-design.md`

## Global Constraints

- Initial production uses one backend replica; no multi-replica redesign.
- Production migrations run in a separate one-shot job; backend production startup does not migrate.
- Browser calls relative `/api/*`; `BACKEND_URL` stays server-only.
- `manager_session` and `renter_session` are host-only, `httpOnly`, `secure`, `sameSite=lax`; renter lifetime is 24 hours.
- Tenant scope comes from sessions; foreign resources return `404`, never `403`.
- Magic links are random, single-use, hash-at-rest, and expire after 24 hours; raw tokens never appear in URLs after exchange, logs, analytics, referrers, or errors.
- Payment is VietQR plus manager confirmation; one private JPEG/PNG proof, maximum 10 MB; no gateway, reconciliation, OCR, automatic approval, or SMS.
- Payment proof keys, signed URLs, secrets, credentials, OTPs, JWTs, and provider payloads never enter client responses or logs.
- Web Push is primary after activation; configured ZNS/ZBS is fallback; manual link/QR remains available.
- Existing modular boundaries remain: cross-module calls use exported services, not foreign tables.
- Bun only; backend integration test files run sequentially against disposable PostgreSQL.

## Review Focus

- Unknown-email login must perform dummy Argon2id work and return the same safe failure shape as wrong password; test in `backend/src/test/manager-auth.test.ts`.
- Foreign manager/renter resources must return `404` with no body leakage; test in `backend/src/test/tenancy.test.ts` and payment isolation tests.
- Multipart uploads with mismatched MIME/magic bytes, multiple files, oversized declared/decoded content, and storage failure must leave no committed metadata; test in `backend/src/test/upload.test.ts` and payment upload tests.
- Concurrent approve/reject/cash actions must never reverse paid state or create duplicate payment events; test in `backend/src/test/payment-race.test.ts`.
- Readiness, backups, and provider failures must fail closed without exposing connection strings, object keys, signed URLs, or provider payloads; test in readiness/observability/restore checks and record provider blockers explicitly.

---

## Dependency Order

1. Task 1 establishes production config, error/redaction/rate-limit seams, and documentation vocabulary.
2. Task 2 adds migration-job and readiness behavior.
3. Task 3 hardens storage/upload primitives.
4. Task 4 completes payment-proof schema/service/routes and manager transitions.
5. Task 5 makes notification delivery durable, push-first, fallback-safe, and webhook-safe.
6. Task 6 completes renter API and frontend payment surfaces.
7. Task 7 adds manager review UI and fixture-backed full flow.
8. Task 8 adds observability, backup/restore evidence, rollout/runbook docs, and release checks.
9. Task 9 runs security/code reviews and the final verification contract before release.

## Task 1: Production configuration, session hardening, rate limits, and redaction

**Files:**
- Modify `backend/src/env.ts`, `backend/src/config.ts`, `backend/src/shared/errors.ts`
- Modify `backend/src/modules/auth/auth.route.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/magic-link.route.ts`
- Modify `backend/src/app.ts`
- Create `backend/src/shared/rate-limit.ts`, `backend/src/shared/redaction.ts`
- Modify `backend/.env.example`, `docs/api-contract.md`, `docs/testing-strategy.md`
- Test `backend/src/test/manager-auth.test.ts`, `backend/src/test/renter-auth.test.ts`, `backend/src/test/rate-limit.test.ts`, `backend/src/test/redaction.test.ts`

**Interfaces:**
- `validateProductionConfig(env: NodeJS.ProcessEnv): ProductionConfig` rejects missing, short, placeholder, development, or duplicate environment secrets.
- `rateLimit(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision>` returns `{ allowed, retryAfterSeconds }` without account-existence disclosure.
- `redactLogContext(input: unknown): unknown` removes authorization, cookies, OTPs, tokens, passwords, signed URLs, object keys, provider payloads, and database URLs.
- Session helpers set/clear `manager_session` and `renter_session` with fixed cookie flags and invalidate server-side subject/token version on logout/revocation.

- [ ] Write failing tests for production secret rejection, cookie flags/lifetimes, logout invalidation, unknown-email dummy-hash path, route-specific 429 responses, constant-time token/signature comparisons, and redacted error/log context.
- [ ] Implement smallest shared policy seams; use existing auth/session code and `ErrorCode.RATE_LIMITED` with bounded `retryAfterSeconds`.
- [ ] Verify targeted tests sequentially with `cd backend && bun test <explicit-file>`.
- [ ] Update API/config ownership docs and `.env.example`; do not add SMS settings.
- [ ] Commit `feat: harden production auth and request limits`.

## Task 2: Migration job, health/readiness, and startup ordering

**Files:**
- Modify `backend/src/index.ts`, `backend/src/app.ts`, `backend/src/db/migrate.ts`, `backend/src/config.ts`
- Create `backend/src/health/readiness.service.ts`, `backend/src/health/readiness.route.ts`
- Modify `backend/package.json`, `docker-compose.yml`, `backend/Dockerfile` or deployment manifest if present
- Create `docs/operations/production-startup.md`
- Test `backend/src/test/health-readiness.test.ts`, `backend/src/test/migration-startup.test.ts`

**Interfaces:**
- `GET /health` returns exactly `200 {"status":"ok"}` without DB/provider work.
- `GET /ready` returns `200` only after config validation, bounded PostgreSQL query, expected migration version, and enabled-feature provider/storage checks; otherwise `503` with stable safe fields only.
- `runMigrations(): Promise<void>` is the one-shot job entrypoint and exits non-zero on failure; production backend startup never calls it.

- [ ] Add tests for shallow health, readiness 503 causes, safe 503 body, expected migration version, and backend startup with migration disabled.
- [ ] Implement migration command/container contract using same image/config; ensure reverse proxy admission is documented as readiness-gated.
- [ ] Verify `cd backend && bun run typecheck` and targeted health/migration tests.
- [ ] Document local compose exception versus production one-shot ordering.
- [ ] Commit `feat: add production readiness and migration job`.

**Verification evidence (2026-10-09):** Production readiness Task 2 implementation was continued in `production-payment`. Billing capture CAS fix uses PostgreSQL epoch-microseconds string tokens and a single atomic conditional UPDATE; missing reading lookup precedes CAS, so missing reports `NOT_FOUND` and transaction rolls earlier writes back while existing stale reading remains `READING_CONFLICT`. Added tests in `backend/src/test/billing-reading.test.ts`; API contract token format updated in `docs/api-contract.md`. `cd backend && bun run typecheck` and `bun test src/test/billing-reading.test.ts` passed (10 tests, 20 assertions) against local `TEST_DATABASE_URL`. Subsequent review refinements: precise-version query results are typed and shape-checked with safe `INTERNAL_ERROR` on mismatch; rollback test uses valid first row and stale second row and compares all records; microsecond checks use `BigInt`; same-value stale rejection remains explicit. No QA DB or environment files used.

## Task 3: Private storage and upload hardening

**Files:**
- Modify existing storage adapter files discovered under `backend/src/` (reuse, do not create second abstraction)
- Modify `backend/src/modules/billing/upload.schema.ts`, `backend/src/modules/ticket/ticket-upload.schema.ts`, contract upload schema files if present
- Create `backend/src/shared/upload-validation.ts`
- Modify `backend/src/config.ts`, `backend/.env.example`
- Test `backend/src/test/storage.test.ts`, `backend/src/test/upload.test.ts`, `backend/src/test/upload-hardening.test.ts`

**Interfaces:**
- `validateUpload(input: UploadInput, policy: UploadPolicy): Promise<ValidatedUpload>` checks request/part limits, declared MIME, magic bytes, decoded size, count, checksum, and content type.
- `createPrivateObjectKey(scope: { motelId: string; resource: string; resourceId: string }): string` creates opaque server-owned keys; caller cannot provide path or extension.
- `putPrivateObject(upload: ValidatedUpload, key: string): Promise<StoredObjectMetadata>` and `deletePrivateObject(key: string): Promise<void>` provide bounded timeout/retry and orphan cleanup.
- `getAuthorizedSignedRead(...): Promise<{ url: string; expiresInSeconds: 300 }>` authorizes before signing and never caches in service worker.

- [ ] Write failing tests for payment proof one JPEG/PNG up to 10 MB, meter/ticket/contract policies, bad bytes, MIME mismatch, path traversal, public URL rejection, signed TTL, timeout/502 mapping, and orphan cleanup.
- [ ] Implement validation before buffering/provider work where runtime permits, opaque scoped keys, checksum metadata, private ACL assumptions, and redacted storage errors.
- [ ] Verify storage/upload tests and `cd backend && bun run typecheck`.
- [ ] Update `docs/api-contract.md`, `docs/testing-strategy.md`, and env docs only for actual behavior.
- [ ] Commit `feat: harden private uploads and signed reads`.

## Task 4: Payment-proof data model, API, and manager transitions

**Files:**
- Modify `backend/src/modules/payment/payment.schema.ts`, `payment.types.ts`; create `payment.service.ts`, `payment.route.ts`
- Modify `backend/src/modules/billing/billing.service.ts`, `billing.types.ts`, `backend/src/app.ts`
- Create migration under `backend/drizzle/`; modify `backend/src/db/schemas.ts`, `backend/src/db/test-db.ts`
- Tests `backend/src/test/payment-proof-schema.test.ts`, `payment-proof.test.ts`, `payment-proof-upload.test.ts`, `payment-review.test.ts`, `payment-race.test.ts`, `renter-payment-isolation.test.ts`
- Modify `docs/api-contract.md`, `docs/frontend-ui-specs.md`, `docs/testing-strategy.md`, `docs/full-flow-test-plan.md`

**Interfaces:**
- `submitPaymentProof(session: RenterSession, invoiceId: string, file: File): Promise<PaymentProofResponse>`.
- `getRenterPaymentProof(session: RenterSession, invoiceId: string): Promise<PaymentProofResponse | null>`.
- `getManagerPaymentProof(managerId: string, motelId: string, invoiceId: string): Promise<ManagerPaymentProofResponse>`.
- `approvePaymentProof(managerId: string, motelId: string, invoiceId: string): Promise<InvoicePaymentResult>`.
- `rejectPaymentProof(managerId: string, motelId: string, invoiceId: string, reason: string): Promise<PaymentProofResponse>`.
- `confirmCashPayment(managerId: string, motelId: string, invoiceId: string): Promise<InvoicePaymentResult>`.
- DB enforces FK/check/status rules and one non-rejected current proof per invoice; rejected proof rows remain immutable history.

- [ ] Write DB tests first for all FK/check/partial-unique constraints and valid boundaries.
- [ ] Implement additive migration and reset-table wiring.
- [ ] Write HTTP/service tests for own/foreign scope, exact multipart validation, pending/approved duplicate prevention, rejected replacement, 300-second signed reads, safe response redaction, and paid mutation denial.
- [ ] Implement payment service using billing exported transition seams; approve/reject/cash use transactions, row locks, stable event keys, idempotent repeat behavior, and `409 CONFLICT` for conflicting races.
- [ ] Verify each explicit backend test file sequentially; no full parallel `bun test`.
- [ ] Update owning docs with exact response/error/status vocabulary.
- [ ] Commit `feat: add race-safe payment proof workflow`.

## Task 5: Durable Web Push, ZNS/ZBS fallback, webhook safety, and scheduler observability

**Files:**
- Modify `backend/src/modules/notification/notification.schema.ts`, `notification.types.ts`, `notification.service.ts`, `notification.route.ts`, `notification.webhook.ts`, `scheduler.service.ts`
- Create provider adapter files beside notification implementation and migration under `backend/drizzle/`
- Modify `backend/src/env.ts`, `backend/src/config.ts`, `backend/src/db/schemas.ts`, `backend/src/db/test-db.ts`, `backend/.env.example`
- Tests `backend/src/test/push-subscription.test.ts`, `notification-fallback.test.ts`, `notification-integration.test.ts`, `zalo-webhook-security.test.ts`, `scheduler-observability.test.ts`

**Interfaces:**
- `registerPushSubscription(session: RenterSession, input: PushSubscriptionInput): Promise<PushSubscriptionResponse>`.
- `revokePushSubscription(session: RenterSession, subscriptionId: string): Promise<void>`.
- `enqueueNotification(input: NotificationEventInput): Promise<NotificationEvent>` with unique `eventKey`.
- `deliverNotification(eventId: string): Promise<DeliveryResult>` attempts Web Push first, deactivates permanent failures, then queues configured ZNS/ZBS fallback; max three attempts.
- `verifyWebhookSignature(rawBody: Uint8Array, signature: string, secret: string): boolean` validates encoding/length then constant-time compares.

- [ ] Write failing tests for subscription ownership/deduplication/revocation, push success/denial/permanent failure, fallback, transient max-three retry, event-key idempotency, redacted payloads, webhook raw-body signature/replay/follow/unfollow/mapping, and scheduler lease outcomes.
- [ ] Implement durable event fields, provider IDs/status/failure class/correlation ID, atomic enqueue after domain commit, and no browser-callable provider-send route.
- [ ] Keep activation fallback usable through manager manual link/QR when providers disabled; exclude SMS.
- [ ] Verify notification files sequentially and typecheck.
- [ ] Update API/config/flow docs and add operator-safe failure/queue metrics contract.
- [ ] Commit `feat: make notifications durable and push first`.

## Task 6: Renter API and mobile PWA payment experience

**Files:**
- Modify `backend/src/modules/renter-portal/renter-portal.route.ts`, `.service.ts`, `.types.ts`, `backend/src/modules/auth/magic-link.route.ts`
- Modify `frontend/src/app/renter/page.tsx`, `frontend/src/app/portal/layout.tsx`, `frontend/src/app/portal/page.tsx`, `frontend/src/app/portal/bills/page.tsx`, `frontend/src/app/portal/bills/[id]/page.tsx`
- Create/modify `frontend/src/components/renter/payment-proof-form.tsx`, `push-permission.tsx`, `frontend/src/lib/api/renter.server.ts`, `renter.client.ts`, `types.ts`; add PWA files only if no existing seam
- Tests backend `renter-portal.test.ts`, `renter-auth.test.ts`, `renter-payment-isolation.test.ts`; frontend unit tests and `frontend/e2e/renter-portal.spec.ts`

**Interfaces:**
- Relative browser API methods use `/api/...`; no `BACKEND_URL` or provider secret reaches client.
- Portal DTO contains own itemized invoice amounts, QR payload, payment status/method, and proof status only; no object key or reusable URL.
- UI supports activation/expiry, one-image picker, pending/approved/rejected states, rejected replacement, paid upload lock, push skip/denied fallback, safe retry, keyboard focus, and 44px controls.

- [ ] Add failing API/model tests for exchange/replay/expiry, manual link/QR, own-only invoices, redaction, rate limits, logout invalidation, and renter paid-mutation denial.
- [ ] Add Vitest tests for client paths/bodies/status decoding, image hints, state transitions, and no paid action.
- [ ] Implement route/UI using existing tokens/components and Next 16.3.8 conventions; read `frontend/node_modules/next/dist/docs/` before route changes.
- [ ] Add Playwright fixture cases at 360/375/430 widths, no horizontal overflow, push denied fallback, focus, and rejected replacement.
- [ ] Verify frontend typecheck/lint/build/unit tests plus fixture E2E when browser is launchable.
- [ ] Commit `feat: ship renter payment portal flow`.

## Task 7: Manager payment review UI and complete fixture flow

**Files:**
- Modify actual manager invoice route, expected `frontend/src/app/(manager)/billing/[periodId]/invoices/page.tsx`
- Create/modify `frontend/src/components/manager/` payment proof components and `frontend/src/lib/api/billing.client.ts`/types
- Modify `frontend/e2e/fixtures/api.ts`, create/modify `frontend/e2e/manager.spec.ts` and `frontend/e2e/full-flow.spec.ts`
- Modify `docs/frontend-ui-specs.md`, `docs/api-contract.md`, `docs/full-flow-test-plan.md`

**Interfaces:**
- Manager UI reads proof status and short-lived signed preview; approve/reject/cash actions call documented APIs and never display raw keys.
- Fixture state models idempotent repeated actions, stale/conflict errors, missing proof, signed URL failure, and notification-independent payment success.

- [ ] Write fixture tests for approve/reject/replacement/cash, repeated actions, stale errors, missing proof, signed preview failure, focus/mobile layout, and full manager-to-renter flow.
- [ ] Implement explicit reject reason and cash confirmation; preserve existing invoice arithmetic/VietQR.
- [ ] Verify `cd frontend && bun run typecheck && bun run lint && bun run build && bun run test && bun run test:e2e` in order; record browser-library blocker rather than bypassing it.
- [ ] Commit `feat: add manager payment review UI`.

## Task 8: Observability, backup/restore, rollout and rollback documentation

**Files:**
- Create/modify `backend/src/observability/logger.ts`, `metrics.ts`, `scheduler-metrics.ts` using existing logging seams
- Create `docs/operations/production-rollout.md`, `docs/operations/backup-restore.md`, `docs/operations/incident-response.md`
- Modify `docs/full-flow-test-plan.md`, `docs/testing-strategy.md`, `README.md` only where ownership requires a link
- Add deployment/backup scripts only if current deployment tooling lacks them; do not add speculative orchestration
- Test `backend/src/test/observability.test.ts`; document provider/storage sandbox checks and restore evidence format

**Interfaces:**
- Structured log context includes request ID, route, status, latency, actor role, safe motel scope, and error code; redaction is centralized.
- Metrics cover auth/rate limits, uploads, payment transitions, notification age/retry/failure, scheduler lease/run outcomes, DB pool saturation, readiness failures, and backup result.
- Backup runbook records RPO/RTO, encrypted daily PostgreSQL backup, retention, object existence/size/timestamp/checksum/manifest, aligned DB/R2 retention, and disposable restore validation.

- [ ] Add tests asserting sensitive values never serialize into logs/metrics and scheduler records scheduled/start/end/lease/count/failure/next-run.
- [ ] Write rollout order: configure secrets/HTTPS/private DB/R2, run migration job, verify `/health`/`/ready`, start one backend, then frontend; enable renter reads, proof upload, manager review/cash, then push/fallback events.
- [ ] Write rollback order: stop new route/event creation, preserve proof evidence and financial state, redeploy reviewed prior SHA, verify readiness and manual link/QR; never test restore over live production.
- [ ] Write restore drill: disposable PostgreSQL/private object store, migrate/status checks, readiness, invoice/proof reads, signed authorization, outbox consistency; attach command/timestamp/SHA/count/blocker evidence.
- [ ] Commit `docs: add production rollout and restore runbooks`.

## Task 9: Release verification and review gates

**Files:**
- No product code by default; modify `docs/testing-strategy.md`, `docs/full-flow-test-plan.md`, and release evidence files only when checks expose required doc drift.
- Review uncommitted implementation with `/review-security` and `/review-code`.

- [ ] Run backend `bun run typecheck`, then every explicit auth/payment/upload/notification test file sequentially against disposable PostgreSQL.
- [ ] Run frontend `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, fixture `bun run test:e2e`, and `E2E_REAL=1 bun run test:e2e` only against QA with explicit credentials.
- [ ] Run `git diff --check`; record exact SHA, commands, timestamps, counts, environment, and blocked browser/provider/infrastructure checks.
- [ ] Run `/review-security` for auth, tenancy, uploads, money, webhook; run `/review-code` for module boundaries, types, tests, and doc drift. Missing test or skipped gate remains blocked, not green.
- [ ] Execute Gates 1, 2, and 3 from the spec: security/operations; payment runtime; notification/release readiness.
- [ ] Commit release evidence only after implementation commits are reviewed; do not commit secrets, credentials, or provider payloads.

## Completion Criteria

- Production secrets/HTTPS/private DB/one-shot migration/readiness/reverse-proxy gating are verified.
- Auth timing, cookies, invalidation, rate limits, redaction, and tenant `404` behavior are tested.
- Uploads are private, byte/MIME/count/size checked, orphan-safe, signed-read authorized, and never expose keys.
- Payment proof and cash/approval transitions are manager-only, auditable, idempotent, and race-safe; paid state cannot reverse.
- Web Push-first notifications, ZNS/ZBS fallback, webhook verification, durable outbox, retry bounds, and metrics are verified; SMS remains excluded.
- RPO/RTO, encrypted backup retention, checksum/manifest verification, disposable restore drill, and rollback evidence are recorded.
- Fixture E2E covers required 360/375/430/1280 widths; QA smoke uses `E2E_REAL=1`; blocked checks are explicitly recorded.
- `/review-security` and `/review-code` pass with no unresolved high-severity findings.
