# Room & Renter Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete sub-project 2 — Motels CRUD, Rooms CRUD, Renters CRUD, and Manager-issued magic links. All endpoints must enforce tenant isolation (404 never 403), use the existing modular monolith patterns, and pass cross-tenant isolation tests.

**Depends on:** Sub-project 1 (Core Backend + Database) — complete and pushed to `origin/main` at `8371e37`.

**Architecture:** Modular monolith under `backend/src/modules/`. Each domain owns its `*.route.ts`, `*.service.ts`, `*.schema.ts`, `*.types.ts`. Cross-module calls go through exported service functions. The `renter` module already exports `getRenter()`, `createRenter()`, `getRenterByPhone()` for cross-module use.

**Tech Stack:** Bun, ElysiaJS, TypeScript (strict), PostgreSQL 16, Drizzle ORM, `@elysiajs/jwt`, argon2, `bun:test`.

**Spec References:**
- Design spec: [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../../docs/superpowers/specs/2026-10-03-motel-management-design.md) — Data Model, Authentication, Backend Architecture sections
- API contract: [`docs/api-contract.md`](../../docs/api-contract.md) — Motels, Rooms, Renters, Manager-issued magic links endpoints
- Testing strategy: [`docs/testing-strategy.md`](../../docs/testing-strategy.md)
- ADR-0004: [`docs/adr/0004-modular-monolith.md`](../../docs/adr/0004-modular-monolith.md) — Module rules

## Global Constraints

- Bun only. Never `npm`, `yarn`, or `npx`.
- Strict TypeScript. No `any` that survives into exported signatures.
- Money is `NUMERIC(14,0)` and serialised as JSON **string** of VND digits. Never a float, never a `number` in API responses.
- Vietnamese phone numbers normalised to `84XXXXXXXXX` — no leading `0`, no `+`.
- Tenant scope always comes from the session; no endpoint accepts `managerId` from the client. Cross-tenant denial is **404, never 403** — a 403 confirms the resource exists.
- UUID primary keys, `TIMESTAMPTZ` with `now()` defaults.
- Tests hit a real PostgreSQL database, not a mock. A schema constraint only documented is not tested.
- Each module's tables live in that module's `*.schema.ts`. `db/schemas.ts` may only re-export.
- Existing `managerAuth` plugin provides `{ auth: { userId, email } }` from the `manager_session` cookie.
- Existing `resolveOwnedMotel(motelId, managerId)` throws `AppError.notFound` when the motel doesn't exist or belongs to another manager.
- Existing `magicLinks` table (in `auth.schema.ts`) and `issueMagicLink()`, `consumeMagicLink()` in `shared/magic-link.ts` — reuse for manager-issued links.

## Review Focus

Four inputs the spec implies that are easy to get wrong. Each has a test in the task that owns the code.

1. **Two managers, one motel id.** Manager A requests Manager B's motel/room/renter. Must be `404`, never `403` and never data. → Task 2, 3, 4, 5 — asserted over HTTP in Task 6.
2. **Duplicate room name within a motel.** `POST /motels/:motelId/rooms` with existing name returns `409 CONFLICT`. → Task 3.
3. **Duplicate renter phone within a motel.** `POST /motels/:motelId/renters` with existing phone returns `409 CONFLICT`. → Task 4.
4. **Manager-issued magic link creates a valid token.** The token must work with the existing `/exchange` endpoint and set a `renter_session` cookie. → Task 5.

Each step is one action with a checkable result. Run `/review-security` and `/review-code` before merging this plan's work.

---

## File Structure (Additions)

```
backend/
  src/
    modules/
      motel/
        motel.route.ts        (NEW)
        motel.service.ts      (NEW)
        motel.types.ts        (NEW)
      room/
        room.route.ts         (NEW)
        room.service.ts       (NEW)
        room.types.ts         (NEW)
      renter/
        renter.route.ts       (NEW)
        renter.service.ts     (EXTEND - add update, delete, list, get-by-id)
    test/
      motel.test.ts           (NEW)
      room.test.ts            (NEW)
      renter.test.ts          (NEW)
      magic-link-issue.test.ts (NEW)
      cross-tenant-isolation-2.test.ts (NEW)
```

