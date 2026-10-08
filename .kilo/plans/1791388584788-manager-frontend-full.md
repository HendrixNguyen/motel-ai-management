# Sub-project 5 — Manager Frontend and Backend Readiness Plan

**Goal:** Deliver manager UI for existing motel, room, renter, billing, and contract APIs; add auditable paper-contract activation so newly created contracts can become billable before Zalo delivery exists. Ticket, Zalo delivery, renter portal, and capture PWA remain separate sub-projects.

**Starting state:** M1–M4, login, shell, API client, and UI kit already exist; audit rather than rebuild. Billing routes are mounted in `backend/src/app.ts`; contract routes are mounted but sub-project 4 DB tests were previously blocked. Current frontend Task 5-only plan at `docs/superpowers/plans/2026-10-08-manager-frontend-task-5.md` is an audit input, not the full sub-project scope. Preserve unrelated worktree changes.

## Decisions and boundaries

- Session and tenant scope stay server-derived; browser uses relative `/api/*` through same-origin proxy. Motel selection remains `?motel=<uuid>`; foreign IDs return 404 before scoped reads.
- Money stays digit strings throughout API and UI; use existing formatters, never floating-point arithmetic for VND totals.
- Manager **Gửi hợp đồng** remains disabled with clear “Chưa kết nối Zalo”; never invoke a guaranteed-failing notification seam. Renter OTP signing remains unavailable until Zalo delivery is wired. Do not set `otpSignedAt` for paper signatures.
- Manager may activate a **draft** contract only with a signed-paper proof: 1–3 PDF/JPEG/PNG files, ≤10 MB each; server checks size, declared MIME, and file signature before uploading through backend to private R2. Manager supplies actual `paperSignedAt` calendar date (not future); server stamps `activatedAt` and `activatedByManagerId`. Proof files immutable after activation. Draft proof can be removed/replaced; delete corresponding R2 objects. Signed URLs are short-lived and issued only after manager-tenant or owner-renter session checks. R2 outage disables only proof upload/activation, not contract reads/draft management or billing.
- M5/M6 uses `/billing` period list/create entry, then `/billing/[periodId]` readings and `/billing/[periodId]/invoices`. `POST .../send` only locks period; label **Chốt kỳ (chưa gửi Zalo)**, require confirmation, never claim notification sent.
- M6 renders scannable VietQR from `qrCodeData`; inspect existing deps first, add minimum QR dependency only if needed, with ADR. Join renter names from one renter-list request; no billing DTO expansion solely for display.
- M1 adds expected revenue and unsettled amount from latest **sent** period, labeled month/year; omit financial measures if no sent period. Ticket measure remains absent. Only navigation backed by live routes appears; settings via motel editor until dedicated settings API exists.

## 0. Confirm sub-project 4 and reconcile documentation (blocking)

1. Inspect merged contract routes, DTOs, migrations, status transitions, OTP sender default, docs, and tests. Record exact implemented/deferred/untested states in a new progress section of `docs/superpowers/plans/2026-10-07-contract-management.md`; do not retroactively mark historical RED runs/checks complete.
2. Reconcile `docs/api-contract.md`, `docs/frontend-ui-specs.md`, and `docs/superpowers/specs/2026-10-07-contract-management-design.md` with *actual* routes and responses. Resolve duplicate contract sections, singular/plural renter paths, signing result shape, `otpSentAt` versus manager send, and OTP exhaustion code. Explicitly mark ticket/settings/Zalo routes as planned if not mounted. Define FE request/response/error shapes before FE code.
3. Verify local `TEST_DATABASE_URL` points at disposable PostgreSQL, `SKIP_DB_RESET` unset, and no parallel DB test process. `resetDb()` drops schemas. Run backend typecheck and explicit contract-template, contract, signing, schema-constraint, tenancy, renter, room, and billing tests **one file at a time**. Repair real defects/fixtures (contract signing test currently inserts nonexistent FK IDs at `backend/src/test/contract-signing.test.ts:15-20`); record exact pass/fail or environment blocker. Do not use QA DB for schema reset.
4. Gate contract FE writes on passing relevant local BE tests and reconciled docs. If DB auth remains unavailable, continue only unrelated UI audit/billing planning; no claim that contract behavior was verified.

## 1. Paper-signature backend extension (separate reviewed slice)

