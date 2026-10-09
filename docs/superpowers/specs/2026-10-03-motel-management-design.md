# Motel Management System — Design Spec

- **Date:** 2026-10-03
- **Status:** Approved for planning
- **Related:** [`docs/frontend-ui-specs.md`](../../frontend-ui-specs.md)

## Overview

Multi-tenant motel management platform for the Vietnamese market. Two user types:
**Manager** (web dashboard) and **Renter** (magic-link web portal reached from Zalo).
Covers room management, utility billing from meter readings, rental contracts with
e-signature, help tickets, and payment collection via VietQR.

### Problem

Small Vietnamese motels (nhà trọ) collect rent manually: a manager walks each room with
a notepad recording điện/nước meter readings, computes each renter's bill by hand, then
chases payment over Zalo chat. Bill disputes are common because renters cannot see how
the number was derived, contract terms live on paper only, and nothing is archived.

### Non-goals (MVP)

Explicitly out of scope. Do not build these without a new spec:

- Payment gateway integration (VNPay, MoMo, ZaloPay) — VietQR + manual confirmation only
- In-app chat between manager and renter — communication happens in Zalo
- E-signature provider integration (FPT.eSign, VNPT SmartSign, Viettel CA)
- SMS delivery for OTPs — no SMS in MVP; configured Zalo transport or another explicitly documented fallback only
- Bank transaction webhooks / auto-reconciliation
- Multi-currency, multi-language UI (Vietnamese only)
- Room amenities catalogue
- Native iOS/Android apps — the capture surface is an installable PWA

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (React, Tailwind CSS, TypeScript) — one app, two route groups |
| Backend | ElysiaJS on Bun (TypeScript) |
| Database | PostgreSQL + Drizzle ORM |
| Messaging | Zalo OA API (free follower messages) + Zalo ZNS (paid, first-contact/critical) |
| Payment | VietQR payload generation, manual confirmation by manager |
| File storage | Cloudflare R2 (S3-compatible API) |
| Capture surface | Installable PWA — service worker app-shell cache + IndexedDB write queue |
| Package manager | Bun (workspace-wide; never npm/yarn) |

## Authentication

| Role | Mechanism |
|------|-----------|
| Manager | Email + password login. JWT in httpOnly cookie. |
| Renter | No account, no password. Identity is `phone` + `motelId`. Access via emailed/sent magic-link token. |

### Renter session lifecycle

The portal must accept two credential forms so a renter is not forced to keep a token
in every URL:

1. **URL token** — `/r/[token]` carries a `MagicLink.token` row value.
2. **Session cookie** — after the first valid URL-token hit, the server sets an
   `httpOnly` `renter_session` cookie and issues `302` to the equivalent token-less path
   (e.g. `/r/[token]/bills` → `/portal/bills`).

Middleware resolves the renter from either credential. A URL token is single-use: it is
marked consumed on first successful exchange. Both credential forms expire after
**24 hours**, after which the renter must request a new link from the manager.

Renter queries are scoped by `renterId` taken from the resolved session — never from
request input — so one renter can never read another's data.

## Data Model

All tables use `UUID` primary keys and `TIMESTAMPTZ` with `now()` defaults.
Money is `NUMERIC(14,0)` (VND has no practical subunit). Meter values are `NUMERIC(12,2)`.

### Enumerations

- `room_status`: `available` | `occupied` | `maintenance`
- `renter_status`: `active` | `inactive`
- `contract_status`: `draft` | `active` | `expired` | `terminated`
- `billing_period_status`: `draft` | `sent` | `closed`
- `meter_type`: `electric` | `water`
- `payment_status`: `unpaid` | `paid` | `overdue`
- `ticket_category`: `electricity` | `water` | `facilities` | `other`
- `ticket_status`: `open` | `in_progress` | `resolved`
- `notification_channel`: `oa_message` | `zns` | `zbs` | `web_push`
- `notification_status`: `pending` | `sent` | `failed`

### managers

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| email | TEXT | UNIQUE, NOT NULL, lowercased |
| passwordHash | TEXT | NOT NULL (argon2id) |
| name | TEXT | NOT NULL |
| phone | TEXT | nullable |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