---

### Task 1: Motel Module — CRUD Routes & Service

**Files:**
- Create: `backend/src/modules/motel/motel.service.ts`
- Create: `backend/src/modules/motel/motel.route.ts`
- Create: `backend/src/modules/motel/motel.types.ts`
- Modify: `backend/src/app.ts` (mount routes)
- Test: `backend/src/test/motel.test.ts`

**Interfaces:**
- Consumes: `db`, `motels` (from `motel.schema.ts`), `managerAuth`, `resolveOwnedMotel`, `AppError`, `parseVnd`
- Produces:
  - `motel.service.ts`: `listMotels(managerId)`, `createMotel(managerId, input)`, `getMotel(motelId, managerId)`, `updateMotel(motelId, managerId, input)`, `deleteMotel(motelId, managerId)`
  - `motel.route.ts`: `GET /api/manager/motels`, `POST /api/manager/motels`, `GET /api/manager/motels/:motelId`, `PATCH /api/manager/motels/:motelId`, `DELETE /api/manager/motels/:motelId`
  - `motel.types.ts`: request/response types matching the API contract

**API Contract (from `docs/api-contract.md`):**
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/manager/motels` | All motels owned by the manager |
| POST | `/api/manager/motels` | Create; `409` if `electricityPrice`/`waterPrice` missing (handled by DB NOT NULL) |
| GET | `/api/manager/motels/:motelId` | `404` if not owned by caller |
| PATCH | `/api/manager/motels/:motelId` | Partial update of prices, fees, bank account, address |
| DELETE | `/api/manager/motels/:motelId` | Soft-blocked while any room is `occupied`; returns `409` |

**Steps:**

- [ ] **Step 1.1: Write failing tests** — `motel.test.ts` covering:
  - `listMotels` returns only caller's motels
  - `createMotel` requires `electricityPrice` and `waterPrice` (string digits)
  - `getMotel` returns 404 for another manager's motel
  - `updateMotel` partial update works (address, prices, fees, bankAccount)
  - `deleteMotel` returns `409 CONFLICT` when any room has status `occupied`
  - `deleteMotel` succeeds when all rooms are `available` or `maintenance`

- [ ] **Step 1.2: Run tests to verify they fail**
  `cd backend && bun test src/test/motel.test.ts`

- [ ] **Step 1.3: Implement `motel.types.ts`** — Request/response types for each endpoint

- [ ] **Step 1.4: Implement `motel.service.ts`** — All five service functions using `resolveOwnedMotel` for ownership checks. `deleteMotel` must query rooms table for `occupied` status before deleting.

- [ ] **Step 1.5: Implement `motel.route.ts`** — Mount under `/api/manager/motels`, use `managerAuth` plugin, validate body with Elysia's `t.Object()`, return proper error envelopes

- [ ] **Step 1.6: Mount routes in `app.ts`** — Import and `.use(motelRoutes)` in the `/api` group

- [ ] **Step 1.7: Run tests to verify they pass**
  `cd backend && bun test src/test/motel.test.ts`

- [ ] **Step 1.8: Run typecheck**
  `cd backend && bun run typecheck`

- [ ] **Step 1.9: Commit**
  ```bash
  git add backend/src/modules/motel backend/src/app.ts backend/src/test/motel.test.ts
  git commit -m "feat(backend): motel CRUD with tenant isolation"
  ```

---

### Task 2: Room Module — CRUD Routes & Service

**Files:**
- Create: `backend/src/modules/room/room.service.ts`
- Create: `backend/src/modules/room/room.route.ts`
- Create: `backend/src/modules/room/room.types.ts`
- Modify: `backend/src/app.ts` (mount routes)
- Test: `backend/src/test/room.test.ts`

**Interfaces:**
- Consumes: `db`, `rooms`, `roomStatus` enum (from `room.schema.ts`), `motels` (for ownership via `resolveOwnedMotel`), `managerAuth`, `resolveOwnedMotel`, `AppError`, `parseVnd`
- Produces:
  - `room.service.ts`: `listRooms(motelId, managerId, filters?)`, `createRoom(motelId, managerId, input)`, `getRoom(roomId, motelId, managerId)`, `updateRoom(roomId, motelId, managerId, input)`, `deleteRoom(roomId, motelId, managerId)`
  - `room.route.ts`: `GET /api/manager/motels/:motelId/rooms`, `POST /api/manager/motels/:motelId/rooms`, `GET /api/manager/motels/:motelId/rooms/:roomId`, `PATCH /api/manager/motels/:motelId/rooms/:roomId`, `DELETE /api/manager/motels/:motelId/rooms/:roomId`
  - `room.types.ts`: Request/response types; `filters` = `{ floor?: number, status?: RoomStatus, search?: string }`

**API Contract:**
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/manager/motels/:motelId/rooms` | Supports `?floor=&status=&search=` |
| POST | `/api/manager/motels/:motelId/rooms` | `409` on duplicate `(motelId, name)` |
| GET | `/api/manager/motels/:motelId/rooms/:roomId` | |
| PATCH | `/api/manager/motels/:motelId/rooms/:roomId` | Name, floor, `basePrice`, status |
| DELETE | `/api/manager/motels/:motelId/rooms/:roomId` | `409` if an active contract exists |

