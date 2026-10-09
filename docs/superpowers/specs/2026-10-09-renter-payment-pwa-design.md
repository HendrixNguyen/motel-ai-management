# Renter Payment PWA MVP Design

- **Date:** 2026-10-09
- **Status:** Implementation-ready design
- **Scope:** Renter activation, invoice viewing, VietQR payment, one payment-proof image, manager review, cash confirmation, and notification delivery
- **Depends on:** Existing renter magic-link auth, billing/invoice snapshots, private storage adapter, notification outbox, same-origin frontend proxy

## Goal

Give renters a small mobile-first PWA that lets them activate access, see current invoices and VietQR instructions, submit exactly one payment-proof image after a bank transfer, and see review state. Managers remain the only actors who mark invoices paid: they approve or reject bank proof, or confirm cash payment. After activation, Web Push is primary; ZNS/ZBS is fallback. SMS is out of MVP unless explicitly documented later.

## Explicit non-goals

No chat, contracts, tickets, bank auto-reconciliation, payment gateway, multi-image uploads, renter-side paid transition, renter accounts/passwords, or broad manager notification UI.

## Existing seams to preserve

- `backend/src/modules/auth/magic-link.route.ts` exchanges one-time links for an `httpOnly` `renter_session`; `shared/magic-link` owns token consumption.
- `backend/src/modules/renter-portal/` already scopes profile, periods, and invoices through `RenterSession` and exported billing services.
- `backend/src/modules/billing/` owns invoice totals, QR payload snapshots, and manager-only `paid`/`overdue` transitions.
- `backend/src/modules/billing/upload.schema.ts` provides private upload metadata with one resource row per `(resourceType, resourceId)`; payment proof must use a distinct resource type and invoice resource ID.
- `backend/src/modules/notification/` currently persists idempotent Zalo events. Add Web Push as a channel/provider without exposing provider credentials or browser-callable provider operations.
- Browser calls remain relative `/api/*`; renter and manager sessions remain separate cookies and auth plugins.

## Domain model

### Payment proof

Add `payment_proofs` as the payment-domain source of truth rather than overloading `uploads` metadata:

- `id`, `invoice_id`, `renter_id`, `motel_id`
- `object_key`, `content_type`, `size`, `checksum`
- `status`: `pending`, `approved`, `rejected`
- `submitted_at`, `reviewed_at`, `reviewed_by_manager_id`, `rejection_reason`
- partial unique `(invoice_id)` for non-rejected proofs, so one invoice has at most one current proof; a rejected proof remains audit history and may be replaced by inserting one new pending proof, while pending/approved proofs cannot be replaced
- foreign keys and motel/renter ownership checks

Use invoice payment state as the financial truth. Proof submission records evidence and queues manager review; it does not mark the invoice paid. Manager approval locks proof approval and calls billing's exported `markInvoicePaid` service in one transaction or an explicitly idempotent orchestration. Rejection leaves invoice unpaid and preserves immutable proof history; one replacement current proof is allowed only after rejection. Cash confirmation directly invokes manager-only billing payment transition and creates an audit record if existing audit infrastructure supports it.

### Renter activation

Keep existing random single-use magic-link exchange and 24-hour session. Delivery sources are ordered: configured ZNS/ZBS or manager-generated manual QR/link fallback. Do not add passwords or a second identity model. Manager issue/reissue remains motel-scoped and returns a copyable link; token values never enter logs.

### Notification delivery

Use `notification` for an outbound event and `channel` for its transport. `NotificationChannel = web_push | zns | zbs`; SMS is not an MVP channel and may be added only as an explicitly documented fallback. Web Push subscription belongs to `(renterId, motelId, endpoint)` with unique endpoint, public key/auth material, timestamps, and active/revoked state. Notification orchestration attempts Web Push first for activated renters; permanent push failure deactivates subscription and queues configured ZNS/ZBS fallback. Delivery remains idempotent by stable event key, bounded retries, and redacted payloads. First activation uses configured ZNS/ZBS or manager-generated manual link/QR fallback; later invoice/proof/payment events use push-first fallback. No route promises delivery: queued, sent, and failed are distinct states.

## API surface

All renter routes derive renter and motel from `renter_session`; all manager routes derive manager and motel ownership from `manager_session`. Foreign resources return `404`.

### Renter

- `POST /api/renter/magic-links/exchange` — existing one-time exchange.
- `POST /api/renter/logout` — existing session clear.
- `GET /api/renter/me` — existing profile/room response.
- `GET /api/renter/billing/periods` — existing scoped period list.
- `GET /api/renter/invoices/:invoiceId` — existing scoped invoice detail including bank account and QR payload.
- `POST /api/renter/invoices/:invoiceId/payment-proof` — multipart single image, JPEG/PNG only, max 10 MB; returns proof metadata and `pending` state. Reject if invoice is paid, proof is pending/approved, period is inaccessible, or file fails content/MIME/size checks.
- `GET /api/renter/invoices/:invoiceId/payment-proof` — returns current proof status and a short-lived signed URL only when caller owns invoice.
- `DELETE /api/renter/invoices/:invoiceId/payment-proof` — omit from MVP unless replacement UX requires it; rejected proof replacement is preferred through a new POST after explicit state validation.
- `POST /api/renter/push-subscriptions` — planned route: validate endpoint and Web Push keys; upsert own subscription.
- `DELETE /api/renter/push-subscriptions/:subscriptionId` — planned route: revoke own subscription.

