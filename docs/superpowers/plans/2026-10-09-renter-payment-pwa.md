# Renter Payment PWA MVP Implementation Plan

> **Execution:** use `subagent-driven-development` or `executing-plans` after approval. This document plans product code only; current task writes docs.

**Goal:** Ship mobile-first renter payment PWA with one-time activation, invoice/VietQR viewing, exactly one current payment-proof image per invoice, manager approval/rejection or cash confirmation, manager-only paid state, and push-first notifications with ZNS/ZBS fallback. SMS remains out of MVP unless explicitly added as a later documented fallback.

**Design:** `docs/superpowers/specs/2026-10-09-renter-payment-pwa-design.md`

**Repo baseline:** existing renter portal routes/services at `backend/src/modules/renter-portal/`, magic-link exchange at `backend/src/modules/auth/magic-link.route.ts`, billing/payment state at `backend/src/modules/billing/`, private upload metadata at `backend/src/modules/billing/upload.schema.ts`, Zalo outbox at `backend/src/modules/notification/`, renter pages under `frontend/src/app/portal/` and `frontend/src/app/renter/`. Existing untracked `.kilo/plans/prd_project_brief_smartmotel_platform.txt` is unrelated; preserve it.

## Global constraints

- No chat, contracts, tickets, bank auto-reconciliation, gateways, multi-image proof, passwords, or renter-side paid action.
- Money remains digit strings; invoice totals remain billing snapshots.
- Tenant scope comes from auth session only. Cross-tenant access is `404`.
- Renter and manager cookies/plugins remain separate.
- Proof image is one current JPEG/PNG, maximum 10 MB, byte-validated, private, opaque object key, short-lived signed reads. Pending/approved blocks replacement; rejected proof stays audit history and allows one new current proof.
- Approval/rejection/cash transitions are manager-only, idempotent, and auditable.
- Notification means outbound event; channel means transport. Web Push is primary after activation; ZNS/ZBS is fallback. SMS is excluded unless separately documented. Events are committed after domain state, idempotent, bounded, and redacted; queued/sent/failed are distinct.
- Browser uses relative `/api/*`; no client-visible provider credentials or `BACKEND_URL`.
- Do not modify unrelated worktree files.

## Task 1: Reconcile contracts and status vocabulary

**Files:**
- Modify `docs/api-contract.md`
- Modify `docs/frontend-ui-specs.md`
- Modify `docs/testing-strategy.md`
- Modify `docs/full-flow-test-plan.md`
- Modify `backend/src/shared/errors.ts` only if missing stable codes

**Work:** document exact activation, invoice detail, proof upload/review, cash confirmation, push subscription, and notification fallback shapes. Define notification/event vocabulary and channel scope; proof statuses (`pending`, `approved`, `rejected`), payment method if exposed (`bank_transfer`, `cash`), exact allowed transitions, 400/401/404/409/429/502 behavior, signed URL TTL, and no renter paid mutation. Rejected proof remains immutable history and permits one replacement current proof; pending/approved blocks replacement. Mark push-subscription routes as planned until implemented. Remove stale claims that payment proof is absent or that Zalo is the only post-activation channel. Keep existing billing `/paid` as canonical manager transition unless orchestration requires a new exported service.

**Tests/checks:** docs consistency scan; verify every route in plan maps to a documented route and stable error code. Do not invent fields unsupported by current service shapes.

## Task 2: Add payment-proof schema, migration, and test reset wiring

**Files:**
- Create `backend/src/modules/payment/payment.schema.ts`
- Create migration under `backend/drizzle/`
- Modify `backend/src/db/schemas.ts`
- Modify `backend/src/db/test-db.ts`
- Add/extend `backend/src/modules/payment/payment.types.ts`
- Test `backend/src/test/payment-proof-schema.test.ts`

**Interfaces/data:**
- `paymentProofs`: UUID, `invoiceId`, `renterId`, `motelId`, opaque `objectKey`, content metadata, status enum, submitted/reviewed timestamps, reviewer manager ID, rejection reason.
- Partial unique invoice invariant: one non-rejected current proof per invoice; rejected rows remain history. Use FK constraints and indexes for invoice/renter/motel lookup.
- Add payment-method/audit storage only if current invoice model cannot represent cash versus bank proof; preserve existing API compatibility and invoice amounts.

**Steps:** write failing PostgreSQL tests for FK, unique invoice proof, status/check constraints, and tenant columns; add additive migration; export schema; add table to `TABLES`; run migration-backed tests sequentially.

**Done:** schema constraints reject duplicates and invalid states in DB, not only route code.

## Task 3: Build payment-proof storage/service boundary

**Files:**
- Create `backend/src/modules/payment/payment.service.ts`
- Create `backend/src/modules/payment/payment.route.ts`
- Create/modify `backend/src/modules/payment/payment.types.ts`
- Reuse existing storage adapter files from prior renter/capture work; do not create a second storage abstraction
- Modify `backend/src/app.ts`
- Tests `backend/src/test/payment-proof.test.ts`, `backend/src/test/payment-proof-upload.test.ts`