### motels

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| managerId | UUID | FK → managers, NOT NULL, indexed |
| name | TEXT | NOT NULL |
| address | TEXT | nullable |
| electricityPrice | NUMERIC(14,0) | VND per kWh |
| waterPrice | NUMERIC(14,0) | VND per m³ |
| otherFees | JSONB | `[{name, amount}]` — internet, garbage, parking. Default `[]` |
| bankAccount | JSONB | `{bankCode, accountNumber, accountName}` for VietQR. Default `null` |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

### rooms

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| name | TEXT | NOT NULL, room number as displayed (e.g. `P.101`) |
| basePrice | NUMERIC(14,0) | Default monthly rent, NOT NULL DEFAULT 0 |
| floor | INT | nullable |
| status | room_status | DEFAULT `available` |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

UNIQUE (`motelId`, `name`).

`basePrice` is the room's default rent used to seed a new contract and to render the
room grid. A signed `Contract.monthlyRent` always overrides it when generating an
invoice. See [ADR-0005](../../../adr/0005-room-base-price.md).

### renters

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| name | TEXT | NOT NULL |
| phone | TEXT | NOT NULL, normalized to `84XXXXXXXXX` (no leading `0`/`+`) |
| idNumber | TEXT | CCCD number, nullable |
| idCardFrontUrl | TEXT | Cloudflare R2 URL, nullable |
| idCardBackUrl | TEXT | Cloudflare R2 URL, nullable |
| roomId | UUID | FK → rooms, nullable (unassigned) |
| zaloOaId | TEXT | Set by OA follow webhook, nullable |
| isOaFollower | BOOLEAN | DEFAULT false |
| status | renter_status | DEFAULT `active` |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

UNIQUE (`motelId`, `phone`). Phone is the renter's identity key — a renter who moves to a
different motel is a distinct renter row.

### contract_templates

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| name | TEXT | NOT NULL |
| clauses | JSONB | `[{title, content}]`, NOT NULL |
| isDefault | BOOLEAN | DEFAULT false |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

Partial UNIQUE (`motelId`) WHERE `isDefault` — at most one default per motel.

### contracts

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| renterId | UUID | FK → renters, NOT NULL, indexed |
| roomId | UUID | FK → rooms, NOT NULL, indexed |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| templateId | UUID | FK → contract_templates, nullable |
| startDate | DATE | NOT NULL |
| endDate | DATE | NOT NULL |
| monthlyRent | NUMERIC(14,0) | NOT NULL |
| deposit | NUMERIC(14,0) | NOT NULL DEFAULT 0 |
| clauses | JSONB | Snapshot of template clauses at contract creation |
| otpSentAt | TIMESTAMPTZ | nullable |
| otpSignedAt | TIMESTAMPTZ | nullable |
| status | contract_status | DEFAULT `draft` |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

CHECK (`endDate` > `startDate`). At most one `active` contract per room:
partial UNIQUE (`roomId`) WHERE `status = 'active'`.

### billing_periods

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| month | INT | NOT NULL, 1–12 |
| year | INT | NOT NULL |
| status | billing_period_status | DEFAULT `draft` |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

UNIQUE (`motelId`, `month`, `year`).

### meter_readings

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| roomId | UUID | FK → rooms, NOT NULL, indexed |
| billingPeriodId | UUID | FK → billing_periods, NOT NULL, indexed |
| type | meter_type | NOT NULL |
| previousReading | NUMERIC(12,2) | NOT NULL, seeded from the prior period |
| currentReading | NUMERIC(12,2) | nullable until the manager submits it |
| photoUrl | TEXT | R2 URL of the meter at reading time, nullable |
| readingDate | DATE | nullable |
| createdAt | TIMESTAMPTZ | DEFAULT now() |
| updatedAt | TIMESTAMPTZ | NOT NULL DEFAULT now() — bumped on every accepted write |

UNIQUE (`billingPeriodId`, `roomId`, `type`). CHECK (`currentReading` IS NULL OR
`currentReading` >= `previousReading`) — a meter never runs backwards.

`updatedAt` exists so the server can detect a write based on stale data — a reading
captured offline, or on a second device, that no longer matches the row it read. See
[ADR-0007](../../../adr/0007-onsite-meter-capture.md). There is deliberately no
idempotency-key column: a retried write that already succeeded carries identical values,
so "same value" is treated as success.

