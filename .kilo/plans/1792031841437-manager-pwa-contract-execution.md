# Manager UI, Payment PWA, and Consent Signing Execution Plan

**Goal:** Complete three existing workstreams, prioritizing broken dropdowns and missing upload flows; replace OTP signing with explicit authenticated renter consent.
**Baseline:** Earlier source audit used `qa` commit `6152b3c`; recheck before execution. No fresh runtime verification or PR merge claim.
**References:** Existing renter-payment and contract plans under `docs/superpowers/plans/`, `docs/api-contract.md`, `docs/frontend-ui-specs.md`, `docs/testing-strategy.md`.

## Approved scope

- Quiet Ledger manager redesign: canvas #F3F6F8, white surfaces, ink #172B3A, teal #087E8B, accent #E9B949, danger #C84B4B, border #D8E1E6, navy shell. Preserve light/dark/system, accessible contrast and existing workflows.
- Payment-first renter portal with separate contract signing route; preserve signing links. Tickets unchanged.
- Signing uses authenticated `renter_session` established by single-use magic-link exchange, explicit consent checkbox and final confirmation. No OTP request, delivery or verification for new signing.
- This replaces the earlier OTP encryption/retry work. Do not add OTP encryption keys, encrypted OTP queue or resend machinery. Retain historical signing evidence.
- Web Push for payment updates; ZNS/ZBS for activation and applicable notification fallback, not signing OTP. No OA sending or SMS. Provider credentials/templates unavailable; real fallback delivery remains gated, but consent signing does not depend on it.
- A bearer link/session can be used by anyone possessing it. This flow records authenticated consent, not independently verified identity or a certified digital signature. Legal sufficiency is not established; legal assessment before relying on it for enforceable electronic rental agreements is outside engineering acceptance.
- Preserve implemented payment-proof/cash APIs, contracts/templates and clause snapshots. No wholesale rebuild from unchecked historical plans.
- Plan-only change now. No automatic commits, production deployment, destructive reset, unrelated cleanup or dependency additions. New dependencies require ADR and need assessment.

## 1. Baseline and shared contracts

**Files:** owning design/API/UI/testing documents during implementation; contract, notification, renter and payment modules; current callers/tests.

- [ ] Recheck clean/dirty state, branch SHA and existing implementation; preserve unrelated changes. Audit supported upload APIs before designing callers; no guessed upload endpoints.
- [ ] Update owning specifications to supersede OTP signing requirements, distinguish consent from delivery, document separate signing route and approved palette. Correct stale claims about missing manager contract UI.
- [ ] Define additive `POST /api/renter/contracts/:contractId/consent` contract before implementation: authenticated renter, `{ consent: true, termsVersion: string }`; server-generated version identifies immutable reviewed terms, including financial terms, dates, parties and clauses. Response uses existing contract representation with consent method/timestamp/version evidence. Extend renter contract read to supply version. Current API route exists; plan aligns to `/consent` not `/sign`.
- [ ] Document foreign contract 404, invalid consent 400, expired session 401, changed/ineligible contract 409. Same renter/version retry after successful consent returns original result without duplicate evidence; a different version does not overwrite it.
- [ ] Establish baseline typechecks and focused tests. Reset/migration tests use disposable isolated DB, never QA. Missing tooling/credentials are blocked gates, not passes.

## 2. Fix dropdown and upload usability before redesign

**Files:** `frontend/src/components/ui/dropdown.tsx`, `file-upload.tsx`, actual callers including manager renter editor/detail, renter payment-proof panel, capture upload controls; existing shell/form E2E specs. Backend renter/storage boundaries only if required for missing CCCD upload capability.

**Evidence:** dropdown currently has selection-close at lines 97/105, outside mousedown at 40–54, Escape at 50–54. Earlier claim these handlers were absent was incorrect. Absolute menu at line 95 suggests clipping risk, not confirmed root cause. Native file inputs elsewhere are valid implementations, not proof upload is missing.

