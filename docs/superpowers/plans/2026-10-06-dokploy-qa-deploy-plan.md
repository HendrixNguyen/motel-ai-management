# Plan: Seed Data & Complete Core Backend

## Goal
Populate the QA and local databases with deterministic seed data so the team can demo and test without manual entry. Complete the remaining core-backend module stubs so sub-project 1 is fully executable.

## Current State

### Already in place
- Domain models: all 7 module schemas in `backend/src/modules/*/schema.ts`
- Enumerations: 10 pgEnum values defined
- Migration: `drizzle/0000_motionless_microchip.sql` creates all types, tables, FKs, indexes, and CHECK constraints
- Shared utilities: `money.ts`, `phone.ts`, `errors.ts`, `magic-link.ts`
- Middleware: `tenancy.ts`, `manager-auth.ts`, `renter-auth.ts`, `error-handler.ts`
- Services: auth, motel, room, renter, billing (partial), contract (partial)
- Routes: auth, magic-link, motel, room, renter
- Tests: 14 test files including constraint tests

### Gaps to close
1. **Seed data** — no script exists to bootstrap a motel, rooms, renters, contracts, periods, readings, invoices, templates, tickets
2. **Billing routes** — `billing.route.ts` missing
3. **Contract routes** — `contract.route.ts` missing
4. **Ticket routes** — `ticket.route.ts` missing
5. **Zalo module** — files don't exist at all (sub-project 8, can defer)
6. **VietQR module** — files don't exist at all (can defer to billing sub-project)

## Plan

### Task 1: Seed data script
Create `backend/src/db/seed.ts` that inserts a single deterministic motel with realistic data.

**Tables populated, in dependency order:**
1. `managers` — 1 manager (`manager@example.com` / `password`)
2. `motels` — 1 motel with realistic prices and a bank account
3. `rooms` — 4 rooms (`P.101`..`P.104`), different floors, mixed statuses
4. `renters` — 3 renters, 2 assigned to rooms, 1 unassigned; 1 OA follower, 1 not
5. `contract_templates` — 1 default template with 3 clauses
6. `contracts` — 2 active contracts for the assigned renters, 1 expired
7. `billing_periods` — 2 periods (2026-09, 2026-10), one `sent`, one `draft`
8. `meter_readings` — seeded readings for all rooms in both periods
9. `invoices` — 1 paid + 1 unpaid for the `sent` period
10. `help_tickets` — 1 open ticket, 1 resolved
11. `zalo_notifications` — 3 rows (mixed channels/statuses)

**Constraints:**
- Use hardcoded UUIDs so the data is deterministic across runs.
- Use `normalisePhone` for renter phones (`84XXXXXXXXX`).
- Use `parseAmount` for every money column.
- Use `normal magic-link token` for a sample magic link.
- The script must be idempotent: wrap in `TRUNCATE ... RESTART IDENTITY CASCADE` or `DELETE FROM` in reverse dependency order before insert, so repeated runs don't fail on unique constraints.
- Gate behind `NODE_ENV !== 'production'` — never run in prod.
- Add npm script: `"db:seed": "bun run src/db/seed.ts"`.

### Task 2: Seed execution order
```text
DELETE FROM zalo_notifications;
DELETE FROM magic_links;
DELETE FROM help_tickets;
DELETE FROM invoices;
DELETE FROM meter_readings;
DELETE FROM billing_periods;
DELETE FROM contracts;
DELETE FROM contract_templates;
DELETE FROM renters;
DELETE FROM rooms;
DELETE FROM motels;
DELETE FROM managers;
-- then insert in the order listed above
```

### Task 3: Verify seed data
- Run `bun run db:generate && bun run db:migrate` to ensure migration is current.
- Run `bun run db:seed`.
- Run `bun test src/test/schema-constraints.test.ts` to confirm the seeded data doesn't violate constraints.
- Add one new test: `seed-data.test.ts` that calls the seed function and asserts row counts > 0 for every table.

### Task 4: Complete billing module routes
Create `backend/src/modules/billing/billing.route.ts` exposing:
- `POST /api/billing/periods` — create period
- `GET /api/billing/periods` — list periods
- `POST /api/billing/periods/:id/generate` — generate invoices for a period
- `GET /api/billing/periods/:id/invoices` — list invoices for a period
- `PATCH /api/billing/invoices/:id/payment` — mark invoice paid/unpaid

Use the existing `tenancy` middleware; validate `month` 1–12 at the route schema level.

### Task 5: Complete contract module routes
Create `backend/src/modules/contract/contract.route.ts` exposing:
- `POST /api/contract-templates` — create template
- `GET /api/contract-templates` — list templates
- `POST /api/contracts` — create contract (draft)
- `PATCH /api/contracts/:id/sign` — OTP sign (stub for now, real OTP in sub-project 4)
- `GET /api/contracts` — list contracts

### Task 6: Complete ticket module routes
Create `backend/src/modules/ticket/ticket.route.ts` exposing:
- `POST /api/tickets` — renter submits ticket
- `GET /api/tickets` — manager lists tickets
- `PATCH /api/tickets/:id` — manager updates status/note

### Task 7: Register new routes in app.ts
Add `billingRoutes`, `contractRoutes`, `ticketRoutes` to the `/api` group in `backend/src/app.ts`.

### Task 8: Update TABLES list in test-db.ts
If any new tables are added by future migrations, they must be added to `src/db/test-db.ts` `TABLES` array. Currently the list matches the schema; verify it stays current after any new migration.

## Validation
- `bun run typecheck` passes
- `bun test src/test/schema-constraints.test.ts` passes
- `bun test src/test/seed-data.test.ts` passes (new)
- `bun run db:seed` completes without error and produces ~20 rows across 11 tables

## Out of Scope
- Zalo OA/ZNS integration (sub-project 8)
- VietQR payload generation (sub-project 3)
- OTP e-signature provider (sub-project 4)
- Frontend routes and UI