### invoices

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| billingPeriodId | UUID | FK → billing_periods, NOT NULL, indexed |
| roomId | UUID | FK → rooms, NOT NULL |
| renterId | UUID | FK → renters, NOT NULL, indexed |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| rentAmount | NUMERIC(14,0) | From the active contract's `monthlyRent` |
| electricityUsage | NUMERIC(12,2) | kWh consumed |
| electricityCost | NUMERIC(14,0) | NOT NULL |
| waterUsage | NUMERIC(12,2) | m³ consumed |
| waterCost | NUMERIC(14,0) | NOT NULL |
| otherFees | JSONB | Snapshot of the motel's `otherFees` at generation time |
| totalAmount | NUMERIC(14,0) | NOT NULL, sum of the components |
| qrCodeData | TEXT | VietQR payload string (see below) |
| paymentStatus | payment_status | DEFAULT `unpaid` |
| paidAt | TIMESTAMPTZ | nullable |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

UNIQUE (`billingPeriodId`, `roomId`). Money fields are snapshots — later edits to a
motel's prices or fees never retroactively change a sent invoice.

### help_tickets

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| renterId | UUID | FK → renters, NOT NULL, indexed |
| roomId | UUID | FK → rooms, NOT NULL |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| category | ticket_category | NOT NULL |
| description | TEXT | NOT NULL |
| photoUrls | JSONB | Array of R2 URLs, default `[]`, max 5 files |
| status | ticket_status | DEFAULT `open` |
| managerNote | TEXT | Internal only; never exposed on the renter portal |
| createdAt | TIMESTAMPTZ | DEFAULT now() |
| resolvedAt | TIMESTAMPTZ | nullable |

### magic_links

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| renterId | UUID | FK → renters, NOT NULL, indexed |
| token | TEXT | UNIQUE, NOT NULL, 32 bytes crypto-random base64url |
| expiresAt | TIMESTAMPTZ | NOT NULL, createdAt + 24h |
| consumedAt | TIMESTAMPTZ | nullable — set on first exchange |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

### zalo_notifications

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| renterId | UUID | FK → renters, NOT NULL, indexed |
| motelId | UUID | FK → motels, NOT NULL, indexed |
| channel | notification_channel | NOT NULL — `oa_message` or `zns` |
| templateId | TEXT | ZNS template id, nullable for OA messages |
| payload | JSONB | Rendered message content |
| status | notification_status | DEFAULT `pending` |
| failureReason | TEXT | nullable |
| sentAt | TIMESTAMPTZ | nullable |
| createdAt | TIMESTAMPTZ | DEFAULT now() |

## Backend Architecture (Modular)

Domain modules own their routes, service logic, Drizzle tables, and types. Cross-module
dependencies go through a module's exported service functions, never through another
module's tables. See [ADR-0004](../../../adr/0004-modular-monolith.md).

```
backend/src/
  index.ts                      # App assembly, plugin registration, listen
  env.ts                        # Typed env parsing, fails fast on boot
  db/
    index.ts                    # Drizzle client (pooled postgres-js)
    migrate.ts                  # Migration runner script
    schemas.ts                  # Re-exports every module's tables for drizzle-kit
  middleware/
    manager-auth.ts             # Requires manager JWT
    renter-auth.ts              # Resolves renter from URL token or session cookie
    error-handler.ts            # Normalizes thrown errors to the error envelope
  modules/
    auth/          auth.route.ts  auth.service.ts  auth.types.ts
    motel/         motel.route.ts motel.service.ts motel.schema.ts motel.types.ts
    room/          room.route.ts  room.service.ts  room.schema.ts  room.types.ts
    renter/        renter.route.ts renter.service.ts renter.schema.ts renter.types.ts
    billing/       billing.route.ts billing.service.ts billing.schema.ts billing.types.ts
    contract/      contract.route.ts contract.service.ts contract.schema.ts contract.types.ts
    ticket/        ticket.route.ts ticket.service.ts ticket.schema.ts ticket.types.ts
    zalo/          zalo.route.ts  zalo.service.ts  zalo-oa.client.ts
                   zalo-zns.client.ts zalo.types.ts
    vietqr/        vietqr.service.ts vietqr.types.ts
  shared/
    money.ts                     # VND parse/format, NUMERIC string coercion
    phone.ts                     # Vietnamese phone normalization
    errors.ts                    # AppError taxonomy → error envelope
    magic-link.ts                # Token create/consume/validate
```