- [ ] Reproduce user-reported truncation and failure to close in actual callers, including dialogs/sheets, touch devices and motel changes. Record route/viewport and add failing browser regression before fix.
- [ ] Ensure every option is reachable through bounded scrolling; long labels readable, no ancestor clipping or viewport escape. Selection, outside pointer interaction and Escape close reliably; keyboard selection/focus return work. Controlled external value changes must not leave stale menus open. Preserve expected focus for outside clicks.
- [ ] Use native select where suitable, otherwise existing installed accessible primitive. Do not blindly add a body portal: native modal top-layer/focus handling must remain correct. Keep existing caller API where feasible.
- [ ] Audit visible upload entry points for CCCD front/back, payment proof and meter photos. Add missing CCCD controls to manager renter create/edit/detail flow using authorized APIs. Existing capture/payment uploads retain behavior; no unrelated ticket redesign.
- [ ] CCCD images remain private: session ownership on write/read, verified image bytes/MIME and documented resource-specific size limit, short-lived authorized previews, no arbitrary client URL assignment. If API is missing, implement minimal renter-owned upload service/routes with storage seam and HTTP tenant tests before UI integration. Preserve old image until replacement succeeds and clean failed uploads safely.
- [ ] Upload controls expose selected filename/preview, progress or pending state, actionable errors, retry and safe replacement. Canceling file picker preserves selection; reselecting same file works; revoke local preview URLs. No sensitive filenames/image content in diagnostics.
- [ ] Enforce approved resource limits in section 2A and reconcile owning API specifications during implementation. Test exact boundary, oversized/invalid content, cancel, network failure, replacement and persistence after reload.

### 2A. Shared upload button and drag-and-drop section — explicit deliverable

**Approved role/resource matrix:**

| Role/screen | Images | Limit per image | Behavior |
|---|---|---|---|
| Manager renter create/edit/detail | CCCD front + back, separate slots | JPEG/PNG, 5,000,000 bytes | Create renter first; upload against persisted renter; incomplete uploads remain clearly marked |
| Renter separate contract onboarding | Own CCCD front + back, separate slots | JPEG/PNG, 5,000,000 bytes | Both required before signing, not before ordinary renter record creation |
| Manager meter capture | One current image per reading | JPEG/PNG, 10,485,760 bytes | Preserve capture queue and draft-period restrictions |
| Renter invoice payment | One current proof | JPEG/PNG, 5,000,000 bytes | Preserve rejection/replacement and paid/pending restrictions |

Existing ticket upload UI and its limits unchanged. No general file library, PDFs, SVG, HEIC conversion or manager payment-proof upload.

- [ ] Extend existing `frontend/src/components/ui/file-upload.tsx` into reusable image selector/dropzone with explicit `accept`, `maxBytes`, disabled/pending/error and selection callbacks; domain callers own upload requests and resource policy. Do not add a dropzone dependency.
- [ ] Every slot has visible Vietnamese upload button, desktop drag-and-drop area, mobile image picker/camera access, format/size help and preview. Native file input remains keyboard/screen-reader accessible; drag-and-drop is optional, never sole input method. Dragging an image over the area highlights it; dropping outside must not unexpectedly navigate away in the upload surface.
- [ ] File picker and drop use identical validation. Reject multiple files in single-image slot explicitly rather than silently taking first; reject unsupported types/oversize before requests and validate again server-side. Handle empty drop, directory drop and canceled picker safely.
- [ ] Show selected/uploading/saved/error states, retry and replace controls. Use indeterminate uploading state unless actual byte progress is measured; no fabricated percentages. Selecting a replacement does not erase saved image; only successful server response updates persisted preview. Revoke local object URLs. Clear unsaved selection on resource/account switch without submitting it elsewhere.

### 2B. Real private R2 persistence — backend and integration deliverable

**Files:** `backend/src/shared/storage.r2.ts`, backend composition/config and env example during implementation; existing billing/payment/ticket storage injection seams; renter module/schema/routes; new additive migration and reset wiring; frontend manager/renter upload callers.

**Audit evidence:** R2 adapter exists, but billing/payment/ticket services default to `FakeStorageAdapter`; no runtime wiring found in `src/app.ts` or `src/index.ts`. CCCD currently has URL fields, not authorized upload APIs. Verify current state before edits.

**Data flow:** browser same-origin multipart request → backend session/ownership and byte validation → private R2 `put` → committed metadata → authorized read issues signed download URL (300 seconds) → browser preview. No browser R2 credentials, public bucket or direct browser presigned PUT in this scope.

