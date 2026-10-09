# Renter payment PWA Tasks 5–6 execution report

Scope: requested local regression reruns and fixes only; no QA or production access, no environment edits.

## Initial evidence

- Verified `TEST_DATABASE_URL` targets `localhost:5432/motel_test`; URL credentials were not emitted.
- `renter-auth.test.ts`: 7 pass, 1 fail. Inactive renter magic-link exchange expected HTTP 401, received 200 (`renter-auth.test.ts:90`). URL assertion passed.
- `RENTER_PORTAL_URL` configured as `http://localhost:3000`; normalized trailing-slash form is identical. `issueMagicLink` constructs `${env.renterPortalUrl}/r/${token}` (`backend/src/shared/magic-link.ts:33`). No token/secret value recorded.
- `renter-portal.test.ts`: 3 pass, 2 fail. Relative Request URLs caused `TypeError: Failed to construct 'Request': Invalid URL` at invoice-detail line 106 and logout line 115. After those were fixed, foreign-invoice request line 109 showed same issue.

## Changes

- `backend/src/shared/magic-link.ts`: reject an issued link when linked renter is missing or inactive. This is backed by failing test and existing renter-auth middleware active-status rule.
- `backend/src/test/renter-portal.test.ts`: use `http://localhost` absolute URLs for invoice own/foreign requests and logout, as planned.
- `docs/superpowers/plans/2026-10-09-renter-payment-pwa.md`: record Task 5 not executed; record bounded Task 6 status and evidence.

## Verification

- `cd backend && bun test src/test/renter-auth.test.ts`: 8 pass, 0 fail, 15 expect calls.
- `cd backend && bun test src/test/renter-portal.test.ts`: 5 pass, 0 fail, 27 expect calls.

Task 5 implementation was not performed or claimed. Task 6's wider proof-read, push-subscription, and expired-link requirements remain unverified; only requested regression scope completed.
