# Full-Flow Verification Plan

- **Date:** 2026-10-08
- **Status:** Task 9 delivery gate
- **Owner:** QA/engineering
- **Scope:** Complete manager, capture, billing, renter portal, contract, upload, and Zalo flows

## Exit rule

Release is green only when all required backend files, frontend unit tests, fixture E2E, security checks, and deployment smoke checks pass. A skipped provider test is not green; it is `blocked` with a recorded reason. Never run schema-reset backend files concurrently.

## Test environments

| Environment | Purpose | Data |
|---|---|---|
| Local PostgreSQL | Backend integration and constraints | Disposable `TEST_DATABASE_URL`; reset before each file |
| Fixture browser | Deterministic UI and mobile flows | Mock API + fixture backend server |
| Real stack | Deployment smoke and cross-service flow | QA Dokploy, gated by `E2E_REAL=1` |
| Provider sandbox | Zalo/R2 contract checks | Explicit credentials only; no production sends |

## Seed personas

- Manager A owns Motel A.
- Manager B owns Motel B.
- Renter A belongs to Motel A and Room A-101.
- Renter B belongs to Motel B and Room B-101.
- One draft contract, one active contract, one expired contract.
- One draft billing period, one sent period, one invoice per payment state.
- Zalo follower and non-follower renter states.

## Required full flow

### Flow 1 — Manager onboarding and motel setup

1. Register manager with valid credentials.
2. Login; verify httpOnly manager cookie and `/auth/me`.
3. Create motel with VND prices, fees, and bank account.
4. Create rooms; assign renter; verify room occupancy and renter list.
5. Refresh and switch motel through `?motel=`.
6. Attempt Motel B resources using Manager A; every response is `404` with no data leak.
7. Logout; verify protected routes reject access.

### Flow 2 — Contract lifecycle

1. Create template and clauses.
2. Mark default; replace default; verify only one default.
3. Create draft contract using default template and room rent.
4. Patch draft dates, rent, deposit, and clauses.
5. Verify renter/room/template from another motel returns `404`.
6. Send contract with fake notification adapter; success stamps send metadata.
7. Notification failure leaves contract draft and returns `EXTERNAL_SERVICE_ERROR`.
8. Terminate active contract; reject draft/expired termination.
9. Paper-signature path: upload valid proof, reject invalid signature/MIME/size/count, activate with past/current date, reject future date, deny mutation after activation, authorize signed reads only for owner.

### Flow 3 — Billing and capture

1. Create draft period; verify meter rows seeded.
2. Enter readings through manager UI/API with exact decimal strings.
3. Upload meter photo; verify private metadata and signed read authorization.
4. Reload capture page offline; verify IndexedDB queue survives.
5. Reconnect; sync queue and verify readings update atomically.
6. Submit stale `expectedUpdatedAt`; verify `READING_CONFLICT` and server row details.
7. Submit lower-than-previous reading; reject without partial writes.
8. Generate invoices; verify rent, utility math, fees, VND strings, and QR payload.
9. Re-run generation; verify stable invoice IDs and payment state.
10. Chốt kỳ; verify sent period/readings are read-only and no Zalo claim appears.
11. Mark paid/overdue; verify idempotency and immutable invoice amounts.

### Flow 4 — Renter magic link and portal

1. Manager issues magic link.
2. Exchange once; verify renter session cookie and token consumption.
3. Reuse token; reject with `MAGIC_LINK_EXPIRED`.
4. Expired token/session; show safe recovery and resend state.
5. Renter sees only own profile, room, contract, periods, invoices, QR, and payment status.
6. Renter B requests Renter A invoice/contract/ticket; response is `404` or empty scoped result per endpoint contract.
7. Renter cannot mark invoice paid or access manager notes/object keys.
8. Responsive checks at 375px and keyboard-only navigation.

### Flow 5 — OTP signing

1. Request OTP through configured fake Zalo sender.
2. Verify response never contains OTP.
3. Confirm database stores hash only.
4. Reject wrong OTP and persist attempts.
5. Reject after three failed attempts with `OTP_INVALID`.
6. Reject expired OTP with `OTP_EXPIRED`.
7. Enforce resend cooldown.
8. Verify correct OTP activates exactly one contract under concurrent requests.
9. Provider failure leaves contract draft and does not expose provider detail.

### Flow 6 — Help tickets

1. Renter creates ticket with valid category and description.
2. Upload 0–5 valid private images; reject sixth, oversized, wrong MIME, and bad magic bytes.
3. List own tickets; verify manager-only note is absent.
4. Cross-renter read returns `404`/empty scoped result.
5. Ticket creation remains available when Zalo delivery fails; notification failure is auditable.

