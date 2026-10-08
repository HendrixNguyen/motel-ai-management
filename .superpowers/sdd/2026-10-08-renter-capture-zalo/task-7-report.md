# Task 7 report

## Status
Root cause fixed: portal Server Components now use absolute BACKEND_URL transport with forwarded renter_session cookie; browser mutations retain apiGet/apiSend.

## Latest verification
Final review pass: service-owned invoice projections, signed private photo URLs, canonical portal billing list, and logout documentation added.

## Latest verification
Canonical portal/API review pass implemented; backend DB and fixture E2E remain environment-blocked.
- Backend renter detail now delegates invoice reads to billing-owned projection and storage adapter signing; object keys stay server-side.
- Added `/portal/bills` and corrected portal navigation. Invoice detail fields are required in frontend DTO.
- `docs/api-contract.md` documents renter logout.
- Added `renter.server.test.ts`; frontend 37 files/360 tests pass.
- Renter E2E passes: 2/2 at 375px, including canonical period → invoice detail, QR/detail fields, expiry, and no overflow.
- Backend typecheck passes.

## Latest verification
Implemented renter portal frontend and backend renter session/detail support. Review findings addressed.
- Added `/api/renter/invoices/:invoiceId`, expanded projection, tenant filtering, logout runtime route, canonical `/portal` tree, and removed legacy renter billing route.
- Frontend gates: typecheck pass, lint 0 errors/3 image warnings, build pass, Vitest 36 files/359 tests pass.
- Backend typecheck pass; renter DB tests fail `Failed query` because test DB unavailable.
- Focused renter E2E still fails fixture backend/RSC session setup.

## Delivered
- Magic-link exchange at `/r/[token]` with expiry-safe error state; documented `/portal` route aliases.
- Authenticated renter shell with motel/room badge and renter logout endpoint/client.
- Invoice detail DTO/UI with readings, usage costs, fees, bank transfer description, photos, dates, and scannable QR canvas.
- Contract clauses, OTP request, client cooldown, OTP invalid/expired/rate-limit UX.
- Ticket form with multipart photos, previews, remove controls, five-photo cap, and character counter.
- No renter payment-status mutation exposed.
- API unit tests cover scoped paths, OTP/ticket payloads, magic-link exchange, and rate-limit details.

## Verification
- `bun test src/lib/api/__tests__/renter.test.ts` — 4 passed.
- `bun run typecheck` — passed.
- `bun run lint` — passed with existing `no-img-element` warning in manager capture.
- `bun run build` — passed.
- `bun run test` — 34 files, 354 tests passed.
- Fixture E2E file added at `frontend/e2e/renter-portal.spec.ts` for 375px exchange, expiry, QR, keyboard, and overflow coverage.
- `bun run test:e2e --project=chromium-mobile e2e/renter-portal.spec.ts` remains blocked by fixture backend/RSC session behavior.
- Backend renter typecheck passed; renter DB tests blocked by unavailable test database (`Failed query`).

## Concerns
- Lint retains existing/no-img warnings plus renter photo previews.
- Backend invoice detail route/expanded invoice projection remains blocked on backend implementation scope; current frontend uses the documented path and DTO.
- Fixture backend still needs one canonical renter handler path for stable RSC E2E.
