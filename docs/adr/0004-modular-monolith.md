# ADR-0004 — Backend is a modular monolith

- **Date:** 2026-10-03
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

The system has eight natural domains: auth, motel, room, renter, billing, contract,
ticket, and zalo. The first instinct for a backend of this size is the layout most tutorials
teach — one `routes/` directory, one `services/` directory, one `schema.ts`:

```
routes/rooms.ts
routes/renters.ts
routes/billing.ts
services/room.service.ts
services/billing.service.ts
schema.ts          # every table, hundreds of lines
```

This works until it doesn't. A question like "where does invoice total calculation live,
and what touches it?" ends with a grep across directories that all contain partial answers.
Cross-domain imports accumulate because nothing discourages them, so `billing` quietly
reaches into `room`'s tables and the boundaries stop existing.

The alternative failure mode is premature microservices: nine deployables, nine manifests,
and distributed debugging for a product whose entire user base fits in one Vietnamese city.

## Decision

A modular monolith: one deployable, one database, strict domain boundaries.

Each domain under `backend/src/modules/` owns four things:

```
modules/billing/
  billing.route.ts     # HTTP surface only
  billing.service.ts   # business logic, the module's public interface
  billing.schema.ts    # its Drizzle tables
  billing.types.ts     # inferred types + request/response shapes
```

Rules:

- Cross-module calls go through the other module's **exported service functions**, never
  by importing its tables. If billing needs a room, it calls `roomService.findById()`.
- `db/schemas.ts` exists solely to re-export tables so `drizzle-kit` can see the full
  schema. It is not an import target for application code.
- `shared/` holds genuinely cross-cutting utilities only — money parsing, phone
  normalization, the error taxonomy, magic-link primitives. Anything domain-specific that
  lands there is a module that has not been created yet.
- `db/schemas.ts` may only re-export. If it starts containing logic, that logic belongs in
  a module.

## Consequences

**Good**

- Each domain is one directory a developer can hold in their head
- Interfaces are explicit: `billing.service.ts` exports are the contract everything else sees
- Tables live next to the logic that owns them, so a schema change is a local change
- One deployable, one migration history, one connection pool — none of the distributed cost
- A domain can be extracted into a service later without rewriting it, because its
  interface is already a service boundary

**Bad**

- Enforcing "no cross-module table imports" needs discipline or a lint rule; it is not
  enforced by the compiler today. Worth adding an ESLint `no-restricted-imports` rule once
  the module list stabilises.
- A change spanning two domains touches two directories. Accepted — that visibility is the
  point.
- Shared utilities can become a dumping ground without the "no domain logic" rule, which
  is also only convention today.

**Revisit when** a module needs independent scaling (none plausibly do) or when the team
grows past the point where one person can hold the whole codebase.