## Frontend Architecture

One Next.js app, three route groups. Manager and renter surfaces share components but
never share a layout.

```
frontend/src/
  app/
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (dashboard)/layout.tsx             # Sidebar + motel selector
    (dashboard)/page.tsx               # Overview
    (dashboard)/motels/...
    (dashboard)/rooms/...
    (dashboard)/renters/...
    (dashboard)/billing/page.tsx
    (dashboard)/billing/[periodId]/page.tsx
    (dashboard)/billing/[periodId]/invoices/page.tsx
    (dashboard)/contracts/page.tsx
    (dashboard)/contracts/[id]/page.tsx
    (dashboard)/contracts/templates/page.tsx
    (dashboard)/contracts/templates/[id]/page.tsx
    (dashboard)/tickets/page.tsx
    (dashboard)/tickets/[id]/page.tsx
    (dashboard)/settings/page.tsx
    (capture)/layout.tsx               # Full-screen, one-handed, no sidebar
    (capture)/capture/page.tsx         # Draft periods
    (capture)/capture/[periodId]/page.tsx          # Walk queue + progress + sync state
    (capture)/capture/[periodId]/room/[readingId]/page.tsx   # Single room entry
    (renter)/layout.tsx                # Minimal, motel-branded
    (renter)/r/[token]/page.tsx        # Magic-link landing → 302 to /portal
    (renter)/portal/page.tsx           # Current bill summary
    (renter)/portal/bills/page.tsx
    (renter)/portal/bills/[id]/page.tsx
    (renter)/portal/contract/page.tsx
    (renter)/portal/tickets/page.tsx
    (renter)/portal/tickets/new/page.tsx
  lib/
    api/          # typed fetch wrappers per domain module
    auth/         # cookie helpers for both roles
    format.ts     # VND, date (DD/MM/YYYY), phone formatting
  capture/
    queue.ts      # IndexedDB write queue, sync-on-reconnect, conflict detection
    sw.ts         # service worker: app shell precache + active-period GET cache
```

The capture screens are **client components** that read from the API, never server
components. The service worker cannot meaningfully cache an RSC payload, so the capture
route group must not depend on server-rendered data. That constraint is the main technical
risk in sub-project 6 and should be proven first, not last.

`/r/[token]` is the only token-bearing route. It exchanges the token for a session
cookie and redirects; every other renter page lives under `/portal` and is reachable
only by cookie.

## Key Flows

### Billing flow

1. Manager creates a `billing_period` (month/year) for a motel.
2. System seeds `meter_readings` rows for every room and meter type, copying each
   room's latest prior `currentReading` into `previousReading`. A room with no prior
   reading starts at `0`.
3. Manager enters `currentReading` per room. The UI recalculates live and flags
   `currentReading < previousReading` and consumption above 500 kWh / 30 m³.
4. On generate, for every room with an active contract, the system writes one invoice:
   - `rentAmount` = `contract.monthlyRent`
   - `electricityCost` = (`currentReading` − `previousReading`) × `motel.electricityPrice`, rounded to whole VND half-up
   - `waterCost` = (`currentReading` − `previousReading`) × `motel.waterPrice`, rounded to whole VND half-up
   - Meter arithmetic uses fixed-point hundredths and never JavaScript floating-point numbers.
   - `otherFees` = snapshot of `motel.otherFees`
   - `totalAmount` = `rentAmount` + `electricityCost` + `waterCost` + Σ `otherFees.amount`
   - `qrCodeData` = VietQR payload built from `motel.bankAccount` and `totalAmount`
5. Rooms without an active contract are skipped and reported back to the manager; they
   never produce a partial invoice.
6. Manager reviews drafts, then confirms → period status `sent`.
7. Billing commits period state independently from outbound delivery. Notification enqueue occurs after commit or through an outbox transaction; enqueue failure leaves the period unchanged and returns `EXTERNAL_SERVICE_ERROR`. A later delivery failure leaves the sent period committed, records a failed notification, and exposes **Gửi lại** without reverting billing state.
8. Renter opens the link, sees the breakdown, scans the VietQR code, pays in their
   banking app.