- [ ] Wire configured R2 adapter into all existing runtime storage seams; fake storage available only through explicit test injection. Non-test storage must never silently report fake upload success. Missing configuration produces explicit unavailable upload state/error; validate secrets without printing them. Keep existing ticket behavior while replacing its runtime storage adapter.
- [ ] Specify additive manager CCCD upload/read endpoints under owned motel/renter and renter endpoints under session-derived own identity. Each request selects validated `front` or `back` slot and multipart `file`; never accepts arbitrary renter identity for renter self-service. Document exact routes/types in API contract before implementing callers. Use renter-owned service exports for contract readiness checks.
- [ ] Persist opaque private object keys and validated MIME/byte metadata, not client URLs or signed URLs. Add constraints/tenant HTTP tests. Do not fetch or trust legacy arbitrary URL fields as verified uploaded identity images; retain historical records and require valid re-upload when legacy provenance cannot be established.
- [ ] Enforce two valid CCCD slots before new consent signing on server and UI. Historical active contracts remain unchanged. Prevent arbitrary JSON URL updates from bypassing upload/readiness validation. Keep signature evidence tied to documents/terms accepted; later replacements must not rewrite historical signing evidence or delete referenced objects.
- [ ] Upload before metadata replacement; transactionally claim current slot and clean unreferenced new object on DB failure. Keep old object until replacement commit and only delete if unreferenced by current or historical records. Bound upload requests and handle proxy/multipart limits without broad global increases. No changes to existing accepted-proof retention rules.
- [ ] Verify/fix meter upload multipart mismatch: frontend sends `file`, route currently declares bare `t.File`. Add actual multipart integration regression. Ensure route/parser limits agree with each resource's exact byte limit.
- [ ] Validate R2 persistence with dedicated QA objects: upload via manager/renter UI, reload, restart backend, obtain fresh authorized preview, verify denied cross-tenant reads and expired signed URL refresh. Use no real identity documents in tests. R2 credential/bucket availability is an explicit integration gate; mock tests cannot satisfy it. Never expose signed URLs, object keys, image bytes or credentials in reports.

**Exit:** dropdown browser regressions pass at 360/375/430/1280px; both roles have visible upload buttons/dropzones; CCCD, meter and payment images persist privately in R2 with correct ownership and limits. Report real R2 acceptance as blocked if configuration is unavailable.

## 3. Explicit consent signing without OTP

**Files:** `backend/src/modules/contract/contract.{route,service,schema,types}.ts`, additive migration/reset wiring, contract tests; `frontend/src/components/renter/contract-actions.tsx`, renter contract page and API caller.

**Flow:** manager prepares contract and shares existing activation/signing link → renter exchanges link for session → reads exact contract → checks consent → confirms signing → server atomically records evidence and activates eligible draft → UI reloads canonical contract.

- [ ] Add failing HTTP/service tests for unchecked/missing consent, foreign renter, expired session, stale version after manager edit, terminated/expired/ineligible draft, double click, concurrent requests, active-room constraint conflicts, and repeat successful request.
- [ ] Generate contract version server-side from persisted revision or canonical terms digest; never trust a client-provided hash as authoritative. Manager edits change version. Persist accepted immutable terms snapshot/version, renter/contract identity, server acceptance timestamp and consent text/version with method `session_consent`. No session token storage or unnecessary device tracking.
- [ ] Under transaction/row locking, validate session-derived ownership, draft eligibility, authoritative terms version and existing legal/business readiness checks; record consent and activate once. Retain active-room uniqueness and rollback evidence if activation fails. Retry original successful consent returns original evidence; manager-created active contracts without renter consent must not be misrepresented as signed.
- [ ] Apply existing same-origin/CSRF protections to new state-changing route. Page view, checkbox toggle or magic-link exchange alone never signs a contract.
- [ ] Replace OTP controls with unchecked consent and explicit final confirmation. Reset consent after terms/version changes; stale conflict reloads terms and requires consent again. Session expiry requires fresh login/link; never auto-submit signing after reauthentication. Show signed state only from server response.
- [ ] Disable legacy OTP request/verify mutations in coordinated rollout with explicit obsolete-flow response; invalidate pending OTP jobs without replay. Keep historical OTP-based audit/method intact; do not drop columns or rewrite past evidence in initial release. Preserve old deep-link entry points.
- [ ] No provider send required for consent activation. Any optional post-sign notification failure does not undo successful consent; use existing outbox transaction boundaries if event already required.

**Exit:** local/QA consent signing works without ZNS/ZBS, OTP secrets or delivery configuration; immutable evidence and concurrency/tenancy tests pass.

## 4. Renter payment PWA and truthful notifications

**Files:** notification schema/routes/service and tests, backend composition/config, portal layout/pages/payment-proof panel, renter manifest/service worker integration.