1. Update owning design spec, API contract, frontend UI spec, testing strategy, ADR for paper consent/evidence and private R2 storage, and `.env.example` before changing behavior. Define manager upload/remove/activate, manager and renter proof-access API shapes, response metadata, error codes, retention, and signing method (`otp` versus `paper`). Existing OTP contracts remain readable; migration/backfill preserves records.
2. Add contract-owned proof metadata table or equivalent constrained schema, unique object keys, FK to contract, content type/size, created timestamp; add `paperSignedAt` (`DATE`), `activatedAt`, `activatedByManagerId` and explicit signing method to contracts as needed. Add migration and `backend/src/db/test-db.ts` table list. Database constraints enforce proof bounds and active-room uniqueness; application transaction enforces draft-only activation and nonempty uploaded proof.
3. Implement private R2 adapter and backend multipart upload. Require manager session and motel ownership; stream/limit bytes, inspect file signature, allow only PDF/JPEG/PNG, cap three per draft contract. Never expose credentials/object keys as public URLs. Draft deletion removes metadata and R2 object with retry/compensation on partial failure; activation atomically locks contract/proof state, stamps server metadata, maps active-room uniqueness race to `409`, and leaves OTP fields untouched. After activation deny proof mutations. Renter proof read checks renter session ownership. Signed download URL TTL: five minutes, no public bucket.
4. Test real-DB constraints and HTTP tenant isolation in both manager/renter directions; invalid MIME/magic/size/count, R2 outage/partial failure, draft-only activation, concurrent activation, immutability, paper date bounds, OTP versus paper metadata, and billing from newly active paper contract. Use fake R2 adapter for deterministic tests; read-only integration smoke against configured R2 only when available. Security review required before FE upload integration.

## 2. Frontend foundation audit, not rewrite

1. Audit existing login, server session guard, `getMe`/motel list reads, logout, URL selection, zero-motel state, four existing nav destinations, loading/error/not-found, mobile keyboard/focus/overflow. Keep correct code; add missing tests only. Use `docs/superpowers/plans/2026-10-08-manager-frontend-task-5.md` for detailed acceptance scenarios.
2. Extend existing typed API client with billing and contract reads/mutations in separate server/client modules. Validate numeric strings at boundary, preserve non-2xx envelope, and keep `BACKEND_URL` server-only. Add fixture types and contract tests for every consumed field/error. Read relevant installed Next 16 docs before modifying App Router code.
3. Expand nav only as each new route ships: **Tính tiền & Hóa đơn** and **Hợp đồng**. Mobile retains ≤5 primary destinations; put overflow in labeled secondary menu. No dead ticket/settings/Zalo links.

## 3. Billing UI

1. `/billing?motel=`: list periods sorted by year/month; create month/year with duplicate `409`, empty/error/loading states. Scope all reads to selected owned motel.
2. `/billing/[periodId]?motel=`: show period, room readings, prices, active-contract availability, and live usage/charge preview. Edit draft readings only; send atomic batch with each row's `expectedUpdatedAt`. On `READING_CONFLICT`, show current server row and require deliberate reload/re-entry; sent/closed periods read-only. No unsupported photo upload affordance. Generation shows `details.skippedRooms`, including unsigned draft contracts. Do not fabricate totals before invoice generation.
3. `/billing/[periodId]/invoices?motel=`: show itemized invoice details and QR from actual `qrCodeData`, payment state, manual paid/overdue transitions with confirmations and idempotent refresh. Join renter display data once; missing renter falls back safely. Chốt kỳ action states explicitly that no Zalo message is sent; sent/closed controls disabled. No copy-magic-link or resend-Zalo action unless backed by correct API.
4. Update M1 financial measures from latest sent period's invoice list using exact VND string arithmetic and spec-defined unpaid/overdue rules. Distinguish no period, no invoices, and read failure; never show fabricated zero on failure.

## 4. Contract UI

1. `/contracts?motel=` lists contracts by status, including draft, active, expiring within 30 calendar days, expired, terminated; reads details/clauses, dates, rent, deposit, signing method/metadata. Avoid labeling paper activation as OTP signature.
2. `/contracts/templates?motel=` manages templates and default marker. Clause builder supports add/edit/reorder/remove, preview, validation, referenced-template `409`, and snapshot explanation. Use manager-scoped APIs only.
3. Draft create/edit validates renter and room belong to selected motel, dates, VND strings, selected/default template and clauses; show 404/409/validation errors without losing form state. Active-only termination requires confirmation. **Gửi hợp đồng** disabled until Zalo integration.
4. Paper activation UI uploads draft proof, shows progress/errors, allows removal before activation, records actual paper signing date, requires explicit confirmation, and shows signed proof via authorized short-lived links. Block activation when upload missing/fails or R2 unavailable; never leak object keys or render unsafe URLs.

## 5. Verification and delivery gates

- Backend: `bun run typecheck`, then explicit affected `bun test src/test/<file>.test.ts` sequentially on disposable local DB. Never run concurrent schema-reset tests; no destructive QA test runs.
- Frontend: `bun run typecheck` → `bun run lint` → `bun run build` → `bun run test` → `bun run test:e2e`. Fixture-backed Playwright covers auth, motel switching, billing lifecycle/conflicts/QR, contract template and paper signing flows, keyboard/mobile ≤375px, and failure states. Browser OS dependencies may block E2E; report exact failure rather than passing. Add gated real-stack smoke only after local BE tests and R2 setup pass.
- Run security/code review on uncommitted changes (tenant isolation, upload, OTP/paper evidence, money), fix findings, rerun affected checks. Preserve existing untracked files; no deployment, commit, push, or PR without explicit current authorization.

**Rollout:** Apply additive migrations before enabling paper activation; deploy backend and confirm storage privately configured, then publish FE. Keep paper activation disabled if R2 health/config fails. Existing active OTP contracts remain unchanged. Zalo sender and renter portal delivery remain sub-projects 8 and 7.