9. Manager marks the invoice `paid`, which stamps `paidAt`; payment notification is
   handled by sub-project 8. Payment commits independently from delivery: enqueue failure rolls back the payment mutation, while post-enqueue delivery failure leaves `paid` committed and retryable without changing payment state.

### Contract flow

1. Manager creates or edits a `contract_template` (ordered `[{title, content}]` clauses).
2. Manager creates a contract for a renter, picking a template and overriding individual
   clauses. `clauses` snapshots the result.
3. Contract is saved as `draft` and a magic link is sent to the renter.
4. Renter reviews the contract on the portal and taps **Ký hợp đồng**.
5. System generates a 6-digit OTP and sends it over Zalo (channel chosen by the same
   OA-follower rule as every other notification). `otpSentAt` is stamped.
6. Renter enters the OTP within 5 minutes. On success `otpSignedAt` is stamped and
   status becomes `active`; the room flips to `occupied`.
7. A daily job finds contracts expiring in 30 days and sends a reminder.

MVP consent is OTP-based. Upgrade to a certified provider (FPT.eSign, VNPT SmartSign,
Viettel CA) only when a use case requires chữ ký số — see
[ADR-0006](../../../adr/0006-otp-consent-e-signature.md).

### Notification strategy

A notification is an outbound event; a channel is its transport. Web Push is primary after renter activation. ZNS/ZBS is activation/fallback transport; SMS is out of MVP unless separately documented. Delivery is queued/sent/failed and never promised by a domain route.

### Zalo notification strategy

Channel routing keeps Zalo costs low — see
[ADR-0003](../../../adr/0003-zalo-oa-vs-zns-routing.md):

1. On renter creation, send a paid ZNS welcome containing the magic link and the OA
   follow prompt. Followers cannot exist before first contact.
2. The OA follow webhook sets `isOaFollower = true` and `zaloOaId` when OA transport is configured.
3. For configured Zalo transport, later notification delivery may use the follower state to select OA message or ZNS/ZBS fallback. This is one provider path under the notification strategy, not the only post-activation channel.

Triggers: bill ready, payment confirmed, contract sent for signing, OTP delivery,
contract expiry reminder (30 days), ticket status change, ticket created.

Every attempt writes a `zalo_notifications` row. On API failure the row is stored with
`status = 'failed'` and `failureReason`, and the manager UI surfaces a **Gửi lại**
action. There is no background retry queue in the MVP.

### Help ticket flow

1. Renter submits a ticket from the portal: category, description, up to 5 photos.
2. Manager sees it in the dashboard ticket list.
3. Two-way conversation happens in Zalo, not in the app.
4. Manager records an internal note and moves the ticket through
   `open → in_progress → resolved`; `resolvedAt` is stamped on resolve.
5. Status changes trigger a Zalo notification so the renter learns the outcome without
   checking the portal.

### On-site meter capture flow

The manager currently walks the building writing readings on paper, then retypes them into
the desktop dashboard. Two transcription steps, and every misread becomes a dispute. This
flow removes the paper. See [ADR-0007](../../../adr/0007-onsite-meter-capture.md).

1. Manager opens the installable PWA from the home screen and taps **Chốt số**, landing on
   a list of `draft` periods only.
2. Picking a period fetches the period plus every room's `previousReading`. The service
   worker caches that payload, so the walk works with no signal.
3. Walk mode: one full-screen room entry at a time. `previousReading` is shown large and
   read-only, `currentReading` gets a large numeric input, and the computed cost appears
   live beneath it (`150 kWh × 3.500 ₫ = 525.000 ₫`) so a misread is caught at the meter.
   A camera button attaches `photoUrl`.
4. **Save** writes to a local IndexedDB queue and advances to the next room immediately.
   The manager never waits on the network mid-round, and a partially completed round is
   never lost.
5. On reconnect the queue flushes. Each queued write carries the `updatedAt` it read; the
   server compares it against the stored row.
   - equal, or the value already matches → accepted, `updatedAt` bumped
   - differs → `409 READING_CONFLICT` carrying the server's current value
6. A conflicted room gets a **Cần kiểm tra** chip in the walk queue and the manager
   re-enters that one number. Last write never silently wins — a silently overwritten
   reading is precisely the error this feature exists to remove.
7. Photo uploads retry independently: a failed upload leaves the reading saved without a
   photo and re-queues only the image.