### Flow 7 — Zalo integration

1. Receive valid signed follow webhook; map verified OA ID to renter.
2. Repeat webhook; verify idempotent state and no duplicate event.
3. Invalid signature, unknown event, malformed payload; reject safely.
4. Unfollow; clear follower state without changing renter identity.
5. Send OA message to follower; persist event/provider ID/status.
6. Non-follower uses approved ZNS fallback.
7. Transient provider error retries with bounded attempts/backoff.
8. Permanent recipient/template error does not retry forever.
9. Duplicate event key sends once.
10. Logs and database contain no OTP plaintext, access token, signed URL, or secret.

## Backend test matrix

| File group | Required assertions |
|---|---|
| Schema constraints | Every FK, unique, check, partial unique, upload count/size, retry bounds |
| Auth | Register/login/logout, wrong password, rate limits, cookie expiry |
| Tenancy | Manager and renter isolation over `app.handle(new Request(...))` |
| Billing | Atomic batch, conflicts, sent lock, idempotent invoices, payment transitions |
| Capture | Upload authorization, private key metadata, signed URL TTL, sync replay |
| Contracts | Template default, draft lifecycle, OTP, paper proof, active-room race |
| Renter | Magic-link replay/expiry, invoice/contract/ticket scope, response redaction |
| Zalo | Signature, follower mapping, dedupe, retry classification, audit state |
| Failure paths | R2 outage, Zalo outage, malformed payload, network retry, partial upload |

Run each explicit file sequentially:

```bash
cd backend
bun run typecheck
bun test src/test/schema-constraints.test.ts
bun test src/test/manager-auth.test.ts
bun test src/test/tenancy.test.ts
bun test src/test/renter-auth.test.ts
bun test src/test/isolation.test.ts
bun test src/test/cross-tenant-isolation-2.test.ts
bun test src/test/billing-period.test.ts
bun test src/test/billing-reading.test.ts
bun test src/test/billing-calculation.test.ts
bun test src/test/billing-invoice.test.ts
bun test src/test/billing-payment.test.ts
bun test src/test/contract-template.test.ts
bun test src/test/contract.test.ts
bun test src/test/contract-signing.test.ts
bun test src/test/upload.test.ts
bun test src/test/renter-portal.test.ts
bun test src/test/ticket.test.ts
bun test src/test/zalo.test.ts
bun test src/test/notification.test.ts
bun test src/test/notification-integration.test.ts
```

Use actual filenames after implementation; missing required test file blocks completion.

## Frontend test matrix

### Vitest

- API response/error decoding, money and decimal guards.
- Offline queue state machine: enqueue, reload, retry, conflict, sent-period lock.
- Upload validation and safe URL handling.
- Magic-link, OTP, invoice, ticket, and Zalo failure state models.
- Route selection, session guard, motel scope, responsive semantic markup.

### Playwright fixture suite

Add:

- `e2e/capture.spec.ts`: offline entry, reload persistence, reconnect sync, conflict.
- `e2e/renter-portal.spec.ts`: exchange, invoice QR, contract OTP, ticket form, expiry.
- `e2e/zalo-failure.spec.ts`: disabled/deferred states, retry/error banners, no secret text.
- `e2e/full-flow.spec.ts`: manager setup → billing → renter portal fixture journey.

Run:

```bash
cd frontend
bun run typecheck
bun run lint
bun run build
bun run test
bun run test:e2e
```

Real stack only after local gates:

```bash
E2E_REAL=1 bun run test:e2e
```

## Security gates

- Run `/review-security` for auth, tenancy, uploads, signed URLs, webhooks, OTP, logs.
- Run `/review-code` for module boundaries, API/docs drift, and test integrity.
- Search artifacts/logs for secrets, OTP plaintext, R2 object keys, provider tokens.
- Confirm no authenticated API response enters service-worker cache.

## Deployment smoke

1. Verify Dokploy health and QA services.
2. Apply migrations and inspect migration status.
3. Confirm private R2 access with fake/public URL negative test.
4. Confirm webhook endpoint rejects unsigned requests.
5. Run manager → billing → renter portal smoke with QA fixtures.
6. Verify notification failure does not corrupt domain state.
7. Verify rollback/redeploy path and health endpoint.

## Evidence record

For every gate record command, timestamp, commit SHA, pass/fail count, environment, and blocker. Do not call a blocked browser or provider test passed. Attach failure logs without credentials.