**Steps:**

- [ ] **Step 2.1: Write failing tests** — `room.test.ts` covering:
  - `listRooms` supports `floor`, `status`, `search` (ILIKE on name) filters
  - `createRoom` returns `409 CONFLICT` on duplicate name within motel
  - `getRoom` returns 404 for room in another manager's motel
  - `updateRoom` partial update works for name, floor, basePrice, status
  - `deleteRoom` returns `409 CONFLICT` when active contract exists (check `contracts` table where `roomId` and `status = 'active'`)
  - `deleteRoom` succeeds when no active contract

- [ ] **Step 2.2: Run tests to verify they fail**
  `cd backend && bun test src/test/room.test.ts`

- [ ] **Step 2.3: Implement `room.types.ts`**

- [ ] **Step 2.4: Implement `room.service.ts`** — All five service functions. Every call starts with `resolveOwnedMotel(motelId, managerId)`. Use the existing `rooms_motel_id_name_uq` unique index for duplicate name detection.

- [ ] **Step 2.5: Implement `room.route.ts`** — Mount under `/api/manager/motels/:motelId/rooms`, use `managerAuth`, validate query params and body

- [ ] **Step 2.6: Mount routes in `app.ts`**

- [ ] **Step 2.7: Run tests to verify they pass**
  `cd backend && bun test src/test/room.test.ts`

- [ ] **Step 2.8: Run typecheck**
  `cd backend && bun run typecheck`

- [ ] **Step 2.9: Commit**
  ```bash
  git add backend/src/modules/room backend/src/app.ts backend/src/test/room.test.ts
  git commit -m "feat(backend): room CRUD with tenant isolation and filters"
  ```

---

### Task 3: Renter Module — CRUD Routes & Service (Extend)

**Files:**
- Modify: `backend/src/modules/renter/renter.service.ts` (add `listRenters`, `getRenterById`, `updateRenter`, `deleteRenter`)
- Create: `backend/src/modules/renter/renter.route.ts`
- Create: `backend/src/modules/renter/renter.types.ts`
- Modify: `backend/src/app.ts` (mount routes)
- Test: `backend/src/test/renter.test.ts`

**Interfaces:**
- Consumes: `db`, `renters`, `renterStatus` enum, `rooms`, `motels`, `contracts` (for invoice history), `managerAuth`, `resolveOwnedMotel`, `AppError`, `normalisePhone`, `parseVnd`, existing `getRenter`, `createRenter`, `getRenterByPhone`
- Produces:
  - Extended `renter.service.ts`: `listRenters(motelId, managerId, filters?)`, `getRenterById(renterId, motelId, managerId)`, `updateRenter(renterId, motelId, managerId, input)`, `deleteRenter(renterId, motelId, managerId)` (soft-delete: `status = 'inactive'`)
  - `renter.route.ts`: `GET /api/manager/motels/:motelId/renters`, `POST /api/manager/motels/:motelId/renters`, `GET /api/manager/motels/:motelId/renters/:renterId`, `PATCH /api/manager/motels/:motelId/renters/:renterId`, `DELETE /api/manager/motels/:motelId/renters/:renterId`
  - `renter.types.ts`: Request/response types; `filters` = `{ status?: RenterStatus, roomId?: string, search?: string }`

