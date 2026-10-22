# Frontend rebuild — research-backed plan

**Status:** Planning only. No implementation, installation, commit, deployment, or backend change authorized. This revision replaces the earlier speculative task list. Delivery contract and visual approval gates below must be resolved before execution.

## 1. Confirmed brief

- Rebuild all three surfaces: manager, on-site capture, renter portal. Existing visual implementation is disposable; tested domain behavior, security boundaries, links and data are not.
- Deliver manager workflows first, then capture and renter surfaces, on one shared component/token foundation.
- Radix primitives and Lucide React approved. Add only packages actually used; preserve existing component props where practical instead of migrating every caller unnecessarily.
- Light and Dark have equal acceptance criteria. Default to OS preference; persist explicit Light / Dark / System choice using existing `motel-theme` key.
- Room inspection opens URL-synced drawer, preserving list context and browser navigation.
- Bulk invoice delivery with progress and per-row copy fallback requested. **Current API cannot supply delivery progress; see decision gate in §4.** Approval of that UX does not imply approval to change backend contracts or reintroduce Zalo OA.
- Vietnamese interface; Next.js 16.3.8, React 19.2.8, Tailwind v4, Bun. No framework rewrite needed to achieve a new design.

## 2. Baseline and research

Current worktree on 2026-10-11: `qa`, modified `backend/src/db/seed.ts`, this untracked plan. This supersedes the earlier dark-mode-branch/staged-payment snapshot. Do not stage, revert, or overwrite unrelated work. Recheck status and baseline immediately before implementation.

### Verified corrections to previous draft

| Previous assumption | Evidence / correction |
|---|---|
| `/send` supplies sent/failed counts | `backend/src/modules/billing/billing.service.ts:197-213` finalizes period, attempts notification enqueue, returns `BillingPeriodResponse`. Enqueue errors are swallowed; success proves neither enqueue nor delivery. |
| Cash endpoint includes period and `/confirm-cash` | `backend/src/modules/payment/payment.route.ts:22`: `POST /api/manager/motels/:motelId/billing/invoices/:invoiceId/cash-confirmation`, no date/note request body. |
| Generic mark-paid still usable | `backend/src/modules/billing/billing.route.ts:23` returns 410 for old `/paid`. Use cash confirmation or proof approval. |
| Manager maintenance drawer supported | `backend/src/modules/ticket/ticket.route.ts:13-15` exposes renter-only ticket operations. No manager ticket reader/update endpoint verified. Do not use renter session as manager fallback. |
| URL `replace` makes Back close drawer | Opening must push a history entry. Replace is for changes within the open drawer or direct-link dismissal. |
| Room search query is `q` | Existing `frontend/src/lib/room-query.ts:12-26` uses `search`, `floor`, `status`, `motel`. Preserve these links. |
| Capture exports `getQueue/enqueueReading/markSynced` | Actual API is `CaptureQueue(managerId)` with `enqueue`, `enqueuePhoto`, `list`, `listPhotos`, `update`, `updatePhoto`; `clearCaptureQueue` is exported separately. |
| Capture isolation can be assumed | `capture-reading-client.tsx:14-20` uses literal `"browser"` identity. Requires authenticated manager scoping and cross-motel sync tests before capture release. |
| `bun test` runs frontend unit harness | `frontend/package.json:11` maps `bun run test` to Vitest; use `bun run test <file>`, not Bun's native test runner. |
| E2E already covers both themes/desktop | `frontend/playwright.config.ts:31-51` declares one mobile fixture project and gated real-stack project. Explicitly add theme/desktop coverage. |
| Real-stack command is ready | `playwright.config.ts:63` hardcodes fixture backend and port even in real-stack mode. Correct harness routing before claiming real-backend validation. |
| Stitch palette is automatically accessible | Normal text requires measured 4.5:1. Prior bright success/warning text and pale control borders cannot be labelled compliant without tests. |

### Research informing decisions