- [ ] Define tenant-scoped subscription registration/removal from renter session. Validate endpoint/keys/length, prevent cross-account reassignment and outbound SSRF: HTTPS, approved push-provider policy, reject local/private destinations and unsafe redirects; bounded requests and no secret logging.
- [ ] Add explicit opt-in, unsupported/denied non-fatal state, logout/account-switch subscription isolation, invalid-subscription cleanup. Use generic non-sensitive text and same-origin notification navigation.
- [ ] Renter manifest/service worker must coexist with capture scope. Cache static shell only, never invoices, private images, CCCD, signed URLs, activation tokens or authenticated responses. Offline UI must not leak previous renter data.
- [ ] Preserve event-key deduplication, bounded retry/leases and truthful queued/accepted/failed states. Disable new OA selection; preserve legacy audit without automatic replay. Push acceptance is not a read receipt; fallback only for ineligible or terminal push failure, not absence of reads.
- [ ] Refresh canonical invoice and proof status after external approve/cash and on focus; terminate polling appropriately. Recover expired signed previews through fresh authorized reads.
- [ ] Test permission denial, expired session, shared-device switch, offline/restart, invalid endpoint, duplicate events and pending/rejected/replaced/approved/cash transitions. Provider timeout ambiguity must not cause blind duplicate paid fallback sends.

**Provider gate:** no account/templates currently available. Inspect official API and idempotency/reconciliation capability before real ZNS/ZBS adapter. Activation links are bearer secrets: no plaintext persistence/logging or process-local durable retry assumption. Define secure link generation/delivery lifecycle as prerequisite to enabling automatic activation delivery; manual manager sharing remains available. Stop for approval if provider requires prohibited OA sending. Never claim real device/fallback delivery from mocks.

## 5. Quiet Ledger integration

**Files:** `globals.css`, shared UI primitives, manager shell/sidebar/top-bar, existing dashboard/meter/invoice/contract components and E2E specs.

- [ ] Read installed Next.js guides; reuse current dependencies and semantic tokens. Apply foundation/shell first, then dashboard → meter workflow → invoice/QR/review → contracts. Work may run alongside backend signing once contracts are frozen; avoid shared-file conflicts.
- [ ] Preserve theme selection, 44×44px targets, contrast, reduced motion, keyboard navigation and mobile safe areas. Use mobile sheets/desktop dialogs with correct focus and visible content.
- [ ] Preserve motel selection/query context, manager/motel capture queue isolation and conflict recovery. Do not add speculative dashboard APIs or missing-feature placeholders.
- [ ] Confirm approve/reject/cash intent, require rejection reason, disable duplicate submissions and refresh after conflicts. Retain exact invoice arithmetic, template snapshots and contract lifecycle rules.
- [ ] Verify 360/375/430/1280px, long Vietnamese content, zoom, light/dark/system, empty/loading/error states, scroll and focus restoration. Compare available Stitch reference; absent reference means no claim of exact visual parity.

## 6. Validation and rollout

- [ ] Per task: failing regression → minimum fix → focused passing checks. Backend typecheck then explicit test files sequentially against isolated DB; never concurrent reset tests. Migration suite blocked if required `MIGRATION_TEST_ADMIN_URL` absent.
- [ ] Frontend gates in order: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e`. Record coverage using installed supported Bun/Vitest tooling; missing coverage instrumentation is explicit blocker, not inferred from test count.
- [ ] Real QA uses existing fail-closed gates and unique records, separate invoices for rejection/replacement, approval and cash. Cover upload/reload, dropdown pointer/keyboard, no-OTP signing/stale terms/session expiry and real responsive geometry. No broad cleanup, schema reset or sensitive artifacts.
- [ ] Security/code review: consent integrity, tenant authorization, CSRF, private uploads, subscription SSRF, legacy OTP retirement, module boundaries and spec consistency.
- [ ] Rollout when authorized: additive schema → backend compatible reads/new consent route → frontend consent UI → disable legacy OTP mutation/retry path in coordinated release. Pause signing if deployments cannot be coordinated; never allow old OTP and new consent paths to create contradictory evidence. Rollback only to compatible release or disable signing, never erase accepted evidence.
- [ ] Record SHA/date, exact commands, counts, coverage, blocked provider gates and retained QA records. Inspect diff and run `git diff --check`. Commit/deploy only on explicit request.

**Completion:** UI defects, upload flows, payment PWA and no-OTP consent signing pass their gates independently of unavailable ZNS/ZBS. Real provider delivery, production deployment and legal certification remain outside initial completion. Implementation has not started.