### Manager

- `POST /api/manager/motels/:motelId/renters/:renterId/magic-link` — existing manager-issued link; UI exposes copy/QR fallback.
- `GET /api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof` — review metadata and short-lived signed image URL.
- `POST /api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/approve` — approve pending proof and mark invoice paid through billing service; retry is idempotent only when the same proof/payment is already settled. Notification enqueue failure aborts approval/payment; later delivery failure leaves approval/payment committed and marks notification failed for retry.
- `POST /api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/reject` — body `{reason}`; invoice remains unpaid; rejected proof stays history and permits one replacement current proof.
- `POST /api/manager/motels/:motelId/billing/invoices/:invoiceId/cash-confirmation` — manager-only explicit confirmation; marks invoice paid without proof and records payment method `cash` when supported by the billing response contract.

Exact response/error bodies must be added to `docs/api-contract.md` before implementation. Money remains digit strings. Proof object keys never cross HTTP.

## State and transaction rules

1. Invoice must be `unpaid` or `overdue` for proof submission; paid invoices return conflict.
2. A pending or approved proof blocks new submission. A rejected proof remains immutable audit history; a new POST may insert one replacement pending proof only after the rejected state is validated. The database permits one non-rejected proof per invoice.
3. Proof submission and metadata insert happen only after validated content is accepted; failed storage leaves no usable proof row.
4. Approval locks proof state and invoice paid transition atomically. Concurrent approve/reject/cash calls resolve idempotently without double payment timestamps.
5. Rejection requires manager ownership and preserves audit fields; renter sees safe reason text only.
6. Cash confirmation never accepts renter identity or payment status from request body.
7. Notification enqueue is after committed domain state or through an outbox transaction; delivery failure never rolls back proof review or payment state.
8. Payment-state mutation succeeds independently of notification delivery. If enqueue fails before commit, the payment transaction rolls back and returns `EXTERNAL_SERVICE_ERROR`; if delivery fails after enqueue, proof/payment state stays committed, notification is `failed`, and the manager can retry without changing payment state.

## Security and tenancy

- Separate renter and manager auth middleware/plugins and cookies.
- Every query scopes by session-derived renter/motel or manager-owned motel; never trust `renterId`, `motelId`, or `managerId` from body.
- Cross-tenant invoice, proof, subscription, and signed-image requests return `404`.
- Validate upload bytes, not only filename/declaration; stream-limit before buffering; JPEG/PNG only; max 10 MB; opaque server keys; private bucket; short signed URL TTL.
- Never log or return magic tokens, push private keys, object keys, signed URLs beyond intended response, provider credentials, or raw notification payload secrets.
- Rate-limit magic-link issue/exchange, proof submission, and push subscription mutation.
- CSP/service-worker scope limited to renter PWA; never cache authenticated API responses, invoice data, or signed URLs.

## Frontend behavior

Add a dedicated renter route group under `frontend/src/app/(renter)/` or adapt existing `/renter` activation and `/portal` pages without affecting manager routes. Mobile target is 360–430px, max 480px desktop, no horizontal scroll, 44px controls, Vietnamese copy, semantic statuses not color-only.

Screens: activation/link-expired; invoice list; invoice detail with itemized total, local VietQR rendering from `qrCodeData`, copyable transfer description, proof upload/review status; push permission prompt after successful activation with skip/fallback state. Manager billing invoice detail gains proof preview, approve/reject controls, and cash confirmation with explicit confirmation.

PWA shell caches only static app assets. Push registration is progressive enhancement: portal works without permission, and fallback notifications remain available.

## Migration and rollout

Additive migrations first: payment proof enum/table, optional invoice payment method/audit fields, push subscription table, notification channel enum/data migration. Backfill none; existing invoices remain unpaid/paid unchanged. Deploy storage and push/ZNS/ZBS configuration disabled, verify fake adapters and signed URLs, enable renter reads, then proof submission, then manager review/cash confirmation, then push-first notifications per event. Manual link/QR fallback remains available throughout. SMS is excluded unless a later spec adds it as a named fallback. Roll back by disabling new routes/notification event creation; preserve proof rows and invoice state.

## Verification contract

Backend tests run explicit files sequentially against disposable `TEST_DATABASE_URL`. Required coverage: migration constraints, one-proof invariant, upload validation, renter/manager cross-tenant `404`, magic-link replay/expiry, proof state races, approval/cash idempotency, invoice immutability, signed URL authorization, push subscription ownership/deduplication, notification fallback/idempotency/retry/redaction. Frontend unit/E2E fixtures cover activation, invoice/QR, one-image upload, pending/approved/rejected states, cash confirmation, push denied/fallback, 360/375/430px accessibility and no overflow. Run backend typecheck/tests, frontend typecheck/lint/build/unit/E2E, `git diff --check`, and security/code review before rollout.
