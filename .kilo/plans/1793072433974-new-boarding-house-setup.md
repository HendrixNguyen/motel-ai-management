# New Boarding House Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi lần tạo nhà trọ dùng wizard bốn bước, hỗ trợ tạo nhanh và sao chép cấu hình từ motel thuộc Manager, với catalog hợp đồng dùng chung và ghi dữ liệu atomic.

**Architecture:** Motel module điều phối transaction, gọi exported services của contract/room; mỗi module chỉ ghi bảng của mình. Frontend dùng draft độc lập với form sửa, copy dữ liệu thành snapshot có thể sửa; server lấy điều khoản từ nguồn đã xác thực, không tin clauses client. Không thêm workflow framework hay dependency.

**Tech Stack:** Bun, TypeScript strict, ElysiaJS, Drizzle/PostgreSQL; Next.js 16.3.8, React 19.2.8, Vitest 5.0.3, Playwright.

**Spec:** Phần “Design contract” trong chính `.kilo/plans/1793072433974-new-boarding-house-setup.md` là đặc tả đã hợp nhất; thay thế nội dung workflow cũ tại cùng file. Đọc thêm `docs/superpowers/specs/2026-10-03-motel-management-design.md`, `docs/api-contract.md`, `docs/frontend-ui-specs.md`, `docs/testing-strategy.md` để giữ tương thích ngoài phạm vi.

## Global Constraints

- Chỉ lập kế hoạch trong phiên này; không implement, migrate, seed hoặc deploy.
- Mọi lần tạo motel đều mở wizard. Chưa sở hữu motel: không skip; đã sở hữu ít nhất một motel: được skip. Hủy không tạo dữ liệu và luôn được phép.
- Full tạo 1–100 phòng available; 100 không phải giới hạn tổng số phòng của motel. Quick tạo 0 phòng, giữ mẫu đã chủ động chọn nếu có.
- Phí điện/nước/dịch vụ cấp motel; từng phòng chỉ tên, tầng, giá thuê. Không copy phòng, renter, hợp đồng thực tế, hóa đơn, mã truy cập công khai, tên hoặc địa chỉ nguồn.
- Tiền là chuỗi số nguyên VND; dùng money helpers hiện có. Manager lấy từ session, tài nguyên khác tenant trả 404.
- Không dependency mới, không comment code mới; dùng Bun trong từng package, không root workspace commands.
- Backend DB tests chạy tuần tự, chỉ TEST_DATABASE_URL đã xác minh; không reset QA/Prod.
- Mẫu pháp lý chưa duyệt phải inactive; không tuyên bố chứng nhận pháp lý. Production operations cần phê duyệt riêng.
- Commit steps chỉ thực hiện nếu người dùng cho phép commit khi execution; không coi plan là lệnh commit hiện tại.

## Review Focus

1. Nguồn thuộc tenant khác hoặc bị xóa/sửa sau preview: 404 hoặc conflict, không copy nhầm, không ghi một phần — Task 3/4.
2. HTTP thành công nhưng mất phản hồi/refresh: tra trạng thái theo requestId trước khi tạo lại; không cần lưu ngân hàng trong storage — Task 4/5.
3. Copy dùng nhầm edit baseline: không PATCH nguồn, không mất ngân hàng/phí do helper create hiện bỏ qua chúng — Task 5.
4. Hai tab tạo nhanh/xóa motel cuối hoặc đổi default: quyết định dưới transaction/lock, không vượt eligibility hay có hai default — Task 2/4.
5. Đổi nguồn/mode và late response: không ghi đè draft đã sửa, không gửi phòng trong quick, vẫn giữ mẫu được chọn — Task 5/6.

---

## Design contract

### UX

