# Renter portal: payment proof, Push-first billing, manual login recovery

## Goal and agreed scope

Make unpaid invoices and proof upload easy to find; notify renters of subsequent invoices independently of session expiry; let renters request a fresh link that the manager sends manually in Zalo. No ZNS/ZBS/SMS provider, no automated Zalo messaging, no session extension. Magic links remain single-use and valid for 24 hours; renter sessions remain 24 hours.

Decisions approved in conversation:
- Web Push first. Manager opens Zalo chat and manually sends copied link when needed.
- Unauthenticated recovery creates a manager-visible request, not an immediate login credential.
- Recovery uses a motel-specific public URL/QR or motel code plus phone. Remember only last motel context locally.
- Accept WebP and HEIC/HEIF selection, attempt native browser decoding and Canvas conversion to JPEG. Unsupported HEIC must show an honest conversion/screenshot instruction; universal HEIC support and new decoder dependencies are explicitly out of scope.

Prior review did not establish an actual upload failure in a browser. Treat its root-cause claims as hypotheses. Receiving Push and authenticating to open an invoice are separate capabilities.

## Existing boundaries

- `frontend/src/app/portal/page.tsx`, `portal/bills/page.tsx`, `portal/bills/[id]/page.tsx`: invoice discovery.
- `frontend/src/components/renter/payment-proof-panel.tsx`, `frontend/src/components/ui/file-upload.tsx`, `frontend/src/lib/payment-proof.ts`: reuse current upload flow; do not change manager CCCD acceptance globally.
- `backend/src/modules/payment/`: existing private JPEG/PNG storage, proof transitions and approval remain authoritative.
- `backend/src/modules/auth/`, `backend/src/shared/magic-link.ts`: link issuance/exchange and new recovery requests.
- `backend/src/modules/notification/`: existing subscriptions, leases and outbox; currently ZNS-oriented delivery has no production worker caller.
- `backend/src/modules/billing/billing.service.ts:198`: period sending currently commits before best-effort enqueue; invoice events can be lost.
- `frontend/public/capture-sw.js`: existing root service worker; do not add another worker.

## Implementation tasks

### 1. Establish baseline and reproduce upload behavior

Read package guides and current tests. Run real browser on local/QA with a disposable unpaid invoice. Follow period → invoice → select image → submit → reload → manager review. Record HTTP failure, visible controls, console errors and mobile geometry without tokens, phone numbers, signed URLs or image contents in artifacts. Fix only demonstrated blockers; retain pending/approved/paid upload guards and rejected-proof replacement.

### 2. Expose unpaid invoices and improve image input

- Add a compact home section listing renter-owned unpaid/overdue invoices across sent/closed periods, newest first, with room/month/amount, “Xem QR” and “Gửi chứng từ”. Do not hide older unpaid bills or a second rented room. Use a bounded paginated renter invoice endpoint if current period-only reads would require unbounded fan-out; scope entirely from session and delegate billing reads through its service.
- Both actions link to the invoice detail, with proof action targeting the upload section and moving focus appropriately. Reuse one proof form rather than duplicate payment state on home.
- Allow library selection rather than forcing `capture="environment"` for transfer screenshots. Configure accepted formats per usage; manager CCCD fields stay unchanged.
- Keep JPEG/PNG validation and existing 5,000,000-byte upload ceiling. WebP/HEIC/HEIF use native decoder plus Canvas export to JPEG, with explicit converting/error states. Maximum source 20,000,000 bytes and decoded image 40 megapixels; reject zero-size, unreadable or oversized inputs. Bound output longest side to 4096 pixels; use bounded quality reduction attempts and reject if still over 5 MB. Do not crop; flatten transparency onto white; preserve legibility and orientation in preview.
- Native decoding may allocate before dimension checks: do not claim full memory protection or guaranteed HEIC support. Release bitmap/object URLs, ignore stale async conversion results, block submit while converting, and validate exported bytes before upload. Unsupported decoder message must explain JPEG/PNG export or screenshot fallback, without claiming upload succeeded.
- Backend still accepts only JPEG/PNG; require nonempty bytes and complete signatures. No HEIC storage or new dependency.

### 3. Durable Push-first invoice delivery

- Enqueue an invoice-specific `bill-ready` event in the same DB transaction as sending the period. Stable event key per invoice, not period+renter. Provider calls remain outside transaction. Use exported notification service accepting transaction executor; preserve module boundaries.
- Extend existing outbox channel/status representation additively for Web Push and manual-action-required. Define retryable failure versus no subscription/config/permission/expired endpoints. Do not route this flow to unavailable ZNS. Keep historical ZNS records intact and never bulk replay them.
- Add bounded, non-overlapping polling from backend runtime using existing leases, attempt limits and retry fields. Network timeout must be shorter than lease; restart recovers pending work. Delivery is at-least-once: stable notification tag/event ID limits duplicate display; do not promise exactly-once delivery.
- Push payload contains generic title/body and same-origin invoice destination only. Never include magic token, amount, phone or proof. Subscription remains independent of JWT expiry; remove expired endpoints on 404/410. Track success/failure per endpoint where retries require it, avoiding repeated sends to successful devices.
- No configured Push or usable subscription produces manager-visible “Cần gửi thủ công”, not fake sent/delivered status. Provider acceptance is not proof renter saw notification.
- Correct Push opt-in unavailable/loading/registration failure states; avoid indefinite `serviceWorker.ready` waits. Match current browser endpoint, not first subscription. Logout removes only current-device subscription; expired sessions alone must not delete registrations.
- Notification click with valid session opens invoice. With expired session, route to recovery retaining only validated same-origin invoice destination and public motel context. After exchange, verify invoice ownership again before navigation; never trust destination as authorization.