- [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): test ordinary content at 320 CSS px; table exceptions do not excuse overflowing surrounding controls.
- [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): AA minimum is 24 CSS px with exceptions; this product deliberately targets 44×44 CSS px controls, 48px capture action.
- [W3C financial error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html): review/check critical financial actions; do not add confirmations to every ordinary save.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): announce meaningful save/sync/payment results without moving focus or announcing each typed digit.
- [NN/g dashboard guidance](https://www.nngroup.com/articles/dashboards-preattentive/): prioritize information supporting decisions, not ornamental chart grids.
- [web.dev INP](https://web.dev/articles/inp) and [CLS](https://web.dev/articles/cls): field targets INP ≤200ms, CLS ≤0.1 at p75, segmented mobile/desktop. Lab results are not field evidence.
- Existing Stitch project `3036971879990930028`: M1 `972bca210d024447a03b735d7070c9bc`, M2 `5e01d7068aaf426bad892e4fa2e08dc0`, M5a `69342f6394e54914bc4f0bc468b9c6c1`, R2 `85f33053370a42c4bc9117b33a022456`. References for composition, not API authority or mandatory tiny controls/hover actions.
- Local owning references: `docs/frontend-ui-specs.md`, `docs/api-contract.md`, `docs/testing-strategy.md`, `docs/superpowers/specs/2026-10-09-renter-payment-pwa-design.md`.

No live browser audit or user usability study performed in this planning pass. UI/UX skill search script was permission-blocked; recommendations use its readable guidance and cited sources, not claimed search results.

## 3. Proposed design direction and acceptance gate

**Recommendation: task-first operational workspace**, not another cosmetic pass. Distinct room/floor directory, aligned invoice ledger, receipt-like renter bill, and distraction-free meter entry. One primary action per task; lower visual emphasis for summaries and secondary controls.

Alternatives considered: pixel-copy Stitch (fast visual target, but inherits unsupported features and small controls); rewrite stack and all domain logic (higher regression exposure without demonstrated UX benefit). Use new presentation over verified integration boundaries instead.

### Visual system proposal — not yet visually approved

- Keep Nhà Số Gọn identity. Proposed one-family Inter with Vietnamese subset; compare against existing Be Vietnam Pro/Noto Sans in reference mockups before replacing fonts. No guessed Napas/bank logos.
- Base body/input 16px, supporting labels 14px, headings 20/24/32px. Monetary values never truncated; tabular figures and right alignment. Long names wrap or have accessible expansion.
- Spacing 4/8/12/16/24/32px; controls 8px radius, panels 12px, status pills only when helpful. No repeated floating KPI cards, decorative gradients, or animated dashboards.
- Motion limited to feedback and overlay transitions, approximately 120–180ms. Reduced-motion disables spatial transitions; no new animation dependency.
- Candidate semantic token pairs below replace unverified low-contrast draft values. Validate actual text/background and focus/control combinations before acceptance; do not call palette verified yet.

| Role | Light | Dark |
|---|---|---|
| canvas / surface / raised | `#F8FAFC` / `#FFFFFF` / `#F1F5F9` | `#0F172A` / `#1E293B` / `#334155` |
| text / body / muted | `#0F172A` / `#334155` / `#475569` | `#F8FAFC` / `#E2E8F0` / `#CBD5E1` |
| primary / on-primary | `#0369A1` / `#FFFFFF` | `#38BDF8` / `#0F172A` |
| primary hover / on-primary | `#075985` / `#FFFFFF` | `#7DD3FC` / `#0F172A` |
| divider / control boundary | `#E2E8F0` / `#64748B` | `#334155` / `#94A3B8` |
| success text / background | `#166534` / `#DCFCE7` | `#86EFAC` / `#14532D` |
| warning text / background | `#92400E` / `#FEF3C7` | `#FDE68A` / `#78350F` |
| danger text / background | `#991B1B` / `#FEE2E2` | `#FCA5A5` / `#7F1D1D` |
| QR ink / paper, both themes | `#000000` / `#FFFFFF` | `#000000` / `#FFFFFF` |

Add explicit on-primary, focus, disabled, selected, overlay and QR tokens; do not use surface color as button text. QR paper is a semantic invariant, not a raw-color exception scattered through JSX. Keep matrix and quiet zone white/black; surrounding bank details follow active theme. Real QR payload comes from API, never generated artwork.

**Visual gate:** approve representative manager overview, room drawer, capture entry, renter invoice at 375px and 1280px in both themes before migrating all screens. Include empty/error/long-content samples, not only ideal data. Separate screenshot comparison from functional acceptance. Current proposal does not make old Stitch or remembered Quiet Ledger palette an automatically approved target.

## 4. Scope boundary and unresolved delivery decision

### Included without new backend contracts

Existing auth, motel/room/renter workflows, billing period/readings/invoices, payment-proof review and cash confirmation, capture, renter bills/payments. Preserve current contract/signing and renter ticket routes during rebuild; completing additional contract-management actions uses verified existing endpoints, with no new domain states.

### Explicitly excluded from initial frontend release

Manager ticket administration/tab until manager-scoped endpoints exist; P&L/cashbook reporting; global search service; bank auto-reconciliation; notification secret configuration; new payment methods; new due-date or `Sắp trả` room status. Existing bank/rate settings remain under motel editor rather than duplicating `/settings`.

### Decision required: requested bulk delivery

Backend has no verified manager delivery-status/retry API. `/send` is a finalization operation and cannot be repurposed as a resend button. Notification implementation still contains legacy OA/ZNS routing, while prior product direction removed OA. Actual channel availability must be settled separately, not inferred from a Zalo label.

**Recommended initial release:** show `Chốt kỳ hóa đơn`, successful period-finalization state, and per-renter `Sao chép liên kết` fallback through existing magic-link action. Never show fabricated sent/failed totals, percentage progress, or `Đã gửi qua Zalo`. Preserve requested bulk delivery as a separately specified backend dependency.

**User decision (2026-10-11): include backend delivery in planning scope.** The frontend-only release option above is retained as a fallback, not the selected scope. Add a separate backend delivery workstream defining enabled channels (no implicit OA), authenticated tenant-scoped enqueue/status/retry endpoints, delivery-versus-accepted states, idempotency, partial failures and safe retry. Preserve finalization as a separate operation; do not silently change `/send` into a resend API. Bulk progress depends on this workstream. Channel choice and verified provider capabilities remain unresolved; no endpoint names or counts invented here. Planning approval does not authorize implementation, sending messages, provisioning providers, or production changes.

### Backend delivery direction — approved, provider decision open

User selected **Web Push first + configured ZNS/SMS fallback**, no Zalo OA; manual link copy remains available. User chose to reuse an existing provider, then confirmed its identity is **not known yet**. Paid-provider integration is explicitly blocked until its name, channel and capabilities are verified. Continue frontend and provider-independent delivery design; do not invent an adapter, install provider packages or mark fallback operational. Current module inspection did not find Web Push subscription or SMS implementation, so these are real backend work, not UI wiring.

- Keep notification domain responsible for subscriptions, channel dispatch, durable attempts and status. Billing/auth integrations use exported services, not cross-module tables (ADR-0004).
- Subscribe only after explicit renter gesture/permission. Revoke stale subscriptions and bind them to authenticated renter/motel; denial or unsupported browser never blocks portal access.
- Store job/recipient state durably. One operation key per invoice notification event; retry only eligible failed attempts. Concurrent clicks/workers cannot create duplicate logical sends. Do not claim exactly-once external delivery without provider idempotency guarantees.
- Job progress counts recipients, not channels. Expose queued, processing, provider-accepted, failed, and unavailable separately. A Web Push service accepting a request does not prove delivery or that renter read it. No fake delivered/read totals.
- Fallback only for absent/invalid subscription or definitive push failure; no paid fallback solely because push has no read receipt. Ambiguous timeout requires reconciliation where supported, not blind double-send.
- Preserve queued attempts across worker restart. User-facing status/retry APIs must verify manager, motel, period and invoice ownership; cross-tenant requests return 404.
- Push payload should be minimal, with no CCCD, proof image, signed storage URL or login token on lock screen. Deep-link to authenticated portal; magic-link generation/delivery goes through auth service and respects existing one-use/24-hour policy.
- Provider readiness, template approval, opt-in requirements, cost controls and callback authenticity are release gates. Secrets stay server-side; no secret values in UI or logs.
- Plan database migrations, constraints/index tests, `src/db/test-db.ts` table list, API/design/UI/error documentation and backend typecheck/tests alongside frontend progress UI. Do not mutate database during planning.
- Exact endpoints, event schema, fallback adapter and retry policy will be specified after choosing first fallback provider. This is a remaining design gate, not an implementation-ready task.

## 5. Behavior contracts

### Themes, including authentication and overlays

Reuse `theme-select.tsx` and existing helper exports rather than introducing duplicate ThemeToggle state. `light`/`dark` override OS; missing, invalid or inaccessible stored preference behaves as `system`. If media-query API unavailable, fall back to light. Inline initializer and client resolver use identical rules. Client mount must not overwrite resolved dark with initial light state.

Set matching `color-scheme`, cover native controls, toast portals, dialogs, loading/error/not-found pages, login and magic-link landing. Listen for OS changes only in system mode and storage changes from other tabs; clean up listeners. Persist on same origin across manager/capture/portal. Storage failure must not block switching in the current tab. Respect existing CSP and hydration boundaries; no broad hydration-warning suppression to conceal defects.

### Navigation and room drawer

- ≥1024px: 240px labelled sidebar. 768–1023px: compact header with labelled menu, not an unexplained icon rail. <768px: four destinations `Tổng quan`, `Phòng`, `Hóa đơn`, `Thêm`; More contains capture, renters, contracts, motels. All destinations reachable; no six-tab mobile bar.
- Capture room entry replaces manager chrome with room/period context, sync status and back action. Theme setting remains accessible without filling thumb-action area.
- Preserve `motel`, `floor`, `status`, `search`; add scalar UUID `room` and enum `tab=renters|billing|contract`. Validate query values; fetch selected room within active motel independently of filtered list.
- Open via push with `scroll:false`; switching tab/room while open uses replace to avoid a long Back chain. For an entry created by opening drawer, Close/Escape/Back returns to list entry; Forward reopens. Direct-loaded drawer closes with replace removing only `room`/`tab`, never blindly backs out to another site. Track entry origin using history/client navigation metadata, not a shareable query flag.
- Preserve list scroll and filters; restore focus to original room trigger, or list heading if absent. Invalid/deleted/foreign room shows generic not-found within drawer with Close; no cross-tenant disclosure. Motel switch removes previous room/period references.
- Small-screen drawer occupies full viewport; desktop uses side sheet. Do not stack independent editable overlays. Unsaved edits require discard confirmation; backdrop/Escape cannot silently lose edits. Pending financial action cannot be cancelled merely by closing its UI.

### Billing and payment

Separate period status, invoice payment status and proof status. `paid` means `Đã thanh toán`, never delivered. Use existing API adapters, adding only thin wrappers for verified missing frontend calls:

- `GET /api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof`
- `POST .../payment-proof/approve`
- `POST .../payment-proof/reject` with `{ reason }` (1–500 characters)
- `POST .../cash-confirmation` with no date/note fields

Manager reviews scoped proof image, invoice/room/amount before approval; rejection requires reason. Cash confirmation explicitly names cash and amount. Refresh authoritative invoice/proof after success. Handle timeout as unknown result: re-read before retry; never optimistically label paid or retry irreversible work automatically. 401 requires reauthentication; 404 generic unavailable; conflict refreshes current state. Prevent repeat submissions while pending.

Renter uploads one current JPEG/PNG ≤10 MB. Pending/approved/paid blocks upload; rejected allows replacement and displays safe reason. Preserve file on recoverable submission failure, revoke preview URLs on cleanup. No fake upload percentage without byte-level progress support. QR failure/clipboard denial has selectable manual-transfer fallback; absent bank info explains next action. Keep proof-submitted distinct from paid. Photos and QR must not be color-inverted in dark mode.

### Meter capture and identity

Keep decimal meter strings and existing calculation helper; VND remains integer strings/BigInt. Show old reading, new reading, units and calculated usage per meter. Reject decreasing/invalid readings; flag documented high usage without changing billing math. Progress counts rooms with both readings, not just currently selected meter.

Pass verified `getMe().id` to `CaptureQueue`; browser ID is local scoping only, never client authority for backend tenancy. Sync only active manager/motel/period; stop stale in-flight callbacks when context changes. Quarantine legacy `"browser"` queue entries instead of attributing them to current user. Define explicit local-data clearing warning for logout; no silent cross-user replay.

Advance only after IndexedDB transaction completion, not request success alone. Storage failure keeps input and photo; never claims local save. Saved-locally and synced are different states. Readings may sync while photo fails; show partial outcome and retry failed part without duplicating readings. Conflicts require review, not endless overwrite retry. Sent/closed periods are read-only; background sync must not keep retrying them.

Service worker caches static shell only, never authenticated APIs, tokens, CCCD/proof photos or signed URLs. Preserve old queue data through shell updates; do not force reload while capture has unsaved input.

## 6. Ordered implementation slices — after approval only

Each slice: add behavior tests, observe expected failure, implement smallest coherent change, run relevant unit and browser tests. Existing successful tests remain; replace brittle source-text assertions with behavior tests where changed. No automatic commits.

### A. Baseline and visual acceptance

- [ ] Record current branch/status, route coverage and baseline verification before creating implementation branch/worktree. Keep unrelated seed changes untouched.
- [ ] Approve §3 reference screens and §4 delivery boundary. Freeze accepted visual examples and state matrix in owning UI spec during implementation, not now.
- [ ] Build route parity checklist including `/login`, `/renter`, `/r/[token]`, all manager pages, all capture routes and existing `/portal` details. No source deletion before replacement parity.

### B. Tokens, theme, primitives

Files: `frontend/src/app/globals.css`, `src/app/layout.tsx`, existing `src/components/ui/{theme-init,theme-select,button,modal,drawer,confirm-dialog,field,money-field,status-badge,toast}.tsx`, `frontend/package.json`, `frontend/bun.lock`. Dependency rationale goes into next available `docs/adr/` record during implementation.

- [ ] Add only required Radix packages for migrated overlays/tabs/menus and Lucide; retain native fields/selects where suitable. No blanket package bundle or parallel design system.
- [ ] Implement paired semantic tokens and common theme resolution per §5; retain existing helper APIs where possible.
- [ ] Extend `src/components/ui/__tests__/theme.test.tsx`, `overlay-feedback.test.tsx`, `form-upload.test.tsx`; use `e2e/component-kit.spec.ts` for real focus, Escape, portal contrast and scroll locking.
- [ ] Tests: missing/invalid/blocked storage × OS light/dark, explicit override, OS/cross-tab changes, reload, first paint before hydration, no transient light reset, keyboard labels, all control states and numeric input rejecting fractional VND.

### C. Shell, login and first-value workflow

Files: existing manager sidebar/top-bar, UI manager/portal/bottom-nav/motel-switcher shells, login page, manager overview/motels pages and motel editor.

- [ ] Implement breakpoint/navigation contract; show next operational action before summary statistics. New user follows create motel → rooms → renter/contract prerequisites → readings → invoice, no separate onboarding platform.
- [ ] Overview uses real selected-period values labelled `Đã thu` and `Chưa thu`, not unverifiable profit/revenue claims. Empty and failed reads are not zero. Preserve login validation, password-manager/paste support, and session redirects.
- [ ] Extend existing `e2e/{shell,dashboard,motels}.spec.ts` and overview/form unit tests for all breakpoints/themes, no motels, request failure, motel switching and long names.

### D. Rooms and renters

Files: manager rooms/renters pages and editors, `src/lib/room-query.ts`; new `src/components/manager/room-details-drawer.tsx` and `src/lib/__tests__/room-drawer-navigation.test.ts`.

- [ ] Group rooms by actual floor (including zero/basement/null); retain available/occupied/maintenance statuses. Vacant is neutral, not an error. Show known renter and rent; no unsupported ticket tab or invented lease state.
- [ ] Implement §5 drawer history and focus contracts; preserve existing filters and direct links. Restrict sensitive CCCD display to intentional profile/detail access, not ledger columns by default.
- [ ] Extend `e2e/{rooms,renters}.spec.ts`: open/Back/Forward/reload/direct close, filtered-out room, unknown/foreign ID, long currency, dirty form, motel switch while loading.

### E. Billing and payment review

Files: manager billing routes, `billing-capture.tsx`, `invoice-actions.tsx`, `finalize-period.tsx`, `src/lib/api/billing.client.ts`; new `payment-review-dialog.tsx` and `src/lib/api/__tests__/payment-manager.test.ts` only if no equivalent exists at baseline.

- [ ] Rebuild desktop ledger/mobile rows with itemized amounts and a review step before finalization. Preserve skipped-room/missing-contract explanations from invoice generation.
- [ ] Replace deprecated generic paid mutation with proof approve/reject and cash-confirmation actions. No unsupported editable cash date/note.
- [ ] Delivery UI follows §4 decision; no BatchSendDialog against finalization endpoint.
- [ ] Extend `e2e/manager.spec.ts` and `full-flow.spec.ts`: real action payloads, duplicate clicks, 410 avoidance, stale/paid invoice, rejection reason, uncertain timeout, partial fetch failure, finalization not labelled delivery. Unit tests assert exact paths/bodies.

### F. Contracts and existing secondary renter workflows

Files: manager contracts route, `src/lib/api/contracts.client.ts`, renter `contract-actions.tsx`, existing renter contract/tickets/detail routes.

- [ ] Keep existing functionality reachable and redesigned. Resolve names through scoped data rather than rendering shortened UUIDs as room/renter names.
- [ ] Manager create/edit/send/terminate/template operations, if completed in this slice, consume the already exported contract adapter functions and existing types; no invented status. Expiring is derived indicator, not new enum.
- [ ] Contract OTP uses one pasteable input, consent, server-enforced resend/error handling, signed/expired read-only states. Existing renter ticket UI retains attachment limits and never promises a manager inbox or in-app chat that does not exist.
- [ ] Add browser contract tests in `e2e/contracts.spec.ts`; extend renter portal tests for OTP failure, resend, signed/expired, ticket attachment errors and private-note exclusion. Do not expand manager ticket administration here.

### G. Capture

Files: capture routes, `capture-reading-client.tsx`, `src/lib/capture/{queue,sync,types}.ts`, authenticated identity handoff and logout cleanup callers, existing capture worker registration.

- [ ] Implement §5 transaction, identity and sync safeguards alongside field-first redesign. Reuse `calculateMeterPreview`; do not rewrite billing math.
- [ ] Extend existing `queue.test.ts`, `sync.test.ts`, capture client test, `e2e/{capture,capture-delivery}.spec.ts`: reload after local save, transaction abort/quota, offline reconnect, manager A/B, motel A/B, logout, legacy queue, late response, photo partial failure, conflict and finalized period.
- [ ] Device check: numeric keyboard, safe area, input focus not covered by footer, camera denied/unavailable, no-sidebar walk mode, both themes. Do not equate CSS viewport emulation with real keyboard testing.

### H. Renter invoice/payment

Files: `/r/[token]`, `/renter`, `/portal` home/bills/detail and layouts; existing renter QR/proof/exchange components and API adapters.

- [ ] Itemized bill with actual meter evidence, payment details and proof states. Token exchange preserves existing single-use flow; avoid duplicate exchange in effects and remove token from address after success.
- [ ] Expired/used/invalid link gives safe recovery without token logging. Notifications/install prompts never block reading/paying; do not promise unavailable fallback provider.
- [ ] Extend `e2e/renter-portal.spec.ts` and proof/API unit tests: clipboard failure, QR render error, bank missing, signed-image expiry, pending/rejected/paid, upload timeout/retry, session expiry and long bills in both themes.

### I. Release validation and retirement

- [ ] Update `frontend/playwright.config.ts` with four fixture projects: existing `chromium-mobile` (375×667 light), `chromium-mobile-dark`, `chromium-desktop` (1280×900 light), `chromium-desktop-dark`. Exclude `e2e/real/**` in each; maintain real-stack opt-in gate.
- [ ] Add targeted 320/390/430/768/1024px, 200% text and 400% zoom geometry checks. Screenshot approved reference screens with fixed fixtures, fonts and motion. Inspect screenshots, not only snapshot hashes.
- [ ] Fix real-stack startup to use configured live backend/ports rather than hardcoded fixture backend before running it. Never use production or reset QA automatically.
- [ ] Run frontend commands in this order: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e`. Targeted units use `bun run test src/components/ui/__tests__/theme.test.tsx`; targeted browser tests use `bun run test:e2e e2e/rooms.spec.ts --project=chromium-mobile`.
- [ ] Capture statement/branch/function/line coverage with matching Vitest coverage provider if absent (dev-only dependency, same ADR rationale), then `bun run test --coverage`. Record baseline and final values; do not invent a passing coverage percentage. Critical failure cases above must be exercised regardless of aggregate score.
- [ ] Verify on authorized local/QA real backend using isolated test identities and production build. Record console/network errors, keyboard/click outcomes, QR scan, phone keyboard/camera behavior; fixture tests alone do not prove usability.
- [ ] Measure repeatable lab performance with device/network settings recorded; target field LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 when field samples exist. Never report lab runs as p75 field proof.
- [ ] Update owning UI/testing docs to reflect actual shipped scope and ADR dependencies, not mark all imagined Stitch screens delivered. Request independent code/security review before commit or release.
- [ ] Remove superseded presentation only after route parity. Ship by reviewed frontend releases in manager → capture → renter order; no duplicate `/v2` production app. Keep previous frontend artifact for rollback; do not delete/migrate queue storage destructively. Separate fixes requiring backend changes from frontend release.

## 7. Remaining approval gates

1. Backend delivery workstream selected; resolve channel/provider strategy, then define authenticated job/status/retry contracts and truthful progress semantics.
2. Representative paired-theme visual approval before mass screen migration.
3. Written final plan approval before implementation. No deployments or commits implied.