1. **Thông tin:** tự mở một lần trong lần truy cập khi danh sách motel tải thành công và rỗng; mọi nút tạo đều mở wizard. Nhập tên, địa chỉ tùy chọn, điện/kWh, nước/m³, phí cố định/phòng/tháng, ngân hàng tùy chọn nhưng đủ bộ nếu bật. Giá bắt đầu trống; 0 chủ động nghĩa không thu phí.
2. **Sao chép ở bước 1:** chỉ Manager có motel thấy “Sao chép từ nhà trọ đang có”. Chọn một motel nguồn và từng nhóm ngân hàng, giá điện/nước/phí, một mẫu hợp đồng. Các checkbox ban đầu không chọn; nhấn “Áp dụng” mới copy. Nhóm không chọn giữ nguyên draft. Nếu ghi đè nhóm đã sửa phải xác nhận. Tên/địa chỉ luôn tự nhập. Nguồn không có ngân hàng hoặc mẫu thì nhóm tương ứng disabled kèm giải thích. Mẫu phải chọn rõ, kể cả nguồn có default; không copy tất cả mẫu.
3. **Mẫu:** full phải chọn catalog hoặc mẫu nguồn. Mẫu chọn ở bước 1 được preview/xác nhận tại bước 2, không bắt chọn lại. Tên mẫu và nguồn hiện trong review. Mẫu thành bản sao mặc định của motel mới. Không chỉnh clauses trong wizard. Catalog hiển thị version active mới nhất mỗi key; lỗi/rỗng chỉ chặn khi chưa có nguồn mẫu hợp lệ khác.
4. **Phòng:** sinh danh sách từ tiền tố, số bắt đầu, số lượng, tầng, giá chung; sửa từng phòng. Trim tên; giữ semantics hoa/thường hiện có. Áp dụng giá chung có lựa chọn chỉ phòng chưa chỉnh/tất cả. Giảm số phòng hoặc tái sinh mất sửa phải xác nhận. Dịch vụ hiển thị chỉ đọc, link sửa bước 1.
5. **Skip:** ở bước 1, validate thông tin rồi chuyển review; bỏ phần chưa thiết lập, không xóa mẫu đã chủ động chọn. Draft phòng giữ để quay lại nhưng quick không gửi rooms. Review ghi 0 phòng và mẫu được copy hoặc “Chưa chọn mẫu hợp đồng”. Full review ghi N phòng và mẫu. Có sửa từng nhóm, không mất state.
6. **Hoàn tất:** chỉ một lần gửi ở review. Chọn motel mới trong app, vào phòng. Quick empty state có thêm phòng/chọn mẫu; không báo đã cấu hình đủ. Không tạo renter/contract/invoice.
7. **Chọn mẫu sau setup:** quản lý mẫu của mọi motel có “Chọn mẫu có sẵn”, dùng lại picker catalog; checkbox đặt mặc định ban đầu false. Thay default phải báo rõ mẫu cũ; chỉ thay khi Manager chọn.

### Draft, copy và concurrency

Ngân hàng/phí là snapshot của lần “Áp dụng”; Manager được sửa, server nhận giá trị cuối như dữ liệu nhập thường, không refetch để ghi đè. Mẫu nguồn dùng fingerprint SHA-256 của JSON chuẩn hóa `{name, clauses}`; preview trả fingerprint, submit đối chiếu trong transaction. Source đổi thì 409 `SETUP_SOURCE_CHANGED`, UI yêu cầu preview/chọn lại. Source xóa hoặc không thuộc tenant: 404. Mẫu copy độc lập, không liên kết cập nhật về sau.

Draft sessionStorage keyed manager/schema version; không lưu ngân hàng, clauses nguồn, token hoặc CCCD. Refresh phải reselect/reenter ngân hàng và revalidate selection nguồn. Lưu requestId của submit riêng: sau refresh gọi status endpoint trước khi cho submit mới. Storage lỗi dùng memory và báo không phục hồi refresh. Đóng giữ draft trong tab; hủy xác nhận xóa; logout/đổi account xóa; không chuyển draft giữa account.

Pending/unknown submit đóng băng payload trong memory; retry cùng key/payload, không sửa hoặc đổi key trước khi xác định kết quả. Status endpoint lấy cùng manager lock nên chờ transaction đang chạy; 404 nghĩa chưa có commit tại thời điểm đọc. Nếu refresh mất payload ngân hàng và status 404, dùng lại requestId cũ khi nhập lại: payload khác mà request cũ sau đó commit sẽ conflict, không tạo hai motel. Conflict bắt buộc tra status, không tự sinh key mới. Sau success xóa draft/key. Nếu motel kết quả đã bị xóa, trả 410 `SETUP_RESULT_DELETED`, không tái tạo từ key cũ.

