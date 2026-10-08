# Renter Portal, Meter Capture, and Zalo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Build Sub-projects 6–8 so frontend receives complete capture, renter portal, upload, and Zalo APIs.

**Architecture:** Add shared private storage and notification seams first, then renter APIs, capture upload/sync, and frontend route groups. Keep billing and contract modules as owners of domain state; cross-module calls use exported services.

**Tech Stack:** Bun, ElysiaJS, Drizzle/PostgreSQL, Next.js, IndexedDB, service worker, Cloudflare R2 S3 API, Zalo OA/ZNS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-renter-capture-zalo-design.md`

## Global Constraints

- Cross-tenant resources return `404`.
- Money crosses HTTP as digit strings; meter values remain decimal strings.
- Uploads are private, server-authorized, magic-byte validated, size/count limited, and use short-lived signed URLs.
- OTP plaintext, provider tokens, credentials, object keys, and signed URLs never enter logs or API responses.
- Notification delivery is idempotent, bounded, and auditable.
- Browser calls relative `/api/*`; `BACKEND_URL` stays server-only.
- Backend DB tests run sequentially against disposable `TEST_DATABASE_URL`.

## Review Focus

- Replay a magic link, webhook, notification event, and upload request; each must be idempotent or rejected safely.
- Race two renter OTP verifications and two capture sync writes; only valid single-owner state may win.
- Request foreign tenant resources with valid sessions; no existence leak through status, body, or signed URL.
- Upload valid-looking files with incorrect magic bytes and oversized streams; reject before storage.
- Simulate R2/Zalo outage midway through mutation; domain state must remain consistent and retry state auditable.

### Task 1: Shared private storage adapter

**Files:**
- Create: `backend/src/shared/storage.ts`, `backend/src/shared/storage.fake.ts`, `backend/src/shared/storage.r2.ts`
- Modify: `backend/src/env.ts`, `backend/src/config.ts`, `.env.example`
- Test: `backend/src/test/storage.test.ts`

**Interfaces:**
- Produces `StorageAdapter.put(input): Promise<{ objectKey, size, checksum, contentType }>`
- Produces `StorageAdapter.delete(objectKey): Promise<void>`
- Produces `StorageAdapter.createSignedDownload(objectKey, expiresInSeconds): Promise<string>`

- [ ] Write failing tests for private keys, supported MIME/signature checks, size limits, signed URL TTL, fake adapter failures, and no credential leakage.
- [ ] Run `bun test src/test/storage.test.ts`; expect failure on missing adapter.
- [ ] Implement stream-limited JPEG/PNG/PDF inspection and fake/R2 adapters. Keep R2 credentials server-only.
- [ ] Run storage tests and backend typecheck.
- [ ] Commit `feat(storage): add private object storage adapter`.

### Task 2: Upload metadata and meter-photo API

**Files:**
- Create: `backend/src/shared/upload.schema.ts`, migration under `backend/drizzle/`
- Modify: `backend/src/db/test-db.ts`, billing route/service/types, `backend/src/app.ts`
- Test: `backend/src/test/upload.test.ts`, `backend/src/test/capture.test.ts`

**Interfaces:**
- `uploadMeterPhoto(motelId, periodId, readingId, managerId, file): Promise<UploadResponse>`
- `getMeterPhoto(motelId, periodId, readingId, managerId): Promise<SignedUploadResponse>`

- [ ] Test tenant 404, draft-only upload, MIME/magic/size rejection, replacement, signed read authorization, and R2 failure.
- [ ] Run tests to confirm RED.
- [ ] Add upload metadata with unique resource key, content type, size, checksum, motel FK, and timestamps.
- [ ] Implement multipart routes; store only opaque key and metadata.
- [ ] Run upload/capture tests and migration/typecheck.
- [ ] Commit `feat(capture): add private meter photo upload`.

### Task 3: Notification outbox and Zalo provider seams

**Files:**
- Create: `backend/src/modules/notification/{notification.schema.ts,notification.service.ts,notification.types.ts,notification.route.ts}`, migration
- Modify: `backend/src/db/test-db.ts`, `backend/src/env.ts`, `backend/src/app.ts`
- Test: `backend/src/test/notification.test.ts`, `backend/src/test/zalo.test.ts`

**Interfaces:**
- `enqueueNotification(input): Promise<NotificationEvent>`
- `deliverNotification(eventId): Promise<NotificationEvent>`
- `setZaloProvider(provider): void`

- [ ] Test unique event keys, OA/ZNS selection, bounded retries, transient/permanent failures, provider IDs, and OTP redaction.
- [ ] Run notification tests RED.
- [ ] Add notification event/outbox schema with status, channel, attempt count, next retry, failure class, provider ID, and unique event key.
- [ ] Implement provider interfaces, fake provider, Zalo signature verification, follow/unfollow idempotency, and webhook route.
- [ ] Run notification/Zalo tests and typecheck.
- [ ] Commit `feat(zalo): add notification outbox and webhook integration`.

### Task 4: Renter portal read APIs

**Files:**
- Create/modify: `backend/src/modules/renter-portal/{renter-portal.route.ts,renter-portal.service.ts,renter-portal.types.ts}`
- Modify: `backend/src/app.ts`, `backend/src/modules/auth/magic-link.route.ts`
- Test: `backend/src/test/renter-portal.test.ts`, `backend/src/test/renter-auth.test.ts`

**Interfaces:**
- `getRenterMe(renterSession): Promise<RenterPortalProfile>`
- `listRenterPeriods(renterSession): Promise<RenterPeriod[]>`
- `listRenterInvoices(renterSession, periodId): Promise<RenterInvoice[]>`

- [ ] Test valid exchange, replay, expiry, own reads, foreign IDs, redaction of manager fields, and no payment mutation.
- [ ] Run tests RED.
- [ ] Implement session-derived renter scope and read DTOs using exported billing/contract services.
- [ ] Add exact routes and error envelopes.
- [ ] Run renter portal/auth tests and typecheck.
- [ ] Commit `feat(renter): add scoped portal read APIs`.

### Task 5: Renter tickets and private attachments

**Files:**
- Create/modify: `backend/src/modules/ticket/{ticket.route.ts,ticket.service.ts,ticket.types.ts}`
- Modify: `backend/src/app.ts`, ticket schema/migration
- Test: `backend/src/test/ticket.test.ts`

- [ ] Test create/list, tenant scope, manager-note exclusion, 0–5 images, invalid files, and Zalo failure isolation.
- [ ] Run tests RED.
- [ ] Implement ticket API and storage metadata through Task 1 adapter.
- [ ] Enqueue notification event without making ticket creation depend on provider success.
- [ ] Run ticket tests and typecheck.
- [ ] Commit `feat(ticket): add renter help requests`.

### Task 6: Capture PWA queue and service worker

**Files:**
- Create: `frontend/src/lib/capture/{queue.ts,sync.ts,types.ts}`, service-worker files, capture routes/components
- Modify: `frontend/next.config.ts`, `frontend/src/lib/api/types.ts`
- Test: `frontend/src/lib/capture/*.test.ts`, `frontend/e2e/capture.spec.ts`

- [ ] Test queue persistence across reload, retry, conflict, sent-period lock, logout clearing, and no API-response caching.
- [ ] Run Vitest RED.
- [ ] Implement IndexedDB queue and service-worker app-shell cache only.
- [ ] Add mobile capture UI using existing billing API and upload routes.
- [ ] Run typecheck, lint, unit tests, build, and capture E2E.
- [ ] Commit `feat(capture): add offline meter capture PWA`.

### Task 7: Renter portal frontend

**Files:**
- Create: `frontend/src/app/(renter)/**`, `frontend/src/components/renter/**`, `frontend/src/lib/api/renter*`
- Modify: frontend API fixtures and navigation boundaries
- Test: renter unit tests and `frontend/e2e/renter-portal.spec.ts`

- [ ] Test magic-link exchange, invoice QR, contract clauses/OTP, ticket form, expiry, rate limits, and 375px keyboard flow.
- [ ] Run tests RED.
- [ ] Implement portal pages and typed API client; renter cannot mark payment paid.
- [ ] Run full frontend gates and renter E2E.
- [ ] Commit `feat(renter): add renter portal flows`.

### Task 8: Wire domain notifications

**Files:**
- Modify: billing, contract, renter, auth/magic-link services
- Test: affected backend service tests and `backend/src/test/notification-integration.test.ts`

- [ ] Test billing send, invoice payment, welcome, contract delivery, OTP, and expiry event keys; provider failure/state safety.
- [ ] Run RED tests.
- [ ] Invoke `enqueueNotification` from domain owners without exposing provider routes to browsers.
- [ ] Run all affected tests sequentially.
- [ ] Commit `feat(notifications): wire billing and contract delivery events`.

### Task 9: Documentation and delivery verification

**Files:**
- Modify: `docs/api-contract.md`, `docs/frontend-ui-specs.md`, `docs/testing-strategy.md`, `backend/.env.example`
- Test: full-flow plan at `docs/full-flow-test-plan.md`

- [ ] Update exact request/response/error shapes and rollout flags.
- [ ] Run backend and frontend gates in documented order.
- [ ] Run security/code review; fix Critical/Important findings.
- [ ] Run `git diff --check`; commit `docs: document renter capture and Zalo flows`.

## Final verification

Run `cd backend && bun run typecheck`, all explicit backend files sequentially, then `cd frontend && bun run typecheck && bun run lint && bun run build && bun run test && bun run test:e2e`. Run `E2E_REAL=1 bun run test:e2e` only with QA stack and credentials.
