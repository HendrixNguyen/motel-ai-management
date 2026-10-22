# Live QA Core-Flow and Payment UI

- **Date:** 2026-10-11
- **Status:** Design approved; expanded scope awaiting written-spec review
- **Scope:** Audit and complete existing renter payment-proof and manager payment-review UI needed for a real QA end-to-end test, then exercise the end-to-end UI journey against QA. No unrelated product redesign or CRUD.

## Goal

Verify real user behavior and persisted state through browser interactions, not API-only tests or fixture mocks. Target journey: manager login → create motel → create room → create renter → create/send contract if supported → create billing period → enter meter readings → generate/finalize invoice → issue renter magic link → open renter portal and inspect invoice → submit one payment-proof image → manager rejects proof and renter resubmits on a separate invoice flow, manager approves proof on its own invoice, and manager confirms cash on a third invoice. Each approval or cash action uses a dedicated QA invoice because paid state is irreversible. Report the first unavailable workflow; do not claim end-to-end success unless every required stage succeeds.

## Constraints

- QA only. No production access, deploy, destructive reset, or mass cleanup.
- Reuse existing core UI and API behavior. Avoid adding CRUD that already exists.
- Use a dedicated QA motel and unique names/phone values; do not modify unrelated records.
- Create separate invoices for approve, reject/resubmit, and cash branches. Leave resulting audit/history data tagged and documented; do not attempt to reverse paid invoices.
- Clean up only resources created by test, only through UI-supported reversible operations where safe. If cleanup would delete or mutate historical data, leave tagged test records and document that.
- Keep tests independent from fixture-backed Playwright tests. Preserve `E2E_REAL=1` gating.
- Never put credentials, renter phone, OTP, magic-link token, signed URL, upload bytes, or payment data in test output or logs.
- Payment proof is exactly one private JPEG or PNG image, maximum 5 MB (5,000,000 bytes). Renter cannot change invoice payment state.
- Preserve API contract and backend invariants: tenant scope from session, cross-tenant 404, proof upload validation and one non-rejected proof per invoice, manager-only approve/reject/cash, idempotency for approved/cash-settled retries, and audit events.
- Require explicit `E2E_REAL=1`, QA base URL, manager login credentials, and explicit QA-only mutation confirmation before mutations. Fail fast when markers identify production. Never reset schemas or run deterministic destructive seed.

## Existing API contract

`docs/api-contract.md` is authoritative for current payment endpoints and semantics:

- Renter: `POST /api/renter/invoices/:invoiceId/payment-proof` with exactly one multipart `file`; `GET` same path reads own proof.
- Manager: `GET /api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof`; `POST .../payment-proof/approve`; `POST .../payment-proof/reject` with reason; `POST .../cash-confirmation`.
- One non-rejected proof per invoice; reject leaves invoice unpaid; approve sets paid/bank_transfer; cash sets paid/cash; no renter paid mutation.

Before changing code, inspect current frontend routes/components and backend route implementation against this contract. Implement only UI/API gaps. Do not alter endpoint semantics or introduce new payment methods. If any endpoint differs from documented behavior, stop and reconcile the contract in a separate explicit decision rather than silently changing backend semantics.

## Design

Add the smallest renter portal UI for selecting/uploading one image and viewing pending/approved/rejected proof status. Add the smallest manager invoice review UI to inspect proof, enter a rejection reason, approve, or confirm cash for invoices that are eligible. Reuse existing invoice list/detail screens and APIs; add no abstractions or dependencies unless existing patterns cannot support required file input or image viewing. Keep user-facing copy Vietnamese and use native accessible file input/dialog/form patterns already present in the project.

Extend `frontend/e2e/real/stack.spec.ts` or adjacent live specs with visible browser interactions. Create unique motel/room/renter data through existing forms, reload to verify persistence, then exercise contract, billing, capture, invoice, magic-link, renter portal, proof upload, rejection/resubmission, approval, and cash confirmation. Use a generated tiny valid JPEG/PNG fixture with no personal content. All payment mutations happen on newly created isolated invoices. Direct API calls may be used only for preflight safety checks or cleanup; never substitute for UI actions under test.

Run live journey against QA before changing product code. Record exact failing step, browser error, redacted request path/status, and commit SHA. For each product defect, add a regression test before smallest root-cause fix. Do not broaden into visual redesign or unrelated CRUD.

## Verification

- Backend: `bun run typecheck`; relevant payment-proof, manager billing/payment, and isolation test files sequentially; do not run destructive reset on shared QA.
- Frontend: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, fixture `bun run test:e2e` where Chromium is available.
- Live QA: `E2E_REAL=1 bun run test:e2e` only with explicitly configured QA, dedicated credentials, mutation confirmation, and isolated invoices.
- Report command, timestamp, SHA, environment label, pass/fail counts, workflow stop point, any browser/deployment blocker, and tagged QA records; no sensitive values.

## Open implementation detail

Confirm dedicated QA manager identity, renter portal magic-link route, and whether QA has disposable test motel/invoices before selecting persistence/cleanup behavior. The design assumes no destructive cleanup of invoice, proof, payment, or audit history; use unique tagged records instead. The existing contracts page may be read-only and contract create/send UI may therefore remain an explicitly reported blocker unless another supported UI route exists; this task does not add contract creation without a separate approved design.
