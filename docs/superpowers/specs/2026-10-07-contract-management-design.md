# Contract Management — Design Spec

- **Date:** 2026-10-07
- **Status:** Draft for review
- **Related:** `docs/superpowers/specs/2026-10-03-motel-management-design.md`, `docs/api-contract.md`, `docs/adr/0006-otp-consent-e-signature.md`

## Goal

Add contract-template management, manager contract lifecycle APIs, renter contract reads, and OTP consent signing without coupling contract logic to Zalo implementation.

## Scope

### Included

- Tenant-scoped contract template CRUD.
- Tenant-scoped contract create, list, detail, draft update, send-for-signing, and terminate flows.
- Template clause validation and immutable clause snapshot on contract creation.
- Renter contract read endpoint scoped by authenticated renter session.
- OTP sign-request and verify endpoints.
- Atomic activation after valid OTP.
- Database-backed OTP state with hashed codes, five-minute expiry, three failed attempts, and five-minute resend cooldown.
- Tests for constraints, tenancy, lifecycle, OTP expiry/replay/attempt limits, and concurrent activation.

### Deferred

- Zalo OA/ZNS transport implementation remains sub-project 8. Contract code calls an exported notification seam; unavailable delivery returns a safe external-service error and does not activate the contract.
- Certified e-signature providers remain out of scope.
- PDF generation, document storage, and legal-signature certificates remain out of scope.

## Data model

Existing `contract_templates` and `contracts` tables remain authoritative. Add only OTP state needed for secure verification: hashed code, expiry timestamp, attempt count, and a version/consumed marker or equivalent transaction-safe state. Never store plaintext OTP.

Contract creation validates renter, room, and motel all belong to the manager's motel. `monthlyRent` defaults from `rooms.basePrice`; `clauses` defaults from the selected template or default motel template, then snapshots into `contracts.clauses`.

Only one active contract per room remains enforced by the existing partial unique index. A contract can be sent only while draft. Successful verification stamps `otpSignedAt` and changes status from draft to active in one transaction. Termination changes active status to terminated and frees room state through existing room service behavior.

## API behavior

Manager routes remain under `/api/manager/motels/:motelId`. Cross-tenant resources return 404.

- Templates: list, create, detail, patch, delete. Default assignment clears prior default atomically. Referenced templates cannot be deleted.
- Contracts: list with status filter, create, detail, draft-only patch, send, terminate.
- Renter: `GET /api/renter/contract`, `POST /api/renter/contract/:contractId/sign-request`, `POST /api/renter/contract/:contractId/verify`.

Renter endpoints derive renter ID from `renter_session`; request IDs cannot widen access. Sign request rejects non-draft contracts, enforces cooldown, creates a new hashed OTP, and invokes notification seam. Verify accepts one six-digit code, rejects expired/consumed/exhausted state, increments failed attempts transactionally, and activates only on valid code.

## Boundaries

`contract.service.ts` owns contract and template persistence, validation, lifecycle, and OTP state transitions. Routes own authentication, request schemas, and response serialization. Zalo delivery is an injected/exported notification function owned by the future Zalo module; contract service does not import Zalo tables or SDKs.

## Error behavior

Use existing error envelope and codes. Invalid OTP uses `OTP_INVALID`; expired or exhausted OTP uses `OTP_EXPIRED`; resend within five minutes uses `RATE_LIMITED` with retry details; invalid lifecycle transitions use `CONFLICT`; missing tenant-owned resources use `NOT_FOUND`. Delivery failure uses `EXTERNAL_SERVICE_ERROR`, leaves contract draft, and does not expose OTP or provider details.

## Verification

Run backend typecheck, contract tests, schema constraint tests, tenancy tests, and affected billing/renter tests sequentially against disposable test PostgreSQL. Reconcile `docs/api-contract.md`, design spec, UI spec, and `docs/testing-strategy.md` before implementation. Frontend work starts only after live contract endpoints and response/error shapes exist.
