# Renter Portal, Meter Capture, and Zalo Integration

- **Date:** 2026-10-08
- **Status:** Draft for review
- **Scope:** Sub-projects 6, 7, and 8 as one delivery wave
- **Depends on:** Core Backend, Room & Renter Management, Billing, Contract Management

## Goal

Complete backend interfaces needed by frontend for offline meter capture, renter portal, and Zalo delivery. Preserve tenant isolation, exact VND strings, existing billing concurrency rules, and deferred delivery safety.

## Boundaries

Included:

- Installable manager capture PWA with IndexedDB queue and service-worker app shell.
- Private meter-photo upload through backend to Cloudflare R2.
- Renter magic-link portal for invoices, contracts, OTP signing, and help requests.
- Zalo OA webhook/follower state, OA messages, ZNS fallback, retries, idempotency, and audit rows.
- API documentation, UI specification, tenancy/security tests, and fixture-backed E2E coverage.

Excluded:

- Payment gateways or bank reconciliation.
- In-app chat; manager replies in Zalo.
- SMS, native mobile apps, certified digital signatures.
- Public object storage URLs.
- Renter account/password registration.

## Shared rules

- Manager scope comes from manager session; renter scope comes from renter session. Client IDs never select tenant ownership.
- Cross-tenant resources return `404`.
- Money crosses HTTP as digit strings. Meter values remain decimal strings.
- Uploads pass through backend, with MIME declaration, magic-byte validation, a 5 MB default per-file limit, explicit resource overrides, count limits, private object keys, and short-lived signed reads.
- Notification attempts never make a billing period, invoice, or contract appear sent unless the owning transaction says so.
- External delivery is idempotent by event key. Retries are bounded and auditable.
- Zalo and R2 outages return `EXTERNAL_SERVICE_ERROR` where the operation depends on them; reads and draft management remain available where possible.

## Storage and uploads

Add a storage adapter owned by shared infrastructure with a fake implementation for tests and an R2 implementation for deployment. Object keys are opaque server-generated keys scoped by motel and resource. Credentials stay server-side. The API returns metadata and signed download URLs only after authorization; it never returns raw credentials or reusable public URLs.

Default upload limit is 5 MB per file. Resource overrides: meter photos allow one JPEG/PNG up to 10 MB; Contract Management allows 1–3 PDF/JPEG/PNG files up to 10 MB each, immutable after paper activation; help tickets allow up to five JPEG/PNG files up to 10 MB each.

## Manager capture

The capture route group is installable and mobile-first. It loads a selected draft billing period, records current readings and optional photo references locally, and marks each queue item as pending, synced, conflict, or failed. Queue entries retain the server `updatedAt` used for optimistic concurrency. Sync sends the existing atomic reading batch endpoint; stale rows become `READING_CONFLICT` and remain visible for deliberate re-entry. Sent periods become read-only and queued writes are not retried.

The service worker caches only app shell assets and non-sensitive static data. It never caches authenticated API responses or signed URLs. Logout clears local capture data for the affected manager/device.

## Renter portal

Magic-link exchange consumes a single-use token and sets a 24-hour httpOnly renter session. Portal routes use session renter identity only.

Required reads and writes:

- Current renter profile, room, active contract, and contract clauses.
- Billing periods and itemized invoices, including QR payload and payment state.
- OTP request and verify for eligible draft contracts; OTP is never returned.
- Help-ticket create/list with description, category, and private photo metadata.
- Safe error states for expired links, missing resources, sent periods, OTP expiry, and rate limits.

Renter responses exclude manager-only notes, internal object keys, provider credentials, and other renters' data. Payment remains manager-confirmed; renter portal does not mark invoices paid.

## Zalo integration

Implement provider boundaries before wiring routes:

- Verify OA webhook signatures and process follow/unfollow events idempotently.
- Store follower identity against the correct renter only after verified provider payload and tenant mapping.
- Send free OA messages to followers.
- Use ZNS fallback only for approved templates and configured recipients.
- Persist generic notification outbox events with unique event keys, channel, provider request ID, status, failure reason classification, attempt count, and timestamps; retain `zalo_notifications` only as a linked legacy Zalo audit/read model.
- Retry transient provider failures with bounded backoff; do not retry invalid recipient/template failures.
- Deduplicate by stable event key, such as `invoice:<id>:sent`, `contract:<id>:otp:<request timestamp>`, or `magic-link:<id>`.
- Keep OTP plaintext out of database, logs, responses, and notification audit payloads.

Billing period send, invoice payment confirmation, renter welcome, contract delivery, OTP, and expiry reminders call the notification service. Each domain mutation and its generic notification outbox insert commit atomically. Provider delivery runs post-commit; delivery failure never rolls back domain state. Outbox failure rolls back the domain mutation when notification enqueue is required.

## API surface

Document and implement exact request/response/error shapes before frontend work:

- `POST /api/renter/magic-links/exchange`
- `POST /api/renter/magic-links/resend`
- `GET /api/renter/me`
- `GET /api/renter/billing/periods`
- `GET /api/renter/billing/periods/:periodId/invoices`
- `GET /api/renter/contracts/:contractId`
- `POST /api/renter/contracts/:contractId/sign-request`
- `POST /api/renter/contracts/:contractId/verify`
- `GET /api/renter/tickets`
- `POST /api/renter/tickets`
- `POST /api/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo`
- `GET /api/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo`
- `POST /api/zalo/webhook`
- Internal manager-triggered notification operations remain behind domain services, not browser-callable provider endpoints.

Existing billing and contract routes remain canonical where their current shapes already satisfy these needs. Add only missing renter and upload routes.

## Data changes

Add only tables/fields required for durable behavior:

- Upload metadata with resource type, resource ID, motel ID, object key, content type, size, checksum, and timestamps.
- Notification event/outbox row with unique event key and delivery state.
- Provider identity fields or mapping table for verified Zalo follower IDs.
- Retry scheduling fields and bounded-attempt constraints.
- Ticket response metadata only if required by the existing ticket UX.

Every new FK, unique constraint, check constraint, and tenant boundary gets a real PostgreSQL test. Add all tables to `resetDb()`.

## Verification

Backend tests run one file at a time against disposable local PostgreSQL: schema constraints, upload validation, renter tenancy, magic-link replay/expiry, invoice and contract reads, OTP limits, ticket tenancy, webhook signature/idempotency, provider failure/retry, and billing/contract state safety.

Frontend tests cover offline queue recovery, conflict handling, upload failure, magic-link expiry, invoice QR, OTP states, ticket form, responsive 375px layouts, keyboard access, and service-worker cache boundaries. E2E uses fixtures; real provider/R2 smoke runs only when credentials are configured.

Security review must cover tenant isolation, upload validation, signed URL authorization, webhook verification, secrets, OTP handling, replay, retry duplication, and log redaction.

## Rollout

1. Add additive migrations and fake adapters.
2. Deploy storage and notification configuration without enabling sends.
3. Verify R2 private access and Zalo webhook signature checks.
4. Enable renter reads and capture sync.
5. Enable notification sends per event after provider smoke tests.
6. Publish frontend route groups after API and fixture E2E gates pass.
