# QA Core Flow Completion Plan

**Date:** 2026-10-12
**Status:** Manager→renter UI flow verified; invoice generation blocked by missing test data (CCCD + contract)
**Branch:** `qa` (worktree: `.worktrees/live-qa-core-flow-impl`)

## Verified (2026-10-12 live session)

| Flow | Status |
|------|--------|
| Manager login (seed creds) | ✅ |
| Dashboard with quick actions | ✅ |
| Rooms CRUD + URL filters | ✅ |
| Renters list + detail + magic link | ✅ |
| Renter portal (magic link auth) | ✅ |
| Meter capture (4/4 rooms, 2/2 meters) | ✅ |
| Invoice generation API + UI | ✅ (returns 200, but all rooms skipped) |
| Portal: Bills / Tickets | ✅ |

## Blockers (test data only — code is correct)

1. **Invoice generation skips all rooms** — API returns:
   ```json
   {"invoices":[],"details":{"skippedRooms":[{"id":"3333...","name":"P.101"},...]}}
   ```
   Backend requires **CCCD + active contract** per renter (Vietnam law). Seed renters have neither.

2. **Portal contract page errors** — No contract exists for any renter.

## Plan

### 1. Add test data to unblock invoice generation
- For each seed renter in `backend/src/db/seed.ts`:
  - Add CCCD front/back image uploads (or mock records)
  - Create active contract with valid dates, rent, deposit
- Re-seed QA database: `cd backend && bun run db:seed` (or equivalent)
- Verify invoices generate for all 4 rooms

### 2. Complete payment flow test (QA)
- Generate invoices → verify amounts, VietQR payload
- Renter uploads payment proof (≤5 MB, valid image)
- Manager: approve / reject / cash-confirm branches
- Verify renter portal shows payment status transitions

### 3. Run local test gates (must pass before real QA)
```bash
# Backend
cd backend && bun run typecheck && bun test

# Frontend
cd frontend && bun run typecheck && bun run lint && bun run build && bun run test && bun run test:e2e
```

### 4. Run real QA E2E (requires runner env vars)
```bash
cd frontend
E2E_REAL=1 \
E2E_FRONTEND_URL=https://qa.motel.huyndg.io.vn \
BACKEND_URL=https://qa.motel.huyndg.io.vn/api \
E2E_LOGIN_EMAIL=manager@example.com \
E2E_LOGIN_PASSWORD=password \
E2E_QA_ENVIRONMENT=qa \
E2E_QA_ALLOWED_ORIGINS=https://qa.motel.huyndg.io.vn \
E2E_QA_MANAGER_ID=11111111-1111-1111-1111-111111111111 \
E2E_QA_MOTEL_ID=22222222-2222-2222-2222-222222222222 \
E2E_QA_MUTATIONS=1 \
bunx playwright test e2e/real/ --project=real-stack
```

### 5. Security & code review
- `/review-security` — auth, tenancy, uploads, money, webhooks
- `/review-code` — module boundaries, API/docs drift, test integrity

### 6. Commit & push
- Update `docs/full-flow-test-plan.md` with verified status
- Commit seed data fix + any test artifacts
- Push to `qa` branch

## Files to modify
- `backend/src/db/seed.ts` — add CCCD + contract to seed renters
- `docs/full-flow-test-plan.md` — mark completed flows, record evidence

## Evidence to record
- Command output for each gate (timestamp, commit SHA, pass/fail)
- API responses for invoice generation, payment proof, approval
- Screenshots of renter portal payment status transitions