8. When every room in the period has a `currentReading`, the footer CTA becomes
   **Hoàn tất & tạo hóa đơn**, which runs the same invoice generation the desktop
   triggers. Desktop batch entry remains available and writes the same rows.

The meter photo is shown to the renter on the invoice detail page. That transparency is
the main dispute-reduction lever in the product, and it costs one column.

## VietQR Integration

- **Output of record is the payload string**, stored in `invoices.qrCodeData` and built
  to the VietQR/Napas EMVCo spec from `motel.bankAccount` plus `totalAmount`.
- The QR **image is rendered from that payload at request time**. Nothing calls a payment
  gateway, so no network call stands between a renter viewing a bill and seeing a code.
- Transfer description format: `[motelName] T[month]/[year] P[roomName]` — stable, short
  enough for a bank transfer memo, and enough for the manager to match a bank statement
  line to an invoice by eye.
- No webhook or auto-confirmation. The manager marks invoices paid manually. See
  [ADR-0002](../../../adr/0002-manual-payment-confirmation.md).

## E-Signature (MVP: OTP Consent)

1. Renter taps **Ký hợp đồng** on the portal.
2. System generates a 6-digit OTP, sends it over Zalo, stamps `otpSentAt`.
3. Renter enters the OTP within **5 minutes**; max **3 attempts**.
4. On success: `otpSignedAt = now()`, `status = 'active'`, room becomes `occupied`.
5. On expiry or exhaustion the renter requests a new OTP; the previous one is invalidated.

OTP delivery uses configured notification channels; Zalo transport may be used, but no route promises delivery. SMS is out of MVP scope.

## File Storage

Cloudflare R2 via its S3-compatible API. Buckets: `motel-uploads`, private, served through
short-lived signed URLs so CCCD scans and ticket photos are never publicly listable.
Constraints: image MIME types only, 5 MB per file, 5 files per ticket.

## Error Handling

All API errors use one envelope:

```json
{ "error": "human readable message", "code": "MACHINE_CODE", "details": {} }
```

`details` is omitted unless it helps the caller. Codes are stable identifiers; messages
are user-facing and may be localized later.

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request failed schema validation. Carries no `details` — see [`docs/api-contract.md`](../../api-contract.md), which owns the envelope |
| `UNAUTHORIZED` | 401 | Missing or expired credential |
| `MAGIC_LINK_EXPIRED` | 401 | Magic link past `expiresAt`, or already consumed |
| `OTP_INVALID` | 401 | Wrong OTP, or the 3-attempt allowance is exhausted |
| `OTP_EXPIRED` | 401 | OTP past its 5-minute window |
| `FORBIDDEN` | 403 | Valid credential, wrong role |
| `NOT_FOUND` | 404 | Row absent, or hidden from this tenant |
| `CONFLICT` | 409 | Uniqueness or state violation (duplicate period, room already has an active contract) |
| `READING_CONFLICT` | 409 | A reading write was based on a stale `updatedAt`; `details.server` carries the current row |
| `PERIOD_ALREADY_SENT` | 409 | Capture or generation attempted on a period that is no longer `draft` |
| `RATE_LIMITED` | 429 | OTP or magic-link request too frequent; `details.retryAfterSeconds` |
| `EXTERNAL_SERVICE_ERROR` | 502 | Zalo or R2 rejected the call; `details.failureReason` carries the upstream message |
| `INTERNAL_ERROR` | 500 | Unexpected server fault; details stay server-side |

Other rules:

- Meter validation: `currentReading >= previousReading`, enforced by a DB CHECK as well as
  the API layer.
- Invoice generation skips rooms with no active contract and returns the skipped rooms in
  `details`.
- Magic-link expiry returns `401` with code `MAGIC_LINK_EXPIRED`; the portal renders a
  "link expired, contact your manager on Zalo" screen rather than a raw error.
- A capture session whose period was sent from another device stops accepting writes and
  renders the period read-only with a banner, rather than failing each room individually.

## Security