**Interfaces:**
- `submitPaymentProof(session, invoiceId, file): Promise<PaymentProofResponse>`
- `getRenterPaymentProof(session, invoiceId): Promise<PaymentProofResponse | null>`
- `getManagerPaymentProof(managerId, motelId, invoiceId): Promise<ManagerPaymentProofResponse>`
- `approvePaymentProof(managerId, motelId, invoiceId): Promise<InvoicePaymentResult>`
- `rejectPaymentProof(managerId, motelId, invoiceId, reason): Promise<PaymentProofResponse>`
- `confirmCashPayment(managerId, motelId, invoiceId): Promise<InvoicePaymentResult>`

**Steps:** validate invoice ownership/status and period state; validate image content and size before storage; create opaque object key; insert proof metadata; return no key. Signed URL only after session authorization. Keep invoice payment mutation in billing exported service, not direct table access from route.

**Tests:** own renter upload/read; foreign renter 404; foreign manager motel 404; JPEG/PNG magic bytes; wrong declared MIME; oversized stream; duplicate pending/approved submission; rejected replacement; paid invoice conflict; storage failure leaves no committed proof; signed URL authorization and short TTL; no token/key leakage.

## Task 4: Add manager review and cash-confirmation routes

**Files:**
- Extend `backend/src/modules/payment/payment.route.ts`
- Extend `backend/src/modules/payment/payment.service.ts`
- Modify `backend/src/modules/billing/billing.service.ts` only through exported payment transition seams
- Modify `backend/src/modules/billing/billing.types.ts` if response types need payment method/proof summary
- Tests `backend/src/test/payment-review.test.ts`, `backend/src/test/payment-race.test.ts`

**Steps:** add manager proof detail, approve, reject, and cash-confirmation endpoints. Approve transaction locks proof/invoice state, marks invoice paid once, stamps reviewer, and queues notification after commit. Reject requires non-empty bounded reason and leaves invoice unpaid. Cash confirmation skips proof and marks invoice paid through manager auth only. Existing idempotent paid behavior remains safe for retries.

**Tests:** approve pending proof; reject then replacement; approve/reject race; approve/cash race; repeated approve/cash returns stable paid result; paid invoice cannot become unpaid; draft/sent/closed rules match billing contract; manager A cannot access manager B; renter cannot call manager endpoints; notification failure does not undo committed review/payment.

## Task 5: Extend notifications with Web Push primary and ZNS/ZBS fallback

**Files:**
- Modify `backend/src/modules/notification/notification.schema.ts`
- Add migration under `backend/drizzle/`
- Modify `backend/src/modules/notification/notification.types.ts`
- Modify `backend/src/modules/notification/notification.service.ts`
- Modify `backend/src/modules/notification/notification.route.ts` only for renter subscription routes
- Add provider adapter files beside existing notification implementation
- Modify `backend/src/env.ts`, `backend/src/config.ts`, `.env.example`
- Modify `backend/src/db/schemas.ts`, `backend/src/db/test-db.ts`
- Tests `backend/src/test/push-subscription.test.ts`, `backend/src/test/notification-fallback.test.ts`, `backend/src/test/notification-integration.test.ts`

**Interfaces:**
- `registerPushSubscription(renterSession, input)`; `revokePushSubscription(renterSession, id)`
- `enqueueNotification(input)` accepts channel preference and stable event key
- `deliverNotification(eventId)` attempts Web Push, deactivates permanently failed subscriptions, then queues configured ZNS/ZBS fallback; SMS is excluded unless separately documented.
- Providers implement fake/test adapters and production adapter boundaries; credentials stay server-side

**Steps:** add `web_push`/fallback channel model without breaking existing Zalo enum data; store endpoint/public key/auth material safely; dedupe endpoint; validate URL/key shape; add push-first orchestration. Activation delivery stays ZNS/ZBS/manual link. Payment events: proof submitted, approved, rejected, cash confirmed, invoice ready/reminder use event keys such as `invoice:<id>:proof-submitted` and `invoice:<id>:paid`.

**Tests:** subscription ownership/deduplication/revocation; push success; permission/endpoint failure; permanent push failure fallback; transient retries max three; duplicate event key; provider IDs/status; payload redaction; no private key/token logs; notification failure isolated from billing/payment state.

## Task 6: Complete renter API and activation fallback

**Files:**
- Modify `backend/src/modules/auth/magic-link.route.ts` only where manager-issued/manual fallback semantics need correction
- Modify `backend/src/modules/renter-portal/renter-portal.route.ts`
- Modify `backend/src/modules/renter-portal/renter-portal.service.ts`
- Modify `backend/src/modules/renter-portal/renter-portal.types.ts`
- Modify manager renter route/service that issues links
- Tests `backend/src/test/renter-portal.test.ts`, `backend/src/test/renter-auth.test.ts`, `backend/src/test/renter-payment-isolation.test.ts`

**Steps:** preserve one-time 24-hour exchange and session. Ensure manager-issued link/QR fallback works without requiring provider delivery. Add invoice proof reads, push subscription routes, and safe expired-link response. Keep invoice DTO itemized with QR payload and payment status, excluding manager notes/object keys.

