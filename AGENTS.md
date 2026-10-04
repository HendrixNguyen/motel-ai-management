# Motel Management Architecture & Conventions

## Architecture
- Monorepo structure with separated frontend and backend.
- **Frontend**: `frontend/` (Next.js, React, Tailwind CSS, TypeScript).
- **Backend**: `backend/` (ElysiaJS, TypeScript).
- **Runtime & Package Manager**: Bun across the workspace.

## Commands

### Frontend
- Dev: `cd frontend && bun run dev`
- Build: `cd frontend && bun run build`
- Lint: `cd frontend && bun run lint`

### Backend
- Dev: `cd backend && bun run dev` (runs `--watch src/index.ts`)
- Test: `cd backend && bun test`
- Typecheck: `cd backend && bun run typecheck`
- Migrations: `cd backend && bun run db:generate` then `bun run db:migrate`

## Testing
`docs/testing-strategy.md` is the contract. The short version:

- Tests run against a real PostgreSQL database (`TEST_DATABASE_URL`), not a mock. A mock
  cannot enforce a `CHECK` constraint, so it cannot test the rule most likely to break.
- Every `UNIQUE`, `CHECK`, and partial unique index gets a test that tries to violate it.
- Tenant scoping is tested **over HTTP** with a real session cookie and a real foreign id,
  in both directions: manager→manager and renter→renter. Cross-tenant denial is `404`,
  never `403`.
- A behaviour change without a test is an unfinished change.
- A test that cannot fail is worse than no test — delete it.

## Review Agents
Two read-only reviewers live in `.kilo/agent/`. Run them before merging:

| Command | Reviewer | Use for |
|---------|----------|---------|
| `/review-security` | `security-reviewer` | anything touching auth, tenancy, uploads, money, webhooks |
| `/review-code` | `code-reviewer` | module boundaries (ADR-0004), spec conformance, types, tests, doc drift |

Both report findings with `file_path:line_number` and severity. Both treat a missing test as
a finding. They do not edit files.

## Conventions
- Use `bun` for all package management and script execution. Do not use npm/yarn.
- Strict TypeScript in both projects.
- Frontend uses `@/*` for imports mapped to `src/*`.
- Backend is a modular monolith: domain modules under `backend/src/modules/` own their
  routes, service, Drizzle tables, and types. Cross-module calls go through exported
  service functions, never by importing another module's tables. See
  `docs/adr/0004-modular-monolith.md`.

## Documentation Rules
These documents are the project's memory and must stay correct. Code follows them; when a
change forces a document to change, they change in the same commit.

| Document | Owns |
|----------|------|
| `docs/superpowers/specs/2026-10-03-motel-management-design.md` | Data model, flows, security rules, build order |
| `docs/api-contract.md` | Endpoints, request/response bodies, error codes |
| `docs/frontend-ui-specs.md` | Screens, states, badges, copy |
| `docs/testing-strategy.md` | What must be tested and at which layer |
| `docs/adr/` | Decisions that were argued or that add a dependency |
| `backend/.env.example` | Env var names, with honest placeholders |

- State a fact once, in the document that owns it. Link from the others; do not restate.
- Changing a table → update the design spec, plus the API contract if the field is exposed
  over HTTP, plus `.env.example` if it adds a variable.
- Changing a status, enum, or error code → the design spec, the UI badge table, and the
  API contract must all agree before the change is complete.
- No `TBD`, no unfinished sections, no requirement that can be read two ways. Placeholders
  are allowed only in `.env.example`, where the placeholder is the honest state of a value
  Zalo or Cloudflare has not issued yet.
- New third-party dependency → new ADR.