**API Contract:**
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/manager/motels/:motelId/renters` | Supports `?status=&roomId=&search=` |
| POST | `/api/manager/motels/:motelId/renters` | `409` on duplicate `(motelId, phone)`; triggers ZNS welcome (deferred to sub-project 8 — return token/URL for now) |
| GET | `/api/manager/motels/:motelId/renters/:renterId` | Includes contract summary and invoice history |
| PATCH | `/api/manager/motels/:motelId/renters/:renterId` | Name, phone, CCCD, `idCardFrontUrl`, `idCardBackUrl`, `roomId`, status |
| DELETE | `/api/manager/motels/:motelId/renters/:renterId` | Soft-delete: sets `status = inactive`, keeps financial history |

**Steps:**

- [ ] **Step 3.1: Write failing tests** — `renter.test.ts` covering:
  - `listRenters` supports `status`, `roomId`, `search` (ILIKE on name/phone) filters
  - `createRenter` returns `409 CONFLICT` on duplicate phone within motel
  - `getRenterById` includes contract summary (active contract with room name, dates, rent) and invoice history (last 5 invoices with status, amount)
  - `updateRenter` normalises phone, allows room reassignment (validates room belongs to same motel), partial update works
  - `deleteRenter` soft-deletes (sets `status = 'inactive'`), does not hard delete
  - Cross-tenant: all endpoints return 404 for another manager's motel

- [ ] **Step 3.2: Run tests to verify they fail**
  `cd backend && bun test src/test/renter.test.ts`

- [ ] **Step 3.3: Implement `renter.types.ts`**

- [ ] **Step 3.4: Extend `renter.service.ts`** — Add the four new functions. `getRenterById` joins contracts and invoices for the summary. `updateRenter` normalises phone before update. `deleteRenter` updates status to `inactive`.

- [ ] **Step 3.5: Implement `renter.route.ts`** — Mount under `/api/manager/motels/:motelId/renters`, use `managerAuth`

- [ ] **Step 3.6: Mount routes in `app.ts`**

- [ ] **Step 3.7: Run tests to verify they pass**
  `cd backend && bun test src/test/renter.test.ts`

- [ ] **Step 3.8: Run typecheck**
  `cd backend && bun run typecheck`

- [ ] **Step 3.9: Commit**
  ```bash
  git add backend/src/modules/renter backend/src/app.ts backend/src/test/renter.test.ts
  git commit -m "feat(backend): renter CRUD with contract summary and invoice history"
  ```

---

### Task 4: Manager-Issued Magic Links

**Files:**
- Create: `backend/src/modules/auth/manager-magic-link.route.ts` (or extend `auth.route.ts`)
- Modify: `backend/src/app.ts` (mount route)
- Test: `backend/src/test/magic-link-issue.test.ts`

**Interfaces:**
- Consumes: `db`, `renters`, `motels`, `magicLinks`, `managerAuth`, `resolveOwnedMotel`, `issueMagicLink` (from `shared/magic-link.ts`), `AppError`
- Produces:
  - Route: `POST /api/manager/motels/:motelId/renters/:renterId/magic-link` → `200 { token, url }`

**API Contract:**
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/manager/motels/:motelId/renters/:renterId/magic-link` | — | `200 {token, url}` — manager-issued link for the renter |

**Steps:**

- [ ] **Step 4.1: Write failing tests** — `magic-link-issue.test.ts` covering:
  - Manager can issue a magic link for a renter in their motel
  - Returns `{ token, url }` where `url` = `${env.FRONTEND_URL}/renter/${token}`
  - Issued token works with existing `POST /api/renter/magic-links/exchange` (sets `renter_session` cookie, returns renter)
  - Another manager cannot issue link for renter in foreign motel (404)
  - Renter must belong to the specified motel (404 if mismatch)

- [ ] **Step 4.2: Run tests to verify they fail**
  `cd backend && bun test src/test/magic-link-issue.test.ts`