**Tests:** exchange/replay/expiry; manual link copied/opened; own invoices only; foreign invoice/period 404; renter cannot mark paid/approve/reject/cash-confirm; response redaction; rate limits; logout invalidates portal reads.

## Task 7: Implement renter mobile PWA screens

**Files:**
- Modify `frontend/src/app/renter/page.tsx`
- Modify `frontend/src/app/portal/layout.tsx`
- Modify `frontend/src/app/portal/page.tsx`
- Modify `frontend/src/app/portal/bills/page.tsx`
- Modify `frontend/src/app/portal/bills/[id]/page.tsx`
- Create `frontend/src/components/renter/payment-proof-form.tsx`
- Create `frontend/src/components/renter/push-permission.tsx`
- Create/modify `frontend/src/lib/api/renter.server.ts`, `frontend/src/lib/api/renter.client.ts`, `frontend/src/lib/api/types.ts`
- Create service-worker/PWA files only if current app manifest/service-worker seam is absent

**Behavior:** activation/link-expired state; invoice list; invoice detail with backend amounts and local QR from `qrCodeData`; exactly one image picker/capture input; pending/approved/rejected states; rejected reason and re-upload; paid invoice disables upload; push permission prompt after activation, skip path preserved. No contract/ticket/chat UI in this MVP surface.

**Tests:** API client method/path/body/401/404/409 handling; image count/type/size client hints; invoice/QR rendering; status transitions; refresh after submit/review; no renter paid action; 360/375/430px no horizontal overflow; keyboard/focus/44px controls; push denied fallback.

Read Next 16.3.8 docs under `frontend/node_modules/next/dist/docs/` before changing route/layout code. Use existing tokens/components; no new UI dependency.

## Task 8: Implement manager payment review UI

**Files:**
- Modify `frontend/src/app/(manager)/billing/[periodId]/invoices/page.tsx` or actual invoice route discovered during implementation
- Create/modify manager invoice proof components under `frontend/src/components/manager/`
- Extend `frontend/src/lib/api/billing.client.ts`, types, and fixture API
- Tests `frontend/src/components/manager/*test.ts` as appropriate; extend `frontend/e2e/manager.spec.ts`

**Behavior:** proof status and signed preview; approve/reject actions with confirmation and bounded reason; explicit cash confirmation; paid state remains manager-controlled; stale/retry state reloads safely; no raw object keys. Preserve existing QR and invoice arithmetic UI.

**Tests:** fixture-backed approve/reject/cash flows; repeated action idempotency; error banners; missing proof; signed URL failure; mobile layout and focus.

## Task 9: Add fixture-backed full renter flow and docs

**Files:**
- Modify `frontend/e2e/fixtures/api.ts`
- Create/modify `frontend/e2e/renter-portal.spec.ts`
- Modify `docs/full-flow-test-plan.md`
- Modify `docs/frontend-ui-specs.md` built/deferred table
- Modify `docs/api-contract.md` with final live shapes
- Modify `docs/testing-strategy.md` layer ownership

**Flow:** manager creates/opens renter link → renter exchanges once → sees invoice and QR → submits one image → manager sees proof → rejects → renter replaces once → manager approves → invoice paid; separate cash confirmation path; push success/fallback fixture path; foreign tenant attempts return 404.

**Tests:** retain fixture server; real provider/storage smoke only behind explicit QA credentials. Do not claim external ZNS/ZBS delivery in fixture tests; SMS is not exercised in MVP.

## Task 10: Verification, security review, and rollout

**Commands, sequentially:**

1. `cd backend && bun run typecheck`
2. Explicit backend tests one file at a time against disposable `TEST_DATABASE_URL`: payment schema, upload, payment proof, race, renter auth/portal/isolation, push/notification integration.
3. `cd frontend && bun run typecheck`
4. `cd frontend && bun run lint`
5. `cd frontend && bun run build`
6. `cd frontend && bun run test`
7. `cd frontend && bun run test:e2e` (report missing Chromium OS libraries; do not bypass)
8. `git diff --check`
9. Run `/review-security` and `/review-code` against uncommitted docs/code before commit.

**Rollout:** additive migration; deploy adapters/config disabled; verify private storage and fake push/ZNS/ZBS; enable renter reads; enable proof upload; enable manager review/cash; enable push-first notification events; retain manual link/QR fallback. Rollback disables new route/event creation without deleting proof evidence or changing invoice financial state.

## Completion criteria

- Every route and state documented with exact response/error shape.
- DB enforces one current proof per invoice and all tenant/FK/check constraints.
- Renter cannot mark invoice paid or access foreign invoice/proof/subscription.
- Manager approval/cash confirmation are the only paid transitions and are race-safe/idempotent.
- Uploads are private, byte-validated, size-limited, and never expose object keys.
- Web Push primary with ZNS/ZBS fallback, bounded/idempotent and redacted; SMS excluded from MVP.
- Mobile PWA works without push permission and passes required viewport/accessibility checks.
- Verification commands and security/code reviews pass or blockers are recorded precisely.
