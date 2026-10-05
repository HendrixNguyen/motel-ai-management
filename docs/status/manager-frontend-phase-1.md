# Manager Frontend — Phase 1 status

**Plan:** [`docs/superpowers/plans/2026-10-05-manager-frontend-foundation.md`](superpowers/plans/2026-10-05-manager-frontend-foundation.md)
**Branch:** `feat/manager-frontend-foundation`
**Last updated:** 2026-10-05, after the Task 4 fix round (`c2545ab`)

This is the working state of sub-project 5, phase 1. It is a **partial** delivery: the foundation and
the API client are done, no screen exists yet, and nothing is reachable in a browser.

## Where it stands

| Task | Deliverable | State |
|---|---|---|
| 0 | Transport decision, doc reconciliation, one backend fix | done (`bde8576`) |
| 1 | Token system + `vi` root layout | done (`1095b08`, `1b4fd5b`, `6fe5277`) |
| 2 | Vitest + Playwright harness | done (`73ffed0`, `287356c`) |
| 3 | VND / date / status formatters | done (`8a4b533`, `e53f7dc`) |
| 4 | Typed API client + server fetcher | done (`cbd6086`, `5ac49ed`, `c2545ab`) |
| 5 | Shell, auth, motel selection | not started |
| 6 | Component kit (11 primitives) | not started |
| 7 | M2 Nhà trọ `/motels` | not started |
| 8 | M3 Phòng trọ `/rooms?motel=` | not started |
| 9 | M4 Khách thuê `/renters?motel=` | not started |
| 10 | M1 Overview `/` | not started |
| 11 | End-to-end specs | not started |