- [ ] **Step 4.3: Implement route** — Validate renter exists and belongs to the motel (use `resolveOwnedMotel` + renter lookup), call `issueMagicLink(renterId)`, construct URL using `env.FRONTEND_URL` (add to `env.ts` if missing, default `http://localhost:3001`)

- [ ] **Step 4.4: Mount route in `app.ts`**

- [ ] **Step 4.5: Run tests to verify they pass**
  `cd backend && bun test src/test/magic-link-issue.test.ts`

- [ ] **Step 4.6: Run typecheck**
  `cd backend && bun run typecheck`

- [ ] **Step 4.7: Commit**
  ```bash
  git add backend/src/modules/auth/manager-magic-link.route.ts backend/src/app.ts backend/src/test/magic-link-issue.test.ts
  git commit -m "feat(backend): manager-issued magic links for renters"
  ```

---

### Task 5: Cross-Tenant Isolation Tests (Sub-Project 2)

**Files:**
- Create: `backend/src/test/cross-tenant-isolation-2.test.ts`

**Goal:** Verify that every new endpoint in Tasks 1–4 enforces tenant isolation over HTTP (not just at the service layer).

**Steps:**

- [ ] **Step 5.1: Write tests** covering:
  - Manager A cannot GET/POST/PATCH/DELETE Manager B's motels
  - Manager A cannot GET/POST/PATCH/DELETE rooms in Manager B's motel
  - Manager A cannot GET/POST/PATCH/DELETE renters in Manager B's motel
  - Manager A cannot issue magic link for renter in Manager B's motel
  - All cross-tenant attempts return `404 NOT_FOUND` (never `403 FORBIDDEN`)
  - Use `app.handle(new Request(...))` with real session cookies (like `isolation.test.ts`)

- [ ] **Step 5.2: Run tests to verify they pass**
  `cd backend && bun test src/test/cross-tenant-isolation-2.test.ts`

- [ ] **Step 5.3: Run full test suite**
  `cd backend && bun test`

- [ ] **Step 5.4: Run typecheck and lint**
  `cd backend && bun run typecheck`

- [ ] **Step 5.5: Commit**
  ```bash
  git add backend/src/test/cross-tenant-isolation-2.test.ts
  git commit -m "test(backend): cross-tenant isolation for motels, rooms, renters, magic links"
  ```

---

### Task 6: Documentation Reconciliation

**Files:**
- Modify: `docs/api-contract.md` (verify all new endpoints are documented correctly)
- Modify: `docs/superpowers/specs/2026-10-03-motel-management-design.md` (verify data model matches implemented schema)

**Steps:**

- [ ] **Step 6.1: Verify API contract matches implementation** — Check all endpoints, request/response bodies, error codes, query params
- [ ] **Step 6.2: Verify design spec data model matches Drizzle schema** — No drift
- [ ] **Step 6.3: Run `git diff --check`** — No whitespace errors
- [ ] **Step 6.4: Commit**
  ```bash
  git add docs/api-contract.md docs/superpowers/specs/2026-10-03-motel-management-design.md
  git commit -m "docs: reconcile API contract and design spec for sub-project 2"
  ```

---

## Execution Order

Tasks 1–4 can be done in parallel (they operate on different modules) but must all complete before Task 5. Task 6 is last.

**Recommended parallel groups:**
- Group A: Task 1 (Motel)
- Group B: Task 2 (Room)
- Group C: Task 3 (Renter)
- Group D: Task 4 (Manager Magic Link)

Then: Task 5 → Task 6

---

## Validation Checklist (Before Merge)

- [ ] `cd backend && bun run typecheck` — exits 0
- [ ] `cd backend && bun test` — all tests pass (including new ones)
- [ ] `cd backend && bun test src/test/motel.test.ts src/test/room.test.ts src/test/renter.test.ts src/test/magic-link-issue.test.ts src/test/cross-tenant-isolation-2.test.ts` — all pass
- [ ] `git diff --check` — no whitespace errors
- [ ] `/review-security` — no findings on auth, tenancy, money handling
- [ ] `/review-code` — no findings on module boundaries, spec conformance, types, tests, doc drift