### API và type contract (định nghĩa Task 3/4, mirror frontend Task 5)

```ts
type TemplateSelection =
  | { kind: "catalog"; key: string; version: number }
  | { kind: "motel"; motelId: string; templateId: string; fingerprint: string };
type SetupRoomInput = { name: string; basePrice: VndString; floor?: number | null };
type SetupMotelInput =
  | { requestId: string; mode: "full"; motel: CreateMotelInput;
      template: TemplateSelection; rooms: SetupRoomInput[] }
  | { requestId: string; mode: "quick"; motel: CreateMotelInput;
      template?: TemplateSelection };
type SetupMotelResult = {
  motelId: string; mode: "full" | "quick";
  roomCount: number; templateId: string | null;
};
type TemplatePreview = {
  name: string; clauses: { title: string; content: string }[];
  selection: TemplateSelection;
};
type CatalogSummary = { key: string; version: number; name: string; description: string };
```

- GET `/api/manager/contract-template-catalog` returns `CatalogSummary[]`.
- GET `/api/manager/contract-template-catalog/:key/:version` returns `TemplatePreview`.
- GET `/api/manager/motels/:motelId/contract-templates/:templateId/setup-preview` returns `TemplatePreview` for owned motel.
- POST `/api/manager/motels/setup` accepts union above; requestId UUID; full rooms 1–100, quick rejects rooms; reject unknown ownership/status/clauses fields. First commit 201, replay 200, body `SetupMotelResult`.
- GET `/api/manager/motels/setup-requests/:requestId` returns `SetupMotelResult`, 404 unknown for session, 410 deleted result. No fingerprint/payload/bank exposed.
- POST `/api/manager/motels/:motelId/contract-templates/from-catalog` accepts `{catalogKey, catalogVersion, isDefault}` returns existing `ContractTemplateResponse`, 201. No auto retry after ambiguous failure: reload template list first.
- Existing POST motel keeps DTO but returns 409 `MOTEL_SETUP_REQUIRED` for Manager with zero motels. Other callers/tests must adapt intentionally. Editing unchanged.
- New 409 codes: `MOTEL_SETUP_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `SETUP_SOURCE_CHANGED`; 410 `SETUP_RESULT_DELETED`. Error envelope existing `{error, code, details?}`.

### Persistence and locking

`contract_template_catalog`: UUID, key, positive integer version, name, description, clauses existing structure, active default false, timestamps; UNIQUE(key,version), CHECK trimmed key nonempty. Seed command separate from destructive demo seed, inserts three inactive reviewed-draft Vietnamese starter variants (`vn-residential-standard`, `vn-service-fees`, `vn-flexible-term`), version 1, ON CONFLICT DO NOTHING. No invented legal citations. Active publication is explicit release gate after legal review, not automatic seed behavior.

`motel_setup_requests`: UUID id, managerId FK, requestId UUID, fingerprint text, motelId UUID nullable FK ON DELETE SET NULL, templateId UUID nullable FK ON DELETE SET NULL, mode, roomCount, createdAt; UNIQUE(managerId,requestId); CHECK mode full/quick and respective roomCount 1–100/0. Keep records for lifetime of Manager, no TTL in this scope. Null motelId means deleted result; replay never recreates. Response templateId may become null if deleted later; record represents result identity, not historic sensitive payload.

Use transaction-scoped advisory lock derived from Manager UUID in `lockMotelSetup(tx,managerId)`. Setup/status/old create/delete use same lock first. Idempotency lookup precedes eligibility/source lookup. Quick checks existence before insert. Lock selected source template/catalog row for reading/copy; ownership rechecked in tx. Create motel then optional template then full rooms then request record, commit. Template replacement default serializes on destination motel row before clear/insert; reuse in existing default mutation paths. No cross-module table imports.

## File structure

- Backend contract module: new `contract-catalog.schema.ts`, `.types.ts`, `.service.ts`, `.route.ts`, `.seed.ts`; existing contract service gains preview/copy tx seams.
- Backend motel module: new `motel-setup.schema.ts`, `.types.ts`, `.service.ts`, `.route.ts`; existing motel service owns manager lock and atomic create seam.
- DB index exports transaction types; schemas reexports new tables; test reset includes both; app mounts new routes; package adds catalog seed command.
- Frontend: new `lib/motel-setup.ts`, `lib/api/motel-setup.client.ts`, `components/manager/motel-setup-wizard.tsx`, `contract-template-picker.tsx`; existing motel editor retains edit branch, create delegates wizard. Contract management adds catalog action.
- Tests use `backend/test/` and **`frontend/test/`**, not stale AGENTS `src/**/*.test.ts`. Existing fixture examples: backend `test/contract-template.test.ts`; frontend `test/lib/api/fixtures.ts`, `e2e/fixtures/api.ts`, `e2e/fixtures/backend-server.ts`.

## Task 1: Catalog storage and safe seed

**Files:** Create contract catalog schema/types/seed files above, `backend/test/contract-catalog-seed.test.ts`; modify `backend/src/db/schemas.ts`, `backend/src/db/test-db.ts`, `backend/package.json`, data-model owning spec. Generate migration with `bun run db:generate --name=contract_catalog`; commit generated SQL/meta, never hand-pick a conflicting numeric prefix.

**Interfaces:** produces `CatalogSummary`, `TemplatePreview`, `TemplateSelection` in `contract-catalog.types.ts`; `seedContractCatalog(): Promise<void>` in seed file, executable only under `import.meta.main`. Package script `db:seed-contract-catalog` runs that file. Reuse existing clause validation and VndString type, no cross-package imports.

- [ ] Write test `seed_is_idempotent_and_never_reactivates`: `await seedContractCatalog(); await seedContractCatalog(); expect(rows).toHaveLength(3); expect(rows.every(r => !r.active)).toBe(true)`; manually change one row then assert rerun preserves it. Add constraint tests rejecting duplicate key/version, blank key and version 0; version 2 same key succeeds.
- [ ] In backend run `PATH="$HOME/.bun/bin:$PATH" bun test test/contract-catalog-seed.test.ts`; expect missing exports/schema failure, not DB connection failure.
- [ ] Implement schema, seed data, reset list and migration. Draft clauses cover rent/deposit, term, handover, obligations, termination/disputes; service variant explains fees; flexible variant explains renewal/notice. Mark all inactive pending legal review. No account or motel writes.
- [ ] Run same test, backend typecheck/lint/format:check; expect exit 0. Update owning schema spec with constraints and legal release gate.
- [ ] If commits authorized: stage explicit task files and generated migration artifacts; commit `feat: add shared contract catalog seed`.

## Task 2: Transaction-aware domain seams

**Files:** Modify `backend/src/db/index.ts`, `backend/src/middleware/tenancy.ts`, `backend/src/modules/motel/motel.service.ts`, `backend/src/modules/room/room.service.ts`, `backend/src/modules/contract/contract.service.ts`; create `backend/test/setup-transaction.test.ts`.

**Interfaces:** export `DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0]`, `DbExecutor = Db | DbTransaction`. Add optional `executor: DbExecutor = db` to `resolveOwnedMotel`. Add `createMotelInTransaction(tx: DbTransaction, managerId: string, input: CreateMotelInput): Promise<MotelResponse>`, `lockMotelSetup(tx: DbTransaction, managerId: string): Promise<void>`, `createSetupRooms(tx: DbTransaction, motelId: string, managerId: string, inputs: Array<Pick<CreateRoomInput,"name"|"basePrice"|"floor">>): Promise<RoomResponse[]>`, `createContractTemplateInTransaction(tx: DbTransaction, motelId: string, managerId: string, input: ContractTemplateInput): Promise<ContractTemplateResponse>`. Existing public service signatures stay; wrappers delegate rather than duplicate validation.

- [ ] Test `rollback_removes_all_setup_rows`: create motel/template/rooms within tx then throw; `expect(motelRows).toHaveLength(0); expect(templateRows).toHaveLength(0); expect(roomRows).toHaveLength(0)`. Test ownership lookup sees motel inserted in same tx; test concurrent default creates yield exactly one default.
- [ ] Run `bun test test/setup-transaction.test.ts` in backend; expect missing seams failure.
- [ ] Implement seams, preserving money/error mapping. Batch room insert through room-owned service; lock target motel for default mutations, including existing update path. All reads/writes use passed executor.
- [ ] Run new test plus `bun test test/motel.test.ts`, `bun test test/room.test.ts`, `bun test test/contract-template.test.ts` sequentially; typecheck/lint exit 0.
- [ ] If authorized commit `refactor: add transactional motel setup services` with explicit files.

## Task 3: Catalog API and owned-template preview/copy

**Files:** Create catalog service/route, `backend/test/contract-catalog.test.ts`; modify contract service/route, `backend/src/app.ts`, `backend/src/shared/errors.ts`, `docs/api-contract.md`.

**Interfaces:** consume Task 1/2. Produce `listContractCatalog(): Promise<CatalogSummary[]>`, `previewCatalogTemplate(key: string, version: number): Promise<TemplatePreview>`, `previewOwnedTemplate(managerId: string, motelId: string, templateId: string): Promise<TemplatePreview>`, `copySetupTemplate(tx: DbTransaction, managerId: string, targetMotelId: string, selection: TemplateSelection, isDefault: boolean): Promise<ContractTemplateResponse>`. Copy rereads/locks source and checks fingerprint; preview returns same fingerprint algorithm.

- [ ] Test `foreign_template_returns_404`: authenticate A, preview B template, `expect(response.status).toBe(404)`. Test shared catalog readable by A/B, anonymous rejected, inactive 404, newest active per key; mutate source after preview and assert copy `SETUP_SOURCE_CHANGED` with no inserted row. Test destination/source ownership independently and default false preserves old default.
- [ ] Run `bun test test/contract-catalog.test.ts`; expect missing route/service assertions fail.
- [ ] Implement APIs from Design contract, server-side clauses copy, deterministic fingerprint using built-in crypto and ordered `{name,clauses}` serialization. Catalog rows immutable except active; draft edits require version bump. Register routes before ambiguous parameter paths.
- [ ] Run test, existing template tests, typecheck/lint; all pass. Document responses and 404/conflict semantics.
- [ ] If authorized commit `feat: expose shared and owned contract template selection`.

## Task 4: Atomic full/quick setup and recoverable submit

**Files:** Create motel setup schema/types/service/route, `backend/test/motel-setup.test.ts`; modify motel service/route, app, db exports/reset, errors and API/design docs. Generate migration named `motel_setup_requests`.

**Interfaces:** consume Task 2/3; define API union/results above in setup types. Produce `setupMotel(managerId: string, input: SetupMotelInput): Promise<{result: SetupMotelResult; replayed: boolean}>`, `getSetupResult(managerId: string, requestId: string): Promise<SetupMotelResult>`; authenticated routes map status as specified.

- [ ] Write `first_motel_requires_full`: quick/old POST without motel `expect(status).toBe(409); expect(code).toBe("MOTEL_SETUP_REQUIRED")`. Full one room returns 201; full zero/101 rejected; 100 succeeds; quick after existing motel with selected source template returns `roomCount === 0` and nonnull templateId; quick no template returns null.
- [ ] Add `same_request_commits_once`: concurrent identical requests produce same motelId, count one; changed payload/mode returns 409. Inject failure with test transaction DB constraint/trigger on room insert (test-only, never production hook), assert no motel/template/request remains. Two-tenant source failures leave counts unchanged.
- [ ] Add tests for locked delete-vs-quick, status after commit, deleted target 410, source changed 409, negative/oversize money, duplicate trimmed names and forced foreign IDs. Assert `expect(copied.clauses).toEqual(source.clauses); expect(copied.id).not.toBe(source.id)` and later source edit leaves copy unchanged.
- [ ] Run `bun test test/motel-setup.test.ts`; expect missing endpoint failures.
- [ ] Implement schema, validation and algorithm in Design contract. Fingerprint canonical validated request, including final bank/fees, template selection and mode; never log body or fingerprint. Existing create/delete share Manager lock; adapted API tests use direct owned-motel fixtures where not testing initial setup.
- [ ] Run new test and existing motel/template suites serially, typecheck/lint/format:check; all exit 0. Update errors/API/data-model docs for compatibility change and idempotency deletion behavior.
- [ ] If authorized commit `feat: create motels through atomic full and quick setup`.

## Task 5: Frontend DTO, draft and copy state

**Files:** Create `frontend/src/lib/motel-setup.ts`, `frontend/src/lib/api/motel-setup.client.ts`, `frontend/test/lib/motel-setup.test.ts`; modify `frontend/src/lib/api/types.ts`, `frontend/src/lib/motel-form.ts`, `frontend/test/lib/motel-form.test.ts`.

**Interfaces:** mirror backend DTOs with frontend VND conventions, no backend imports. API client exports `submitMotelSetup(input: SetupMotelInput): Promise<SetupMotelResult>`, `getMotelSetupResult(requestId: string): Promise<SetupMotelResult>`, `listContractCatalog`, `previewCatalogTemplate`, `previewOwnedTemplate` with Task 3 DTOs; relative `/api` only. Draft module exports:
`CopyGroups = {bank: boolean; services: boolean}`;
`applyMotelCopy(draft: MotelDraft, source: MotelResponse, groups: CopyGroups): MotelDraft`;
`buildSetupInput(requestId: string, mode: "full"|"quick", motel: CreateMotelInput, template: TemplateSelection | null, rooms: SetupRoomInput[]): SetupMotelInput` (throws Error on missing full template/invalid room count);
`StoredSetupDraft = {version: 1; mode: "full"|"quick"; motel: Omit<MotelDraft,"bank"|"bankEnabled">; template: TemplateSelection|null; rooms: SetupRoomInput[]; pendingRequestId: string|null}`;
`serializeSetupDraft(draft: StoredSetupDraft): string`, `parseSetupDraft(raw: string): StoredSetupDraft|null` (runtime validation). Bank form starts disabled on restore.

- [ ] Test `copy_is_not_edit`: copied bank/fees deep-equal source, name/address remain new, source unchanged after draft mutation; mock updateMotel and assert not called on setup submit. Test create preparation retains entered bank/fees (existing bug); edit behavior unchanged.
- [ ] Test `quick_preserves_template_not_rooms`: build quick from draft with 3 rooms, `expect(input.template).toEqual(selection); expect("rooms" in input).toBe(false)`. Full missing template and rooms 0/101 throw; 1/100 pass. Storage excludes bank/clauses, rejects corrupt/unknown version JSON; pending key survives.
- [ ] Run `bun run test -- test/lib/motel-setup.test.ts test/lib/motel-form.test.ts` in frontend; expect missing functions/retained-bank assertions fail.
- [ ] Implement immutable helpers and API wrapper, fix create preparation without using source as original edit baseline. Copy group selection is UI state, not extra provenance fields in payload. No auto merge after “Áp dụng”.
- [ ] Run targeted tests, frontend typecheck/lint; exit 0.
- [ ] If authorized commit `feat: model motel setup drafts and independent configuration copy`.

## Task 6: Wizard and reusable catalog selection

**Files:** Create `frontend/src/components/manager/motel-setup-wizard.tsx`, `contract-template-picker.tsx`, `frontend/test/components/manager/motel-setup-wizard.test.tsx`; modify `motel-editor.tsx`, `contract-management-client.tsx`, frontend API contracts client, `docs/frontend-ui-specs.md`.

**Interfaces:** `MotelSetupWizard({open,onClose,motels,managerId}: {open:boolean;onClose:()=>void;motels:MotelResponse[];managerId:string})`; `ContractTemplatePicker({value,onChange}: {value:TemplatePreview|null;onChange:(value:TemplatePreview)=>void})` handles catalog only, owned-template selection in wizard uses existing listContractTemplates + preview API. Existing editor create branch loads owned list/auth identity through existing authenticated context; do not fabricate identity or expose new secrets. Add client `copyCatalogTemplate(motelId: string, input: {catalogKey:string;catalogVersion:number;isDefault:boolean}): Promise<ContractTemplateResponse>`.

- [ ] Test `first_motel_has_no_skip`: render empty motels, assert skip absent and Cancel works without submit. Existing motels show skip; copy groups require Apply; source selection stale-response ignored; changing source doesn't overwrite manually edited bank until confirmed.
- [ ] Test full four-step navigation, quick retaining selected template, source preview failure blocks submit with selection retained for correction; inactive catalog still allows owned template. On pending submit disable inputs; failed response enables same-key retry; restored pending key calls status before new submit and 410 never resubmits.
- [ ] Run `bun run test -- test/components/manager/motel-setup-wizard.test.tsx`; expect missing component/UI failures.
- [ ] Implement Design contract using existing form/dialog/motel selection conventions, read installed Next docs before editing integration. No nested modals; focus first error; return focus on close, full-screen mobile. Reuse picker in contract management with unchecked default checkbox. Revalidate restored source selections; do not fetch bank silently after refresh.
- [ ] Run component tests plus existing motel-editor tests, typecheck/lint; update UI owning doc exact copy/skip/source/recovery behavior. Test create editor delegates wizard while edit still PATCHes original motel only.
- [ ] If authorized commit `feat: add guided motel creation and configuration reuse`.

## Task 7: End-to-end acceptance and release gates

**Files:** Create `frontend/e2e/motel-setup.spec.ts`; modify `frontend/e2e/motels.spec.ts`, `frontend/e2e/contracts.spec.ts`, `frontend/e2e/fixtures/api.ts`, `frontend/e2e/fixtures/backend-server.ts`, `docs/testing-strategy.md`.

**Interfaces:** reuse mockApi typed routes and per-session fixture backend; server-component reads must use backend fixtures, not only browser interception. Add setup/status/catalog/preview/from-catalog routes with stateful results for refresh/replay.

- [ ] Write `full_setup_creates_first_motel`, `second_motel_copies_selected_groups_then_skips`, `quick_motel_selects_catalog_later`, `lost_response_refresh_recovers_result`. Assert POST snapshot contains edited final bank/fees, excludes source name/publicAccessCode, quick rooms absent; new motel selected; source fixture unchanged; no duplicate POST with new key during unknown state.
- [ ] Add viewport and keyboard assertions at 375×667 and 1440×900: no horizontal overflow, controls visible after scroll, focus trap/return, review edit preserves data, no unexpected console/network errors. Source edit 409, foreign 404 and missing catalog display actionable errors, no partial success toast.
- [ ] Run `bun run test:e2e -- e2e/motel-setup.spec.ts --project=chromium-mobile`; expect absent routes/behavior assertions fail before fixture/test integration is complete, not browser dependency failure.
- [ ] Complete fixtures and compatibility updates. Update testing strategy with full/quick/copy/idempotency matrix and explicit legal publication gate; fixture-only checks are not production usability proof.
- [ ] Verify backend: `bun run typecheck`, `bun run test` (package explicitly `bun test --parallel=1`), `bun run lint`, `bun run format:check`, sequentially with no other DB tests. Verify frontend: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e`, `bun run format:check`. Run inside packages with Bun PATH; report actual exit codes and blockers, never claim unrun checks passed.
- [ ] Before release, verify additive migrations, reviewed active catalog availability, backend/UI compatibility for initial-create endpoint change. No existing motel automatically gains templates. No seed in request. Rollback application without dropping tables/data. Production execution remains separately authorized.
- [ ] If authorized commit `test: cover motel setup copy and recovery workflows` with explicit test/docs files. Request read-only code/security review of uncommitted changes before their commits per repository policy.

## Self-review and handoff

Coverage: catalog/seed Task 1; transaction/default constraints Task 2; catalog/owned-source trust Task 3; full/quick/idempotency/compatibility Task 4; editable copies/draft Task 5; four-step UX and after-setup catalog Task 6; browser/regression/release Task 7. All five Review Focus items map to explicit tests. Source copy and quick-template semantics supersede earlier plan statements that quick always has no template.

No production legal approval is inferred: software and inactive seed can be built/tested; activation and release requiring first-motel catalog remain blocked until content review. No legal-certified text, per-room services, bulk copy rooms, server drafts, multi-device resume or account bootstrap in scope.

Recommended execution: subagent-driven with sequential gates for Tasks 1–4 and 5–6; frontend may start against frozen DTO contract after Task 4 review. No execution method selected or implementation authorized by this plan. Saved main plan remains this file for review.