Five of twelve tasks. The branch also carries five earlier backend commits (motel, room and renter
CRUD) that this work depends on; see [Base](#base) below.

## What exists today

- **A typed API boundary.** 20 endpoints wrapped across `frontend/src/lib/api/`, reads in
  `<domain>.ts` and mutations in `<domain>.client.ts`, with every mirrored type hand-written and
  cross-checked field-by-field against the backend DTOs.
- **A money guard.** Every money field of every response is gated through `parseVndDigits` on both
  transports. A field that arrives as a JSON *number* is refused outright, because `VndString` is
  `string` and nothing else would catch float money.
- **Formatters.** `formatVnd`, `formatVndPlain`, `parseVndDigits`, `formatDate`, `formatMonth`, and
  exhaustive room/renter status label maps — all resolving in `Asia/Ho_Chi_Minh`.
- **A token layer** — the spec's 15 tokens plus `border-strong`, on Tailwind v4 `@theme`.
- **Two test runners**, both running: Vitest (147 tests) and Playwright (a smoke spec today; the
  M1–M4 specs are Task 11).

## What does not exist yet

- **No screen.** `/`, `/motels`, `/rooms`, `/renters` have no routes. `frontend/src/app/page.tsx`
  was deliberately removed in Task 1 so that no placeholder ships.
- **No login screen and no shell**, so there is no way to reach the API from a browser yet.
- **No component kit**, so Tasks 7–10 have no primitives to build on.
- **No end-to-end specs** beyond the Task 2 smoke spec.

## Verification

Green, on this branch:

```bash
cd frontend
bun run typecheck        # exit 0
bun run lint             # exit 0
bun run build            # exit 0
bun run test             # 147 passed, 8 files
```

Two things a reader should know before trusting a claim on this branch:

- **`bun run typecheck` requires a clean tree to mean anything.** It resolves `.next/types/`, which
  only exists after `next build` or `next dev`, and both are gitignored. This was fixed in `c2545ab`
  by removing the one generated-type dependency (`LayoutProps<"/">` in `src/app/layout.tsx`), so the
  command now passes on a fresh clone with `.next/` and `next-env.d.ts` deleted. If a future task
  reaches for a generated route or layout type, it will silently re-break first-command
  verification on a fresh clone.
- **`bun` is not on the default `PATH`** on this machine; it lives at `~/.bun/bin`.

### Not verified, and why

- **`bun run test:e2e`** — Chromium cannot launch here (missing shared libraries, no passwordless
  sudo). Task 11 writes the specs; running them needs the browser dependency resolved.
- **The plan's §5 and §6 are stale on the database.** They record "no Docker, no local PostgreSQL" and
  list backend `bun test` and the `E2E_REAL=1` suite as blocked. That is no longer true: a
  PostgreSQL 16 container (`motel-postgres`) is up on `127.0.0.1:5432` with `motel_test` present, and
  `AGENTS.md:73` has been corrected. The plan was left as written because it is the record of what
  was believed at execution time; this file is the correction. **The full backend suite and the
  real-stack E2E suite have not been re-run since the database became available.**
- **Backend tests have not been run against these frontend commits.** The five backend commits were
  verified when they landed, but this branch's frontend work has not been re-validated against a live
  stack.

## Base

The branch is 16 commits ahead of `main`. The last five are backend work from sub-project 2
(`f6284cf` … `40355da`: motel, room and renter CRUD) that the frontend depends on — the four screens
in scope have no meaning without those endpoints. If this branch is reviewed or merged as
"frontend only", those five commits come with it.

## Review state

Every task so far went through spec-compliance and task-quality review, a fix round, and a scoped
re-review. Task 4's spec review returned **PASS**; its task-quality review returned **FAIL** with two
Important findings (an untested endpoint function, and a 2xx with an unparseable body resolving
`undefined` instead of throwing). All 15 findings were fixed in `c2545ab`. **The Task 4 fix round has
not yet had its scoped re-review.**

Task 4 was reviewed against the working tree, not a spec re-read: each task was checked against its
own brief plus the design spec and `docs/frontend-ui-specs.md`, which wins over
`docs/api-contract.md` where they disagree.

## Decisions a later task must not undo

Recorded in full in the plan's §2 and in the local ledger's rulings R1–R6. The load-bearing ones:

- **D1 / ADR-0008** — the browser reaches the backend through a same-origin rewrite. Every browser
  call is a relative `/api/...`; `BACKEND_URL` is server-only and has **no** `NEXT_PUBLIC_` prefix.
  The session cookie is `httpOnly` and host-only, so a cross-origin call could not carry it anyway.
- **D6** — `VndString = string`, guarded at runtime at the API boundary, never parsed to `Number`.
- **D3 + R6** — reads are Server Components, mutations are client components, and that is *why*
  `lib/api/<domain>.ts` and `lib/api/<domain>.client.ts` are separate files: `server.ts` carries
  `import "server-only"`, and one module holding both transports would drag that marker into every
  client bundle. A test enforces the boundary, because `next build` is the only thing that otherwise
  would.
- **R1** — `VndString` is owned by `lib/format/vnd.ts`. `lib/api/types.ts` re-exports it and must
  never redeclare it.
- **D4** — motel selection lives in the URL as `?motel=<uuid>`. Absent → redirect to the first
  motel; not owned by this manager → `notFound()`.
- **D5** — a hand-rolled kit on the `@theme` tokens, native `<dialog>` for modal and drawer. No
  shadcn/ui, no Radix: each would need its own ADR.

## Open questions

Carried from the plan's §7, none blocking Tasks 5–11:

1. `VALIDATION_ERROR` carries no `details.fields`, so server-side field errors are impossible. D8
   routes them to a form-level banner. Fixing the envelope is a separate backend change.
2. The renter list composes contract and invoice summaries with no dedicated endpoints and no
   pagination. Acceptable at manager scale; may not be later.
3. Renter session TTL is 30 days in code and 24h in the spec. Untouched here.

## Before this branch merges

- Run the scoped re-review of the Task 4 fix round.
- Complete Tasks 5–11. **The branch is not shippable as it stands** — it has no reachable route.
- `/review-security` (auth, cookie handling, the proxy's blast radius) and `/review-code`
  (ADR-0004 boundaries, spec conformance, doc drift).
- Re-run the backend suite and the real-stack E2E suite now that PostgreSQL is available.