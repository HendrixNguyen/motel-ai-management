# Task 9 Findings Report

Final fix commit under E2E: `48bd4ad979005e0a0ed2ea3a592d793b01f3c9ed`.

Final post-commit evidence: `2026-10-08T07:24Z`, command `cd frontend && bun run test:e2e`, result PASS `76/76` tests. Frontend typecheck/build/unit gates PASS; lint 0 errors with 4 existing image warnings. Expected fixture stderr includes sanitized Next `ApiError` diagnostics from intentional error-path tests; no secrets.

- Date: 2026-10-08
- Status: frontend coverage added; backend DB integration remains blocked

## Evidence record

| Timestamp (UTC) | SHA | Environment | Command | Result / counts | Sanitized blocker output |
|---|---|---|---|---|---|
| 2026-10-08T06:35Z | `8c34423` | local Bun 1.4.2, PostgreSQL integration target | `cd backend && bun run typecheck` | PASS | — |
| 2026-10-08T06:35Z | `8c34423` | local Bun 1.4.2, configured TEST_DATABASE_URL | explicit backend integration sequence | BLOCKED | `error: Failed query:` repeated; actionable cause: inspect/restart disposable PostgreSQL and verify `TEST_DATABASE_URL` connectivity, then rerun files sequentially |
| 2026-10-08T06:35Z | `8c34423` | local frontend, Chromium fixture project | `bun run typecheck && bun run lint && bun run build && bun run test` | PASS: 360 unit tests; lint 0 errors, 4 image warnings | — |
| 2026-10-08T06:49Z | working tree before commit | local frontend, Chromium fixture project | `bun run typecheck && bun run lint && bun run build && bun run test && bun run test:e2e` | PASS: 360 unit tests; 76 E2E; build/typecheck pass; lint 0 errors, 4 image warnings | — |
| 2026-10-08T06:49Z | working tree before commit | local Bun 1.4.2, configured TEST_DATABASE_URL | `bun test src/test/schema-constraints.test.ts` | BLOCKED | `error: Failed query:`; actionable cause: verify disposable PostgreSQL is running, inspect `TEST_DATABASE_URL` host/database/credentials without printing secrets, then rerun |
| 2026-10-08T06:35Z | `8c34423` | local frontend, Chromium fixture project | `bun run test:e2e` | PASS: 75 tests | — |
| 2026-10-08T06:40Z | working tree before commit | local frontend, Chromium fixture project | new E2E files | initial failures exposed auth redirect and ambiguous alert locator; fixes applied | no secrets; failures were `ERR_TOO_MANY_REDIRECTS` and strict alert selection |

## Changes

- Added `frontend/e2e/zalo-failure.spec.ts` for provider-safe errors and retry.
- Added `frontend/e2e/full-flow.spec.ts` for capture → renter portal and expiry recovery.
- Added `frontend/e2e/capture-delivery.spec.ts` for queue persistence/reconnect, conflict, and sent lock.
- Corrected `RENTER_PORTAL_URL` vs `FRONTEND_URL` authority in API/ADR docs.
- Marked old renter resend plan superseded in API contract.
- Aligned ticket validation boundary, storage failure semantics, and best-effort Zalo delivery.
- Classified unknown OA mapping as sanitized `500 INTERNAL_ERROR` with dedupe rollback/retry.

## Concerns

1. New E2E files need one final full-suite run after current edits; failures above were captured before final selector/session corrections.
2. Backend DB tests remain blocked by disposable PostgreSQL query failure; no claim of backend integration pass.
3. Existing frontend lint warnings remain non-blocking.
