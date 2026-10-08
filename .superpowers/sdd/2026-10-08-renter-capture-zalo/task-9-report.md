# Task 9 Findings Report

Final reviewed SHA: `fb6db2ba0289f6675580d1009e6101fe2ec0dbba`.

Commit timestamp: `2026-10-08T07:40:48Z`.
Final post-commit evidence: `2026-10-08T07:40:00Z`, command `cd frontend && bun run test:e2e`, PASS `76/76` tests. Frontend typecheck/build/unit gates PASS; lint 0 errors with 4 existing image warnings. Expected fixture stderr contains sanitized Next `ApiError` diagnostics from intentional error-path tests; no secrets.

- Date: 2026-10-08
- Status: frontend coverage added; backend DB integration remains blocked

## Evidence record

| Timestamp (UTC) | SHA | Environment | Command | Result / counts | Sanitized blocker output |
|---|---|---|---|---|---|
| 2026-10-08T07:40:00Z | `fb6db2ba0289f6675580d1009e6101fe2ec0dbba` | local frontend, Chromium fixture project | `cd frontend && bun run test:e2e` | PASS: 76/76 tests | — |
| 2026-10-08T06:49:00Z | `8c34423` | local Bun 1.4.2, configured TEST_DATABASE_URL | `bun test src/test/schema-constraints.test.ts` | BLOCKED | `error: Failed query:`; actionable cause: verify disposable PostgreSQL is running, inspect `TEST_DATABASE_URL` host/database/credentials without printing secrets, then rerun |

## Changes

- Added `frontend/e2e/zalo-failure.spec.ts` for provider-safe errors and retry.
- Added `frontend/e2e/full-flow.spec.ts` for capture → renter portal and expiry recovery.
- Added `frontend/e2e/capture-delivery.spec.ts` for queue persistence/reconnect, conflict, and sent lock.
- Corrected `RENTER_PORTAL_URL` vs `FRONTEND_URL` authority in API/ADR docs.
- Marked old renter resend plan superseded in API contract.
- Aligned ticket validation boundary, storage failure semantics, and best-effort Zalo delivery.
- Classified unknown OA mapping as sanitized `500 INTERNAL_ERROR` with dedupe rollback/retry.

## Concerns

- Backend DB integration remains blocked by disposable PostgreSQL query failure; no backend integration pass is claimed.
- Existing frontend lint warnings remain non-blocking.
