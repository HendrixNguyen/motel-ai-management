# Billing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver manager-scoped billing periods, conflict-safe meter readings, idempotent invoice generation, local VietQR payloads, and manual payment status changes for sub-project 3.

**Architecture:** Keep billing as a deep module whose public interface owns period lifecycle, reading synchronization, invoice generation, and payment state. It consumes narrow exported queries from the room and contract modules rather than importing their tables. Invoice arithmetic and VietQR encoding are pure modules; database mutations that create periods, accept reading batches, generate invoices, or change period state are transactional.

**Tech Stack:** Bun 1.4, strict TypeScript, ElysiaJS, Drizzle ORM, PostgreSQL 16, `bun:test`; no new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-motel-management-design.md`

## Global Constraints

- Bun only; do not use `npm`, `yarn`, or `npx`.
- Manager tenancy comes only from `manager_session`; cross-tenant access returns `404`, never `403`.
- VND crosses HTTP and arithmetic interfaces as digit strings and is stored as `numeric(14,0)`; JavaScript floating-point arithmetic is forbidden.
- Meter values cross HTTP as non-negative decimal strings with at most two fractional digits and are stored as `numeric(12,2)`.
- A fractional VND result is rounded to the nearest whole VND, with exact halves rounded up.
- `rooms.basePrice` is never read during billing; invoice rent comes only from an active contract's `monthlyRent`.
- Invoice money, prices, fees, renter, and readings are snapshots; later configuration changes never rewrite a sent invoice.
- VietQR payload generation is local and deterministic; it performs no network request and adds no third-party package.
- Stored meter `photoUrl` values are private R2 object keys. Until a signing adapter exists, no HTTP response may expose them as URLs or raw keys.
- A sent period is immutable for reading writes and invoice generation and returns `409 PERIOD_ALREADY_SENT`.
- Sub-project 3 changes period state to `sent`; Zalo delivery remains sub-project 8 and must not be represented as already delivered.
- User-facing messages are Vietnamese; stable codes are English and use the shared error envelope.
- Database test files run one at a time because `resetDb()` recreates shared schemas.

## Review Focus

- Two-decimal usage multiplied by a price that yields fractional VND must round half-up; Task 1 tests values immediately below, at, and above the half boundary.
- A stale reading retry with the already-stored value must succeed, while a stale different value returns the current server row; Task 5 tests both paths over HTTP.
- Invoice generation racing with period send must never write into a sent period; Tasks 6 and 7 lock and re-check the period inside their transactions.
- A motel or room name that exceeds VietQR's 25-character remark limit must retain the `T<month>/<year> P<room>` matching suffix; Task 2 tests normalization and truncation.
- Re-running generation must update the same draft invoice without changing its id or creating duplicates; Task 6 tests row identity, count, and refreshed snapshots.

---

## File Structure

- Create `backend/src/modules/billing/billing.types.ts` — all billing inputs and HTTP response types.
- Create `backend/src/modules/billing/billing.calculation.ts` — pure fixed-point meter parsing and invoice arithmetic.
- Create `backend/src/modules/billing/billing.route.ts` — manager billing HTTP interface and Elysia validation.
- Expand `backend/src/modules/billing/billing.service.ts` — tenant-scoped period, reading, invoice, and payment workflows.
- Create `backend/src/modules/vietqr/vietqr.types.ts` — the local encoder input type.
- Create `backend/src/modules/vietqr/vietqr.service.ts` — EMVCo/NAPAS TLV and CRC-16/CCITT-FALSE encoding.
- Modify `backend/src/modules/room/room.service.ts` — export the narrow room projection billing consumes.
- Modify `backend/src/modules/contract/contract.service.ts` — export active billable contract snapshots.
- Modify `backend/src/shared/errors.ts` — named constructors for existing billing conflict codes.
- Modify `backend/src/app.ts` — mount billing routes.
- Create focused tests under `backend/src/test/` for calculation, VietQR, periods, readings, invoices, payment state, and isolation.
- Reconcile the billing rule in the design spec, API contract, and testing strategy.

### Task 1: Fixed-point billing arithmetic and explicit conflict errors

**Files:**
- Create: `backend/src/modules/billing/billing.calculation.ts`
- Create: `backend/src/test/billing-calculation.test.ts`
- Modify: `backend/src/shared/errors.ts`
- Modify: `docs/superpowers/specs/2026-10-03-motel-management-design.md`
- Modify: `docs/testing-strategy.md`

**Interfaces:**
- Consumes: `parseAmount(input: string): string` and `sumVnd(...amounts: string[]): string` from `@/shared/money`.
- Produces: `parseMeterValue(input: string): bigint`, `formatMeterValue(hundredths: bigint): string`, `calculateUsage(previous: string, current: string): string`, `calculateUtilityCost(usage: string, unitPrice: string): VndString`, and `calculateInvoiceAmounts(input: InvoiceCalculationInput): InvoiceCalculation`.
- Produces: `AppError.readingConflict(server)` and `AppError.periodAlreadySent()` using the already-enumerated stable codes.

- [ ] **Step 1: Write failing pure tests for meter parsing and usage**

  In `billing-calculation.test.ts`, assert that `"0"`, `"12.3"`, and `"12.30"` normalize correctly; reject negatives, exponent notation, more than two decimals, and values beyond `numeric(12,2)`; assert `calculateUsage("100.25", "101.50") === "1.25"` and a backwards reading throws a Vietnamese `VALIDATION_ERROR`.

- [ ] **Step 2: Run the calculation test and verify RED**

  Run: `cd backend && bun test src/test/billing-calculation.test.ts`

  Expected: FAIL because `billing.calculation.ts` does not exist.

- [ ] **Step 3: Implement fixed-point meter parsing and usage**

  Parse meter strings into hundredths with string operations and `BigInt`; never convert them to `number`. Return canonical decimal strings without unnecessary trailing zeroes.

- [ ] **Step 4: Add failing tests for half-up utility rounding and invoice totals**

  Assert costs immediately below, exactly at, and immediately above half a VND; assert the exact-half case rounds up. Assert a complete calculation uses contract rent, both usage costs, and every fee, including totals above `Number.MAX_SAFE_INTEGER` when still inside `numeric(14,0)`.

- [ ] **Step 5: Implement invoice arithmetic and overflow checks**

  `InvoiceCalculationInput` contains previous/current readings, integer unit prices, contract rent, and fee amounts. Multiply hundredths by unit price as integers and calculate `(product + 50n) / 100n`; pass every resulting VND amount through the 14-digit bound before returning it.

- [ ] **Step 6: Add named billing error constructors**

  Add `readingConflict(server: Record<string, unknown>)` and `periodAlreadySent()` to `AppError`, with Vietnamese messages and the existing `READING_CONFLICT` and `PERIOD_ALREADY_SENT` codes.

- [ ] **Step 7: Record the rounding rule in owning documentation**

  Add half-up-to-whole-VND to the design spec's billing calculation and add below/half/above coverage to `docs/testing-strategy.md`. Do not duplicate implementation detail in the API contract.

- [ ] **Step 8: Verify and commit**

  Run: `cd backend && bun test src/test/billing-calculation.test.ts && bun run typecheck`

  Expected: all calculation tests PASS and typecheck exits 0.

  Commit: `feat(backend): add exact billing arithmetic`

### Task 2: Local VietQR payload encoder

**Files:**
- Create: `backend/src/modules/vietqr/vietqr.types.ts`
- Create: `backend/src/modules/vietqr/vietqr.service.ts`
- Create: `backend/src/test/vietqr.test.ts`

**Interfaces:**
- Consumes: a six-digit NAPAS bank BIN, a 6–19 character account number, a 1–13 digit amount, and the transfer description.
- Produces: `buildTransferDescription(input: { motelName: string; month: number; year: number; roomName: string }): string` and `buildVietQrPayload(input: VietQrInput): string`.

- [ ] **Step 1: Write the failing canonical payload test**

  Assert that bank BIN `970415`, account `113366668888`, amount `79000`, and remark `Ung Ho Quy Vac Xin` produce:

  ```text
  00020101021238560010A0000007270126000697041501121133666688880208QRIBFTTA53037045405790005802VN62220818Ung Ho Quy Vac Xin63043ACF
  ```

  Also assert the trailing CRC changes when any input changes.

- [ ] **Step 2: Run the VietQR test and verify RED**

  Run: `cd backend && bun test src/test/vietqr.test.ts`

  Expected: FAIL because the VietQR module does not exist.

- [ ] **Step 3: Implement the TLV encoder and CRC**

  Encode EMVCo tags `00=01`, `01=12`, merchant account `38` with GUID `A000000727`, beneficiary bank/account under `01`, service `QRIBFTTA`, currency `704`, amount `54`, country `VN`, remark under additional-data tag `62/08`, then CRC tag `6304`. Lengths are UTF-8 byte lengths. CRC is CRC-16/CCITT-FALSE (`poly=0x1021`, `init=0xFFFF`) over the payload including `6304`, emitted as four uppercase hex digits.

- [ ] **Step 4: Add failing validation and description tests**

  Reject malformed BIN, account number, amount, unsupported remark characters, and values longer than the published limits. Assert `buildTransferDescription` converts Vietnamese text to unaccented text, converts `đ/Đ`, strips unsupported punctuation, collapses whitespace, never exceeds 25 characters, and preserves the suffix `T10/2026 PP.101` by truncating the motel name first.

- [ ] **Step 5: Implement validation and deterministic description fitting**

  Compose `[normalized motel name] T<month>/<year> P<normalized room name>`; reserve space for the month/year/room suffix, then truncate the motel portion. If the suffix alone exceeds 25 characters, truncate the room name while preserving `T<month>/<year> P`.

- [ ] **Step 6: Verify and commit**

  Run: `cd backend && bun test src/test/vietqr.test.ts && bun run typecheck`

  Expected: all VietQR tests PASS and typecheck exits 0.

  Commit: `feat(backend): encode VietQR payloads locally`

### Task 3: Narrow room and contract interfaces for billing

**Files:**
- Modify: `backend/src/modules/room/room.service.ts`
- Modify: `backend/src/modules/contract/contract.service.ts`
- Create: `backend/src/test/billing-sources.test.ts`

**Interfaces:**
- Produces from room module: `listRoomsForBilling(motelId: string): Promise<BillingRoom[]>`, where `BillingRoom` is `{ id: string; name: string }`, ordered by room name then id.
- Produces from contract module: `listBillableContractsForMotel(motelId: string): Promise<BillableContract[]>`, where `BillableContract` is `{ id: string; roomId: string; renterId: string; monthlyRent: VndString }`, containing only `active` contracts and ordered by room id.
- Consumes later: Task 4 uses `listRoomsForBilling`; Task 6 uses both interfaces and never imports room or contract tables.

- [ ] **Step 1: Write failing integration tests for both projections**

  Seed two motels, rooms, and contracts. Assert each function returns only its motel's rows, excludes draft/expired/terminated contracts, serializes money as a string, and has deterministic ordering. Include a room whose `basePrice` differs from `monthlyRent` and assert the billable projection exposes only `monthlyRent`.

- [ ] **Step 2: Run the source-interface test and verify RED**

  Run: `cd backend && bun test src/test/billing-sources.test.ts`

  Expected: FAIL because both exports are missing.

- [ ] **Step 3: Implement the narrow exports in their owning modules**

  Select only the documented fields. Do not move billing behavior into either module and do not export either table.

- [ ] **Step 4: Verify and commit**

  Run: `cd backend && bun test src/test/billing-sources.test.ts && bun run typecheck`

  Expected: all source-interface tests PASS and typecheck exits 0.

  Commit: `feat(backend): expose billing source snapshots`

### Task 4: Billing periods and seeded readings

**Files:**
- Create: `backend/src/modules/billing/billing.types.ts`
- Create: `backend/src/modules/billing/billing.route.ts`
- Expand: `backend/src/modules/billing/billing.service.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/src/test/billing-period.test.ts`

**Interfaces:**
- Produces: `listBillingPeriods(motelId, managerId): Promise<BillingPeriodResponse[]>`, `createBillingPeriod(motelId, managerId, input): Promise<BillingPeriodDetailResponse>`, and `getBillingPeriod(periodId, motelId, managerId): Promise<BillingPeriodDetailResponse>`.
- HTTP: `GET/POST /api/manager/motels/:motelId/billing/periods` and `GET /api/manager/motels/:motelId/billing/periods/:periodId`.
- `BillingPeriodResponse` is `{ id, motelId, month, year, status, createdAt }`; `createdAt` is ISO UTC.
- `MeterReadingResponse` is `{ id, roomId, type, previousReading, currentReading, readingDate, updatedAt }`; numeric values are strings, dates are `YYYY-MM-DD | null`, and timestamps are ISO UTC.
- `BillingPeriodDetailResponse` is the period response plus `rooms: Array<{ id, name, readings: MeterReadingResponse[] }>`; it omits the stored private photo object key until a later R2 signing adapter can supply a short-lived URL.

- [ ] **Step 1: Write failing HTTP tests for create, list, and detail**

  Assert manager auth is required; creation returns `201`; list is newest year/month first with id as tie-breaker; detail orders rooms by name then id and meter types electric then water; timestamps are ISO UTC and numeric readings are strings.

- [ ] **Step 2: Add failing seeding tests**

  Assert creation seeds two readings per room in one transaction. For a later period, copy the latest chronologically prior `currentReading` of each room/type; use `"0.00"` when none exists or the prior reading is null. A future-created period must never seed an earlier period.

- [ ] **Step 3: Add failing duplicate and tenancy tests**

  Assert duplicate `(motelId, month, year)` returns Vietnamese `409 CONFLICT`; invalid month/year and malformed UUIDs return `400`; another manager receives `404` for list, create, and detail in both isolation directions.

- [ ] **Step 4: Run the period test and verify RED**

  Run: `cd backend && bun test src/test/billing-period.test.ts`

  Expected: FAIL because routes and workflows are missing.

- [ ] **Step 5: Implement period workflows transactionally**

  Resolve motel ownership before reads. During create, insert the period and all seeded reading rows inside one transaction; translate only `billing_periods_motel_month_year_uq` violations to the duplicate-period conflict.

- [ ] **Step 6: Implement and mount validated routes**

  Derive status schemas from Drizzle enum values, constrain month to 1–12, constrain year to PostgreSQL `integer`, validate every UUID at the router, and mount `billingRoutes` in `createApp()`.

- [ ] **Step 7: Verify and commit**

  Run: `cd backend && bun test src/test/billing-period.test.ts && bun run typecheck`

  Expected: all period tests PASS and typecheck exits 0.

  Commit: `feat(backend): add billing period lifecycle`

### Task 5: Conflict-safe batch meter readings

**Files:**
- Modify: `backend/src/modules/billing/billing.types.ts`
- Modify: `backend/src/modules/billing/billing.route.ts`
- Modify: `backend/src/modules/billing/billing.service.ts`
- Create: `backend/src/test/billing-reading.test.ts`

**Interfaces:**
- Produces: `updateMeterReadings(periodId, motelId, managerId, input: UpdateReadingsInput): Promise<MeterReadingResponse[]>`.
- HTTP: `PUT /api/manager/motels/:motelId/billing/periods/:periodId/readings` with `{ readings: Array<{ roomId, type, currentReading, photoUrl?, expectedUpdatedAt }> }`.
- Failure is atomic: any invalid, foreign, missing, or conflicting row rolls back the complete batch.

- [x] **Step 1: Write failing HTTP tests for accepted batches**

  Assert a batch updates current reading, optional object key, reading date, and `updatedAt`; rejects duplicate room/type entries in the same request; returns readings in request order; and never writes a reading belonging to another period or motel.

- [ ] **Step 2: Write failing validation and state tests**

  Assert malformed decimals, negative values, more than two decimals, `current < previous`, invalid UUID/timestamp/type, and an empty batch return `400`. Assert a sent or closed period returns `409 PERIOD_ALREADY_SENT` without changing any row.

- [ ] **Step 3: Write failing optimistic-concurrency tests**

  Assert matching `expectedUpdatedAt` accepts and bumps the timestamp. Assert stale timestamp plus identical current value is accepted and bumps it. Assert stale timestamp plus a different value returns `409 READING_CONFLICT` with `details.server` containing the current serialized row but no private photo object key, while every other row in the submitted batch remains unchanged.

- [ ] **Step 4: Run the reading test and verify RED**

  Run: `cd backend && bun test src/test/billing-reading.test.ts`

  Expected: FAIL because the endpoint is missing.

- [ ] **Step 5: Implement the transactional compare-and-update workflow**

  Resolve the owned draft period, lock submitted rows with `FOR UPDATE`, validate row membership before mutations, compare timestamps at millisecond precision, accept equal-value retries, then apply the whole batch. Advance `updatedAt` monotonically with a database expression even when two writes land in the same millisecond. Store `photoUrl` exactly as an object key, but omit it from responses; do not create signed URLs in this sub-project.

- [ ] **Step 6: Add route validation**

  Use schema enum values for meter type, ISO timestamp validation, UUID validation, and string-only meter values. Do not accept `motelId`, `periodId`, `previousReading`, or `updatedAt` from the body as writable fields.

- [ ] **Step 7: Verify and commit**

  Run: `cd backend && bun test src/test/billing-reading.test.ts && bun run typecheck`

  Expected: all reading tests PASS and typecheck exits 0.

  Commit: `feat(backend): synchronize meter readings safely`

### Task 6: Idempotent invoice generation

**Files:**
- Modify: `backend/src/modules/billing/billing.types.ts`
- Modify: `backend/src/modules/billing/billing.route.ts`
- Modify: `backend/src/modules/billing/billing.service.ts`
- Create: `backend/src/test/billing-invoice.test.ts`

**Interfaces:**
- Consumes: arithmetic from Task 1, VietQR from Task 2, billing sources from Task 3, and the owned motel configuration.
- Produces: `generateInvoices(periodId, motelId, managerId): Promise<InvoiceGenerationResponse>` and `listInvoices(periodId, motelId, managerId): Promise<InvoiceResponse[]>`.
- HTTP: `POST/GET /api/manager/motels/:motelId/billing/periods/:periodId/invoices`.
- `InvoiceResponse` contains every invoice schema field plus `roomName`; money and usage fields are strings, `paidAt` is ISO UTC or null, and `createdAt` is ISO UTC.
- `InvoiceGenerationResponse` is `{ invoices: InvoiceResponse[]; details: { skippedRooms: Array<{ id: string; name: string }> } }`.

- [ ] **Step 1: Write failing calculation-through-HTTP tests**

  Seed an active contract whose `monthlyRent` differs from room `basePrice`. Assert the invoice uses contract rent, reading deltas, half-up costs, a fee snapshot, exact total, correct renter/room/motel ids, and a non-null VietQR payload whose remark follows `[motelName] T[month]/[year] P[roomName]` after normalization.

- [ ] **Step 2: Write failing completeness and configuration tests**

  Assert a billable room missing either current reading causes `409 CONFLICT` before any invoice is written. Assert missing or invalid bank BIN/account configuration causes `409 CONFLICT` before any invoice is written. Assert rooms without active contracts are skipped and returned in `details.skippedRooms`, never partially invoiced.

- [ ] **Step 3: Write failing idempotency and snapshot tests**

  Generate twice after changing draft readings, prices, or fees. Assert the second generation updates the existing draft row, preserves its id, leaves exactly one invoice per period/room, and refreshes every snapshot. Assert a sent period returns `409 PERIOD_ALREADY_SENT` and preserves invoices unchanged.

- [ ] **Step 4: Write failing list and isolation tests**

  Assert list ordering is room name then invoice id, all money fields are strings, timestamps are ISO UTC, and foreign motel/period combinations return `404` in both tenant directions.

- [ ] **Step 5: Run the invoice test and verify RED**

  Run: `cd backend && bun test src/test/billing-invoice.test.ts`

  Expected: FAIL because generation and list endpoints are missing.

- [ ] **Step 6: Implement generation as one transaction**

  Lock and re-check the owned period as `draft`; load room and active-contract snapshots through their module interfaces; load both readings from billing-owned tables; validate all billable inputs before the first invoice write; calculate and upsert on `(billingPeriodId, roomId)`. Do not import room or contract tables into the billing module.

- [ ] **Step 7: Implement invoice serialization and routes**

  Serialize numeric values as strings and timestamps as ISO UTC. Reject writable financial fields at the edge by giving generation no body.

- [ ] **Step 8: Verify and commit**

  Run: `cd backend && bun test src/test/billing-invoice.test.ts && bun run typecheck`

  Expected: all invoice tests PASS and typecheck exits 0.

  Commit: `feat(backend): generate idempotent invoices`

### Task 7: Period send and manual payment status

**Files:**
- Modify: `backend/src/modules/billing/billing.types.ts`
- Modify: `backend/src/modules/billing/billing.route.ts`
- Modify: `backend/src/modules/billing/billing.service.ts`
- Create: `backend/src/test/billing-payment.test.ts`

**Interfaces:**
- Produces: `sendBillingPeriod(periodId, motelId, managerId): Promise<BillingPeriodResponse>`, `markInvoicePaid(invoiceId, motelId, managerId): Promise<InvoiceResponse>`, and `markInvoiceOverdue(invoiceId, motelId, managerId): Promise<InvoiceResponse>`.
- HTTP: `POST .../periods/:periodId/send`, `PATCH .../billing/invoices/:invoiceId/paid`, and `PATCH .../billing/invoices/:invoiceId/overdue`.

- [ ] **Step 1: Write failing send-state tests**

  Assert a draft period with at least one generated invoice becomes `sent`; a period without invoices returns `409 CONFLICT`; repeated send and send from `closed` return `409 PERIOD_ALREADY_SENT`; and readings/generation are rejected after send. Assert the response does not claim Zalo delivery.

- [ ] **Step 2: Write failing payment-transition tests**

  Assert paid sets `paymentStatus="paid"` and an ISO `paidAt`; repeating paid is idempotent and preserves the original timestamp. Assert overdue sets `paymentStatus="overdue"` and clears no existing financial snapshot. A paid invoice cannot be marked overdue and returns `409 CONFLICT`.

- [ ] **Step 3: Write failing payment isolation tests**

  Assert an invoice outside the path motel, including a real invoice owned by another manager, returns `404` for both transitions in both tenant directions.

- [ ] **Step 4: Run the payment test and verify RED**

  Run: `cd backend && bun test src/test/billing-payment.test.ts`

  Expected: FAIL because state-transition endpoints are missing.

- [ ] **Step 5: Implement transactional state transitions**

  Lock the period or invoice row before checking state. Sending changes only billing state; do not introduce a fake adapter or notification side effect now.

- [ ] **Step 6: Implement routes and verify**

  Run: `cd backend && bun test src/test/billing-payment.test.ts && bun run typecheck`

  Expected: all payment tests PASS and typecheck exits 0.

  Commit: `feat(backend): add billing and payment transitions`

### Task 8: Cross-tenant matrix, contract reconciliation, and release gate

**Files:**
- Create: `backend/src/test/billing-isolation.test.ts`
- Modify: `docs/api-contract.md`
- Modify: `docs/testing-strategy.md`
- Modify: `docs/frontend-ui-specs.md`

**Interfaces:**
- Consumes: every billing HTTP endpoint from Tasks 4–7.
- Produces: a reconciled public contract and verification evidence for sub-project 3.

- [ ] **Step 1: Write the complete HTTP isolation matrix**

  For two managers with real foreign ids, exercise list/create/detail periods, readings, generate/list invoices, send, paid, and overdue in both directions. Assert every denial is `404` and no denial returns `403`.

- [ ] **Step 2: Run the complete isolation matrix**

  Run: `cd backend && bun test src/test/billing-isolation.test.ts`

  Expected: every request returns `404` with code `NOT_FOUND`. The endpoint-specific isolation tests written in Tasks 4–7 supplied the RED phase; this matrix is the cross-endpoint release gate.

- [ ] **Step 3: Fix only isolation defects demonstrated by Step 2**

  All resource lookups must constrain both resource id and owned motel; never fetch globally and reveal existence before authorization.

- [ ] **Step 4: Reconcile documentation**

  Make `docs/api-contract.md` match exact request and response bodies, successful `skippedRooms`, atomic batch behavior, idempotent payment transitions, and the sub-project-8 notification deferral. Ensure status/error codes remain identical across the design spec, UI badge table, API contract, and `errors.ts`.

- [ ] **Step 5: Run backend verification sequentially**

  First confirm no other `bun test` process is running. Then run:

  ```bash
  cd backend
  bun run typecheck
  bun test src/test/billing-calculation.test.ts
  bun test src/test/vietqr.test.ts
  bun test src/test/billing-sources.test.ts
  bun test src/test/billing-period.test.ts
  bun test src/test/billing-reading.test.ts
  bun test src/test/billing-invoice.test.ts
  bun test src/test/billing-payment.test.ts
  bun test src/test/billing-isolation.test.ts
  ```

  Expected: typecheck exits 0 and every file reports zero failures. Do not run database test files concurrently.

- [ ] **Step 6: Run regression files sequentially**

  Run each existing `backend/src/test/*.test.ts` file explicitly, one process at a time. Expected: zero failures. If PostgreSQL returns `ECONNREFUSED`, report verification blocked; never describe it as passing.

- [ ] **Step 7: Run both read-only review gates on uncommitted changes**

  Run `/review-security` and `/review-code` before the final commit. Resolve every applicable auth, tenancy, money, spec, typing, test, or documentation finding and rerun the affected test file.

- [ ] **Step 8: Commit the reconciliation**

  Commit: `docs: reconcile billing contract and verification`

## Execution Baseline

- Local `qa` was created from current `main` at `68da062` on 2026-10-06.
- `qa` and `main` are identical at plan time. Both contain the complete sub-project 2 history; local `feat/room-renter-plan` is their direct parent at `54b985c`.
- Begin execution in an isolated worktree on a new feature branch created from `qa`; do not implement directly on `qa`.
- The Dockerfiles, repaired seed, AGENTS guidance, and QA topology documents are committed in the baseline and are not part of sub-project 3.
