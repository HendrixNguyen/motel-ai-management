# Core Backend Task 7 Completion Plan

**Goal:** Finish currently testable Task 7 core-backend verification without adding renter-portal endpoints or claiming historical checks ran.

**Execution:** Subagent-driven, as selected by user. Implementer invokes `subagent-driven-development`; independent task reviewers inspect test integrity and final changed diff before completion. No commit without explicit user request.

**Scope decision:** Renter invoice HTTP isolation belongs to sub-project 7, because `/api/renter/invoices/:invoiceId` is not implemented. No placeholder endpoint. Contract-management sub-project 4 needs separate documentation reconciliation and design approval before its implementation plan.

## Work

1. Preserve current worktree changes. Inspect `backend/src/test/isolation.test.ts`, `cross-tenant-isolation-2.test.ts`, mounted routes in `backend/src/app.ts`, and `docs/api-contract.md`. Replace obsolete `/api/motels/:id` and `/api/rooms/:id` assertions with authenticated requests against real `/api/manager/motels/:motelId` and `/api/manager/motels/:motelId/rooms/:roomId` paths, or delete duplicate tests if `cross-tenant-isolation-2.test.ts` already proves both with real cookies. Remove invalid-cookie case mislabeled cross-renter access; authenticated cross-renter invoice test remains deferred to sub-project 7. Keep magic-link replay test if not redundant.
2. Check `TEST_DATABASE_URL` targets disposable **local** test PostgreSQL, `SKIP_DB_RESET` is unset, and no other `bun test` process uses same DB. `resetDb()` drops schemas; do not run against QA or concurrently. Run `backend/bun run typecheck`, then relevant backend tests by explicit path **sequentially**: `money`, `phone`, `env`, `schema-constraints`, `error-envelope`, `manager-auth`, `tenancy`, `renter-auth`, `isolation`, `cross-tenant-isolation-2`. Run remaining backend test files one by one if full gate desired; never use unqualified `bun test` with DB reset. Record exact results or blockers.
3. Compare actual `/health`, auth register/login, unknown-route envelopes, and renter magic-link responses against `docs/api-contract.md`. Fix genuine drift in owning docs, not product code based on obsolete sample snippets. Run frontend `bun run typecheck`, `bun run lint`, `bun run build` for original Task 7 frontend gate; report any existing failures separately.
4. Run read-only security and code reviews on uncommitted changes. Resolve applicable findings, rerun affected tests. Update progress ledger in `docs/superpowers/plans/2026-10-03-core-backend.md` with actual gate outcomes and explicitly deferred authenticated cross-renter invoice isolation. Do not mark historical RED runs or commits retroactively; do not commit without explicit user request.

**Done criterion:** Real-route tenant tests cannot pass merely from a 404 on nonexistent path; all current Task 7 tests and checks pass or concrete environmental blockers are recorded. Deferred renter invoice isolation remains assigned to sub-project 7, not falsely marked complete.
