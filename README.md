# Motel Management

Rental and utility billing for Vietnamese motels (nhà trọ). A manager records electricity
and water readings per room each month, the system turns them into itemised bills, and
renters receive a Zalo notification with a link to a mobile portal where they can see the
arithmetic, pay by bank transfer with a VietQR code, sign their contract, and report
problems.

## The problem it solves

Collecting a monthly bill means walking every room with a notebook, reading two meters, then
retyping every number into a spreadsheet or an app at a desk. Two transcription steps per
reading, so every misread becomes a dispute. On top of that, in most motels today:

- renters cannot see how their bill was derived, so they do not trust it
- contract terms live on paper, and expiry dates are noticed too late
- payment is tracked in a notebook, so chasing overdue rent is guesswork
- problems are reported by knocking on the manager's door, which only works if the renter
  is home

## Who it is for

**Managers** of small motels, typically 10–40 rooms, on Android phones, working alone or
with one staff member. Mobile-first is a requirement, not a nicety: the manager is already
holding a phone at the meter.

**Renters**, reachable only over Zalo, on a phone, in Vietnamese. No app to install, no
account to create, no password to forget.

## What it does

- **Rooms and renters** — occupancy, room status, CCCD records, per-motel tenancy
- **Billing** — meter readings in, itemised invoices out, with every line showing its
  derivation
- **On-site capture** — an installable PWA for walk mode: type the reading at the meter,
  photograph it, keep going. Works with no signal and syncs when the phone reconnects
- **VietQR payment** — QR payload built from the motel's own bank account; no gateway, no
  fees, no merchant onboarding. The manager confirms payment
- **Contracts** — clause templates, per-contract overrides, OTP-based e-signature, and a
  30-day expiry reminder
- **Help tickets** — renters report problems with photos; the conversation happens in Zalo,
  not in another chat to build
- **Zalo integration** — free OA messages for renters who follow, paid ZNS only as the
  fallback, so messaging costs stay near zero

## Explicit non-goals

- Payment gateways (VNPay, MoMo, ZaloPay) — VietQR plus manual confirmation only
- In-app chat — Zalo is already on both phones
- Certified digital signatures (chữ ký số) — OTP consent for MVP
- SMS delivery — Zalo only
- Bank statement webhooks / auto-reconciliation
- Multi-currency, multi-language — Vietnamese only
- Native mobile apps — the capture surface is a PWA

## Architecture

Monorepo, Bun workspace, TypeScript throughout.

```
backend/    ElysiaJS on Bun · PostgreSQL + Drizzle · modular by domain
frontend/   Next.js · one app, three route groups: manager, renter, capture
docs/       specs, ADRs, API contract, UI specs
```

A domain module owns its routes, service, tables, and types. Cross-module calls go through
exported service functions, never by importing another module's tables — see
[ADR-0004](docs/adr/0004-modular-monolith.md).

## Documentation

These documents are the project's memory and are expected to stay correct:

| Document | Owns |
|----------|------|
| [Design spec](docs/superpowers/specs/2026-10-03-motel-management-design.md) | Data model, flows, security rules, build order |
| [API contract](docs/api-contract.md) | Endpoints, request/response bodies, error codes |
| [UI specs](docs/frontend-ui-specs.md) | Screens, states, badges, copy |
| [ADRs](docs/adr/) | Decisions that were argued or that add a dependency |
| [`backend/.env.example`](backend/.env.example) | Env var names, with honest placeholders |

Code follows the documents. When a change forces a document to change, they change in the
same commit. See "Docs Are the Source of Truth" in the design spec for which document owns
which fact.

## Build order

Work proceeds in eight sub-projects, each with its own spec → plan → implementation cycle.
Plans are written one at a time, just before the sub-project is built, so table and field
names stay anchored to migrations that actually ran.

| # | Sub-project | Depends on |
|---|-------------|-----------|
| 1 | Core Backend + Database | — |
| 2 | Room & Renter Management | 1 |
| 3 | Billing System | 2 |
| 4 | Contract Management | 2 |
| 5 | Manager Frontend | 2, 3, 4 |
| 6 | On-site Meter Capture (PWA) | 1, 2, 3, 5 |
| 7 | Renter Portal | 2, 3, 4 |
| 8 | Zalo Integration | 3, 4, 7 |

## Commands

Backend:

```bash
cd backend
bun install
bun run dev          # --watch src/index.ts
bun test
```

Frontend:

```bash
cd frontend
bun install
bun run dev
bun run lint
bun run build
```

Local setup:

```bash
cp backend/.env.example backend/.env   # then fill in DATABASE_URL and the two secrets
```