### 4. Motel-scoped login recovery

- Add a unique random public motel access code, separate from credentials; backfill existing motels. Code is a routing hint, not authentication. Manager can copy permanent recovery URL and show QR. Do not expose public renter lists or phone lookup results.
- Add auth-owned login-request table: motel, renter, requested timestamp, status `pending|handled|dismissed`, handled timestamp and manager attribution. Enforce one pending request per renter/motel with partial unique index. No raw token, phone copy or caller-supplied chat recipient in request rows.
- Public endpoint accepts motel code and normalized phone with strict length/format limits. Match active renter inside motel through exported owning services. Return identical generic accepted response for known/unknown motel or phone; no token, renter metadata or match indication.
- Apply persistent limits before lookup: initial ceilings 5 requests/IP/15 minutes and 3 requests/motel+normalized-phone/hour. Hash phone-derived rate keys, use existing trusted-proxy policy, deduplicate pending requests without updating their age. Invalid syntax can receive validation error; valid unknown identities remain indistinguishable.
- `/renter` supports motel code + phone and generic confirmation. Motel URL preselects code; store only motel code as optional convenience. An invalid remembered code is editable. No session auto-creation. Existing token-entry/manual-link path remains supported.
- Manager Renters page gains motel-scoped pending requests and manual invoice-delivery tasks; renter detail reuses existing magic-link issuance. Manager actions authorize tenant and active renter, create fresh link on demand, copy message/link, and open Zalo for the stored renter phone, never requester-supplied destination.
- Browser cannot guarantee opening or sending Zalo messages. Validate supported Zalo deep-link format against official guidance during implementation; provide copied phone + copied message fallback. Require explicit “Đã gửi thủ công” confirmation; do not mark handled merely because chat opened or clipboard copy succeeded. Close/cancel leaves pending. Show expiry and resend action; no token stored in localStorage, outbox payload or request table.
- Hash new magic tokens at rest; current code stores plaintext. Introduce versioned/hash storage and explicitly invalidate existing unconsumed legacy links during rollout rather than keep plaintext compatibility indefinitely. Existing renter sessions remain valid. Notify managers that old links need reissue. Keep atomic single-use consumption, inactive-renter denial and tenant checks.

### 5. Integrate failure states and document contract

- Billing Push failure never rolls back sent invoices; durable task remains visible. Missing outbox insert fails period transaction rather than silently lose event.
- Recovery without manager action remains pending with honest copy. Do not promise instant login or automatic Zalo delivery.
- Rejected evidence can be replaced; pending evidence cannot. Storage failure retains selected file and clear retry path; avoid falsely reporting payment as paid.
- Update owning API/UI/design/testing docs and affected ADRs to remove contradictory ZNS-first promises for these flows. Document Push opt-in browser/platform restrictions, manual workflow, image support limits and unchanged session TTL. Update `.env.example` only for genuinely new configuration; never expose or replace existing secrets.

## Verification and rollout

- Tests: conversion success/failure/unsupported decoder, byte/output/source limits, async selection races; keyboard/mobile proof actions; unpaid invoices across periods and rooms; unauthenticated request enumeration resistance/rate limits/deduplication; cross-tenant manager and renter HTTP denials; DB unique/check constraints; atomic link replay/expiry; safe redirects; outbox atomicity/retry/lease recovery/multiple subscriptions and manual fallback.
- Real browser: upload JPEG/PNG/WebP, HEIC on supported and unsupported browser, refresh persistence, reject/resubmit/approve on separate disposable invoices; Push permission allow/deny, session-expired notification click, recovery request, manager copy/open-chat/manual confirmation, new link exchange and destination return. Include mobile viewport and actual device Push checks; fixture-only tests do not prove notification delivery or Zalo sending.
- Backend tests one explicit file at a time on dedicated test DB, never destructive QA reset. Backend typecheck then relevant tests. Frontend typecheck → lint → build → unit tests → fixture E2E → real QA flow. Record coverage and remaining live-platform blockers; do not invent a passing result when browser/credentials unavailable.
- Migrations additive for motel codes/request/outbox fields and token hashes; update test reset TABLES. Deploy schema before new runtime. Enable worker only after VAPID/config and manager fallback UI are verified. Preserve existing ZNS history; no historical automatic resend. No production deployment without explicit approval.
- Rollback disables new worker and recovery entry points while retaining records and existing manager link issuance adapted to hashed tokens. Never restore plaintext-token requirement or discard pending tasks.

## Explicit exclusions

Session lifetime increase; automated Zalo browser scripting/sending; ZNS/ZBS/SMS integration; password accounts/passkeys; guaranteed native HEIC support; payment auto-reconciliation; unrelated portal redesign. Source edits and deployment belong to subsequent implementation, not this planning session.