- Manager JWT and renter session both live in `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- Manager JWT carries `sub` (manager id). Renter session carries `sub` (renter id) and
  `motelId`. Tenant scope is derived from the session, never from the request body.
- `motel-scope` resolution: every manager query filters by a motel the manager owns.
  A motel id the manager does not own returns `404`, not `403`, so the API does not
  confirm that another tenant's motel exists.
- Passwords hashed with argon2id. Manager login is rate-limited per IP and per email.
- Magic-link tokens: 32 crypto-random bytes, 24-hour expiry, single-use.
- OTP: 5-minute expiry, max 3 attempts, resend blocked for 5 minutes.
- Uploads: MIME allowlist, 5 MB cap, private bucket, signed URLs.
- `photoUrl` columns store an R2 **object key**, never a public URL. Every response that
  exposes a photo — meter photo to a renter, ticket photo, CCCD scan — swaps the key for a
  short-lived signed URL at serialization time, so no stored value is a capability.
- Meter photos are deliberately visible to the renter on their invoice. That is the
  intended dispute-reduction behaviour, not a leak.
- `managerNote` is selected out of every renter-facing query at the service layer, not
  filtered in the UI.

## Sub-Project Build Order

Each sub-project gets its own spec → plan → implementation cycle.

| # | Sub-project | Depends on |
|---|-------------|-----------|
| 1 | Core Backend + Database — env parsing, Drizzle schema, migrations, auth + tenant middleware, error envelope | — |
| 2 | Room & Renter Management — motels, rooms, renters CRUD, magic-link issuing | 1 |
| 3 | Billing System — periods, meter readings, invoice generation, VietQR payloads | 2 |
| 4 | Contract Management — templates, contracts, OTP signing | 2 |
| 5 | Manager Frontend — dashboard and all manager pages | 2, 3, 4 |
| 6 | On-site Meter Capture — installable PWA, offline queue, meter photos | 1, 2, 3, 5 |
| 7 | Renter Portal — magic-link landing, bills, contract view, ticket submission | 2, 3, 4 |
| 8 | Zalo Integration — OA client, ZNS client, follow webhook, notification triggers | 3, 4, 7 |

Plans are written one at a time, immediately before the sub-project is built, so table
and field names stay anchored to migrations that actually ran. Writing all eight up
front guarantees drift.

## Docs Are the Source of Truth

The specs, ADRs, API contract, and env example are this project's memory. Code follows
them. When reality forces a change, the documents change in the same commit as the code
that forced it — a document that contradicts the code is a defect, not a historical
artifact.

Which document owns which fact, and what must be edited together:

| Fact | Owner | Also update |
|------|-------|-------------|
| Tables, columns, constraints, flows, security rules | this spec | API contract if exposed over HTTP; `.env.example` if it adds a variable |
| Endpoint paths, request/response bodies, error codes | `docs/api-contract.md` | this spec if a rule changed; UI spec if a screen's states changed |
| Screens, states, badges, copy | `docs/frontend-ui-specs.md` | API contract if a status or code was added |
| Env var names | `backend/.env.example` | this spec if a new external service appeared |
| Argued or dependency-bearing decisions | `docs/adr/` | linked from this spec |
| What must be tested, and at which layer | `docs/testing-strategy.md` | linked from this spec |

Rules that make drift visible rather than silent:

- Nothing ships with `TBD`, an unfinished section, or a requirement that could be read two
  ways. Placeholders are allowed **only** in `.env.example`, where the placeholder is the
  honest state of a value Zalo or Cloudflare has not issued yet.
- Any value appearing in more than one document is stated once and linked from the
  others. Currency, statuses, and error codes are enumerated in exactly one place each.
- A change that alters a status, an enum, or an error code is not complete until the
  design spec, the UI badge table, and the API contract all agree.
- New third-party dependency → new ADR. A decision that was argued → new ADR, even when
  the outcome looks obvious.

## Open Items

Deliberately unresolved, each deferred to a named decision point:

- **ZNS template ids** — assigned by Zalo after OA approval. Env vars ship as
  placeholders; sending fails closed with `EXTERNAL_SERVICE_ERROR` until filled in.
- **Chữ ký số provider** — re-evaluate when a contract type legally requires it.
- **Bank reconciliation** — manual today; revisit if a motel runs enough rooms that
  matching statements by eye becomes the bottleneck.
- **Offline capture conflict granularity** — MVP resolves per reading (one room, re-enter
  the number). Whole-period locking would be stricter; revisit if two managers regularly
  capture the same motel at the same time.
