# API Contract

- **Date:** 2026-10-03
- **Base URL:** `/api`, always **same-origin**. The browser calls relative `/api/...` and the
  frontend rewrites it onto the backend (`/api/:path*` → `${BACKEND_URL}/api/:path*`), so a
  request carries the session cookie without any CORS involvement. `BACKEND_URL` is
  **server-only** — never `NEXT_PUBLIC_`. See
  [ADR-0008](adr/0008-frontend-transport-same-origin-proxy.md).
- **Format:** JSON in, JSON out. Dates `YYYY-MM-DD`. Timestamps ISO-8601 UTC. Money is a
  JSON **string** of VND digits (`"3850000"`) — never a float, never `đ`.
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](superpowers/specs/2026-10-03-motel-management-design.md)

## Auth

| Prefix           | Credential     | Session                           |
| ---------------- | -------------- | --------------------------------- |
| `/api/manager/*` | Manager JWT    | `manager_session` httpOnly cookie |
| `/api/renter/*`  | Renter session | `renter_session` httpOnly cookie  |

Tenant scope is always derived from the session. No endpoint accepts a `managerId` from the
client. A motel belonging to another manager returns `404`, never `403`.

## Error envelope

```json
{ "error": "Không tìm thấy hóa đơn", "code": "NOT_FOUND", "details": {} }
```

`details` is omitted unless it aids the caller. `error` is user-facing Vietnamese;
`code` is a stable machine identifier.

**A `VALIDATION_ERROR` carries no `details`.** The router rejects a body that fails its schema
before any service runs, and the envelope it returns is `{ error, code }` alone — there are no
field names to map. Only an `AppError` raised by a service may attach `details`, and no
validation path raises one today. A client therefore renders a `VALIDATION_ERROR` as one
form-level message; it cannot attribute the failure to a field.

| Code                     | HTTP | When                                                                            |
| ------------------------ | ---- | ------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`       | 400  | Schema validation failed. No `details` — see above                              |
| `UNAUTHORIZED`           | 401  | Missing, malformed, or expired credential                                       |
| `MAGIC_LINK_EXPIRED`     | 401  | Magic link past `expiresAt` or already `consumedAt`                             |
| `OTP_INVALID`            | 401  | Wrong OTP or three-attempt allowance exhausted                                  |
| `OTP_EXPIRED`            | 401  | OTP missing or past 5 minutes                                                   |
| `RATE_LIMITED`           | 429  | Too many OTP or magic-link requests; `details.retryAfterSeconds`                |
| `READING_CONFLICT`       | 409  | Reading write based on a stale `updatedAt`; `details.server` is the current row |
| `PERIOD_ALREADY_SENT`    | 409  | Capture or generation on a period that is no longer `draft`                     |
| `FORBIDDEN`              | 403  | Valid credential, wrong role                                                    |
| `NOT_FOUND`              | 404  | Row absent or outside the caller's tenant                                       |
| `CONFLICT`               | 409  | Uniqueness or state violation                                                   |
| `EXTERNAL_SERVICE_ERROR` | 502  | Configured notification or private-storage provider rejected the call; `details.failureReason` is safe and optional |
| `INTERNAL_ERROR`         | 500  | Unexpected server fault; details stay server-side                               |

## Manager endpoints

### Renter signing — `/api/renter/contracts/:contractId`

Renter session JWT and cookie expire after 24 hours. API routes use `/api/renter/contract` for latest contract and `/api/renter/contracts/:contractId` for one contract. Frontend canonical routes use `/portal/contract`; legacy `/renter/home`, `/renter/contract`, and `/renter/tickets` are removed.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/contracts/:contractId` | — | `200 Contract`; renter session scopes access |
| POST | `/contracts/:contractId/sign-request` | — | `200 {sentAt}`; six-digit OTP is never returned |
| POST | `/contracts/:contractId/verify` | `{otp}` | `200 Contract` with `status=active`; invalid or exhausted OTP uses `OTP_INVALID`; missing or expired OTP uses `OTP_EXPIRED` |

OTP values are Argon2id-hashed with `Bun.password`, expire after five minutes, allow one request per five-minute cooldown, and permit at most three failed attempts. Verification activates contract and records `otpSignedAt` in one transaction. Zalo delivery is not wired in this task; default sender rejects delivery, so deployment must configure `setRenterOtpSender` before enabling sign requests.

### Contracts — `/api/manager/motels/:motelId/contracts`

| Method | Path                               | Body                                                                                    | Returns                                                                   |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/contracts`                       | `{renterId, roomId, templateId?, startDate, endDate, monthlyRent?, deposit?, clauses?}` | `201 Contract` (draft; clauses and rent snapshotted)                      |
| GET    | `/contracts`                       | —                                                                                       | `200 Contract[]`                                                          |
| GET    | `/contracts/:contractId`           | —                                                                                       | `200 Contract`                                                            |
| PATCH  | `/contracts/:contractId`           | draft fields only                                                                       | `200 Contract`; non-draft returns `409 CONFLICT`                          |
| POST   | `/contracts/:contractId/send`      | —                                                                                       | `200 Contract`; notification failure returns `502 EXTERNAL_SERVICE_ERROR` |
| POST   | `/contracts/:contractId/terminate` | —                                                                                       | `200 Contract` with `status=terminated`                                   |

Contract creation validates motel ownership for renter, room, and template. Missing `monthlyRent` uses room `basePrice`; template clauses are copied into contract snapshot. Send stamps `otpSentAt` only after notification seam succeeds.

### Contract templates

### Auth — `/api/auth`

| Method | Path        | Body                              | Returns                               |
| ------ | ----------- | --------------------------------- | ------------------------------------- |
| POST   | `/register` | `{email, password, name, phone?}` | `201 {id, email, name}` + sets cookie |
| POST   | `/login`    | `{email, password}`               | `200 {id, email, name}` + sets cookie |
| POST   | `/logout`   | —                                 | `204` + clears cookie                 |
| GET    | `/me`       | —                                 | `200 {id, email}`                     |

`password` ≥ 8 characters. Login is rate-limited per IP and per email.

**`/me` has no `name`, and that is not an omission to be tidied up.** It reads the claims off the
manager JWT, which never carried one, so a client that renders a name from `/me` renders
`undefined`. The three calls that set or clear the cookie are made by the **browser** through the
proxied path, so the backend's own `Set-Cookie` reaches the browser unchanged; `/me` is a read and
is made from a Server Component with the cookie forwarded.

### Magic links — `/api/renter/magic-links`

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/exchange` | `{token}` | `200 {renterId,motelId}`; sets 24-hour `renter_session` httpOnly cookie and consumes token |
| POST | `/resend` | — | `200 {message,url}`; renter session required; URL is `${RENTER_PORTAL_URL}/r/<token>`; this manager-issued resend path is superseded in favor of manager-issued links and is not part of current frontend rollout |
| POST | `/api/renter/logout` | — | `204 No Content`; clears `renter_session` httpOnly cookie |

`MAGIC_LINK_EXPIRED` is returned for expired or consumed tokens. Exchange validation failures use
`{error,code}` with `VALIDATION_ERROR`; token values never appear in logs or response bodies.


### Manager-issued magic links — `/api/manager/motels/:motelId/renters/:renterId`

| Method | Path          | Body | Returns                                                 |
| ------ | ------------- | ---- | ------------------------------------------------------- |
| POST   | `/magic-link` | —    | `200 {token, url}` — manager-issued link for the renter |

### Motels — `/api/manager/motels`

| Method | Path        | Notes                                                                                                                          |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/`         | All motels owned by the manager                                                                                                |
| POST   | `/`         | Create; `400 VALIDATION_ERROR` if `electricityPrice`/`waterPrice` are missing or not strings                                   |
| GET    | `/:motelId` | `404` if not owned by caller                                                                                                   |
| PATCH  | `/:motelId` | Partial update of prices, fees, bank account, address. A key absent from the body is never written; an explicit `null` clears. |
| DELETE | `/:motelId` | `409` while anything still points at it — occupied rooms, rooms, renters, billing periods or contract templates                |

### Rooms — `/api/manager/motels/:motelId/rooms`

| Method | Path       | Notes                                                                               |
| ------ | ---------- | ----------------------------------------------------------------------------------- |
| GET    | `/`        | Supports `?floor=&status=&search=`; `basePrice` returned as VND digit string        |
| POST   | `/`        | `409 CONFLICT` on duplicate `(motelId, name)`; `basePrice` as VND digit string      |
| GET    | `/:roomId` | `basePrice` returned as VND digit string                                            |
| PATCH  | `/:roomId` | Partial update of name, floor, `basePrice`, status; `basePrice` as VND digit string |
| DELETE | `/:roomId` | `409 CONFLICT` if an active contract exists OR any renter is assigned to the room   |

### Renters — `/api/manager/motels/:motelId/renters`

| Method | Path         | Notes                                                                  |
| ------ | ------------ | ---------------------------------------------------------------------- |
| GET    | `/`          | Supports `?status=&roomId=&search=`                                    |
| POST   | `/`          | `409` on duplicate `(motelId, phone)`; creates renter and manager-issued magic-link fallback remains available |
| GET    | `/:renterId` | Includes contract summary and invoice history                          |
| PATCH  | `/:renterId` | Name, phone, CCCD, `idCardFrontUrl`, `idCardBackUrl`, `roomId`, status |
| DELETE | `/:renterId` | Soft-delete: sets `status = inactive`, keeps financial history         |

Phone is normalized to `84XXXXXXXXX` on write.

### Billing — `/api/manager/motels/:motelId/billing`

| Method | Path                           | Notes                                                                                                                                                                                          |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/periods`                     | All periods, newest first                                                                                                                                                                      |
| POST   | `/periods`                     | `{month, year}`; `409` if that month already exists; seeds `meter_readings`                                                                                                                    |
| GET    | `/periods/:periodId`           | Period + per-room reading rows with previous/current                                                                                                                                           |
| PUT    | `/periods/:periodId/readings`  | Atomic batch upsert; stale row writes return `409 READING_CONFLICT`; `400` if `currentReading < previousReading`; `409 PERIOD_ALREADY_SENT` once sent. See [Capture sync](#meter-capture-sync) |
| POST   | `/periods/:periodId/invoices`  | Generates invoices; `details.skippedRooms` lists rooms with no active contract                                                                                                                 |
| GET    | `/periods/:periodId/invoices`  | Invoice list with statuses                                                                                                                                                                     |
| POST   | `/periods/:periodId/send`      | Period → `sent`; notification delivery is deferred to sub-project 8                                                                                                                            |
| PATCH   | `/invoices/:invoiceId/paid`    | `410 GONE`; use payment-proof approval or cash confirmation                                                                                                                            |
| PATCH  | `/invoices/:invoiceId/overdue` | Manual overdue marking                                                                                                                                                                         |

Invoice generation is idempotent per `(billingPeriodId, roomId)`: re-running updates invoices while preserving invoice identity and payment state. Amounts, fees, rent, utility usage, and QR payload are snapshots. Once the period is `sent`, generation returns `409`; sent-period readings and invoices are immutable.

### Meter capture sync

The PWA (see [ADR-0007](adr/0007-onsite-meter-capture.md)) reads a period with the existing
`GET /periods/:periodId` endpoint and writes through the existing
`PUT /periods/:periodId/readings`. No capture-only endpoints exist — capture is a client of
the same API the desktop uses, which is why both paths can coexist on one unique row.

`PUT /periods/:periodId/readings` request body:

```json
{
  "readings": [
    {
      "roomId": "uuid",
      "type": "electric",
      "currentReading": "1450",
      "photoUrl": "uploads/motels/<motelId>/meters/2026-10/<uuid>.jpg",
      "expectedUpdatedAt": "1791018862000000"
    }
  ]
}
```

`expectedUpdatedAt` is the exact PostgreSQL `updated_at` epoch-microseconds version string returned as each reading's `updatedAt`. Keep it opaque; never parse through JavaScript `Date`. Per-row outcomes:

| Server state | Response | Notes |
|--------------|----------|-------|
| `expectedUpdatedAt` matches | row accepted, `updatedAt` bumped | Atomic compare-and-swap; any stale version conflicts, including equal values; client must refresh and re-enter |
| `expectedUpdatedAt` stale and value differs | `409 READING_CONFLICT`, `details.server` = current row | Client flags **Cần kiểm tra**; manager re-enters. Last write never silently wins |
| Reading row is missing | `404 NOT_FOUND` | Missing row takes precedence over stale version; whole batch rolls back |
| Period is no longer `draft` | `409 PERIOD_ALREADY_SENT` | Client switches the whole capture session read-only |

Meter photos use private storage. `photoUrl` remains accepted only as an opaque server-side key during reading updates and is never returned. Upload and signed-read endpoints:

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/api/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo` | `multipart/form-data`, one `file`; JPEG/PNG, max 10 MB | `201 {id, contentType, size, checksum, createdAt}` |
| GET | `/api/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo` | none | `200 {url, contentType, size, checksum}`; URL short-lived |

Upload requires manager ownership, matching reading/period, and `draft` period status. Invalid MIME, magic bytes, or size returns `400 VALIDATION_ERROR`; storage/provider failure returns `502 EXTERNAL_SERVICE_ERROR`; cross-tenant or missing resources return `404 NOT_FOUND`. Object keys never cross HTTP.

All billing errors use `{error, code, details?}`. `409 READING_CONFLICT` includes `details.server`; invoice generation may include `details.skippedRooms`. `POST /send` changes period status to `sent` only and sends no notification.


URLs instead; a stored key is never a capability. Photos upload independently of the
reading — a failed upload leaves the reading saved and re-queues only the image.

### Contracts — `/api/manager/motels/:motelId/contracts`

| Method | Path                     | Notes                                                                                                                                                                                 |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`                      | Supports `?status=`                                                                                                                                                                   |
| POST   | `/`                      | `{renterId, roomId, templateId?, startDate, endDate, monthlyRent?, deposit?, clauses?}`; `monthlyRent` defaults to `room.basePrice`; `409` if the room already has an active contract |
| GET    | `/:contractId`           | Full clause list + signing metadata                                                                                                                                                   |
| PATCH  | `/:contractId`           | Only while `draft`; `409` once `active`                                                                                                                                               |
| POST   | `/:contractId/send`      | Notification seam sends signing link; `otpSentAt` stamps only after success; failure is `502 EXTERNAL_SERVICE_ERROR` |
| POST   | `/:contractId/terminate` | Only `active` contracts; status → `terminated`; draft/expired/terminated returns `409 CONFLICT` |

Creation validates renter, room, template, and motel tenant ownership. Missing `templateId` uses motel default template when present. Clauses and rent are snapshots. Draft patch accepts templateId, dates, rent, deposit, and clauses; renter and room cannot change.

### Contract templates — `/api/manager/motels/:motelId/contract-templates`

| Method | Path           | Notes                                                                      |
| ------ | -------------- | -------------------------------------------------------------------------- |
| GET    | `/`            |                                                                            |
| POST   | `/`            | `{name, clauses[], isDefault?}`; setting a default clears the previous one |
| GET    | `/:templateId` |                                                                            |
| PATCH  | `/:templateId` | Name, clauses, isDefault                                                   |
| DELETE | `/:templateId` | `409` if a contract references it                                          |

### Tickets — `/api/manager/motels/:motelId/tickets`

| Method | Path         | Notes                                                                  |
| ------ | ------------ | ---------------------------------------------------------------------- |
| GET    | `/`          | Supports `?status=&category=`                                          |
| GET    | `/:ticketId` | Includes `managerNote`, renter phone, photos                           |
| PATCH  | `/:ticketId` | `{status?, managerNote?}`; `resolved` stamps `resolvedAt` and notifies |

`managerNote` is never serialised by any `/api/renter/*` endpoint.

### Settings — `/api/manager/motels/:motelId/settings`

| Method | Path | Notes                                                  |
| ------ | ---- | ------------------------------------------------------ |
| GET    | `/`  | Prices, `otherFees`, `bankAccount`                     |
| PATCH  | `/`  | Same fields; validates bank account shape when present |

### Zalo — `/api/manager/motels/:motelId/notifications`

| Method | Path                      | Notes                                                     |
| ------ | ------------------------- | --------------------------------------------------------- |
| GET    | `/`                       | Sent/failed log with `channel`, `status`, `failureReason` |
| POST   | `/:notificationId/resend` | Re-sends; new row, original left as history               |

## Renter endpoints

All under `/api/renter`, scoped to session `renterId` and `motelId`. No endpoint accepts a renter
or motel ID from the client to select tenant ownership. Lists are bare arrays.

| Method | Path | Exact response / notes |
| --- | --- | --- |
| GET | `/me` | `200 {id,name,phone,room:{id,name,floor}|null,motel:{id,name,bankAccount}|activeContract:{id,roomId,roomName,startDate,endDate,monthlyRent}|null}`; excludes CCCD, manager IDs, OTP/hash fields |
| GET | `/billing/periods` | `200 Array<{id,month,year,status,createdAt}>`; only periods containing an invoice for session renter |
| GET | `/billing/periods/:periodId/invoices` | `200 Array<{id,billingPeriodId,month,year,roomId,roomName,rentAmount,electricityUsage,electricityCost,waterUsage,waterCost,otherFees,totalAmount,qrCodeData,paymentStatus,paidAt,createdAt}>`; foreign period `404 NOT_FOUND` |
| GET | `/invoices/:invoiceId` | `200` same invoice fields plus `bankAccount:{bankCode,accountNumber,accountName}|null`, `transferDescription`, and `meterPhotos:Array<{type,signedUrl,capturedAt}>`; signed URLs expire in 300 seconds |
| GET | `/contract` | Existing latest-contract route; session-scoped |
| GET | `/contracts/:contractId` | `200 Contract`; renter session-scoped |
| POST | `/contracts/:contractId/sign-request` | `200 {sentAt}`; OTP never returned; cooldown or provider limit uses `429 RATE_LIMITED` |
| POST | `/contracts/:contractId/verify` | `{otp}` → `200 Contract` with `status=active`; `OTP_INVALID` / `OTP_EXPIRED` |
| GET | `/tickets` | `200 Ticket[]`; own tickets only, no `managerNote` or object keys |
| POST | `/tickets` | JSON `{category,description}` or multipart fields `category`, `description`, repeated `photos`; `201 Ticket`; route rejects malformed/unsupported bodies and invalid category with `400 {error:"Dữ liệu gửi lên không hợp lệ",code:"VALIDATION_ERROR"}`; service enforces description ≥10 chars, max 5 JPEG/PNG files, 10 MB each |
| GET | `/tickets/:ticketId` | `200 Ticket`; foreign ticket `404`; signed-photo failure returns `502 EXTERNAL_SERVICE_ERROR` while committed ticket/photo metadata remains persisted |

Ticket creation inserts its notification outbox row in the same transaction as the ticket. Provider delivery is post-commit and best-effort: delivery failure never rolls back a committed ticket. Outbox insert failure rolls back ticket creation and returns `502 EXTERNAL_SERVICE_ERROR`. Storage failure before commit returns `502 EXTERNAL_SERVICE_ERROR` and removes staged objects; storage failure while signing a committed read returns the same safe 502.

`Ticket` is `{id,renterId,motelId,roomId,category,description,photoUrls,status,createdAt,resolvedAt}`.
Renter responses never permit payment mutation.

### Live: renter payment proof — `/api/renter/invoices/:invoiceId/payment-proof`

**Live contract.** Payment proof is one private JPEG or PNG image, at most 10 MB. Upload bytes are validated before metadata commit; object keys never cross HTTP. Invoice payment state remains manager-controlled.

| Method | Path | Body | Exact response / errors |
| --- | --- | --- | --- |
| POST | `/api/renter/invoices/:invoiceId/payment-proof` | `multipart/form-data`, exactly one `file` | `201 {id,invoiceId,status:"pending",contentType,size,submittedAt}`; no object key or signed URL |
| GET | `/api/renter/invoices/:invoiceId/payment-proof` | — | `200 {id,invoiceId,status:"pending"|"approved"|"rejected",contentType,size,submittedAt,reviewedAt,rejectionReason,signedUrl}`; `signedUrl` is short-lived (300 seconds) and only returned to the owning renter |
| POST | `/api/renter/push-subscriptions` | `{endpoint,p256dh,auth}` | **Planned route.** `201 {id,createdAt}` or `200 {id,createdAt}` for idempotent upsert; subscription credentials are never echoed |
| DELETE | `/api/renter/push-subscriptions/:subscriptionId` | — | **Planned route.** `204`; only owner may revoke |

Proof upload returns `400 VALIDATION_ERROR` for missing/multiple files, unsupported declared MIME, invalid JPEG/PNG bytes, or size over 10 MB; `401 UNAUTHORIZED` for missing/expired renter session; `404 NOT_FOUND` for foreign/missing invoice; `409 CONFLICT` for paid invoice, inaccessible period, or existing `pending`/`approved` proof; `429 RATE_LIMITED` for mutation rate limits; `502 EXTERNAL_SERVICE_ERROR` for storage failure. A rejected proof remains immutable history and may be replaced by one new POST after explicit state validation; the database allows only one non-rejected proof per invoice.

### Live: manager payment review — `/api/manager/motels/:motelId/billing/invoices/:invoiceId`

**Live contract.**

| Method | Path | Body | Exact response / errors |
| --- | --- | --- | --- |
| GET | `/api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof` | — | `200 {id,invoiceId,renterId,status,contentType,size,submittedAt,reviewedAt,reviewedByManagerId,rejectionReason,signedUrl}`; foreign motel/invoice is `404 NOT_FOUND` |
| POST | `/api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/approve` | — | `200 {invoiceId,paymentStatus:"paid",paidAt,paymentMethod:"bank_transfer"}`; retry is idempotent; only manager may call |
| POST | `/api/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/reject` | `{reason}` | `200 {id,invoiceId,status:"rejected",rejectionReason}`; empty/overlong reason is `400 VALIDATION_ERROR`; invoice stays unpaid |
| POST | `/api/manager/motels/:motelId/billing/invoices/:invoiceId/cash-confirmation` | — | `200 {invoiceId,paymentStatus:"paid",paidAt,paymentMethod:"cash"}`; retry is idempotent; no renter identity or payment state accepted from body |

Manager review and cash confirmation return `401 UNAUTHORIZED` for missing/expired manager session, `404 NOT_FOUND` for foreign/missing motel or invoice, `409 CONFLICT` for invalid period/payment state or approve/reject/cash race, `429 RATE_LIMITED` when configured, and `502 EXTERNAL_SERVICE_ERROR` only for provider work after committed state. Approval, rejection, and cash confirmation are auditable; no renter endpoint can mark an invoice paid.

Payment transition matrix:

| Current invoice | Renter proof POST | Manager approve proof | Manager reject proof | Manager cash confirmation |
| --- | --- | --- | --- | --- |
| `unpaid` | create `pending` proof, or replace prior `rejected` proof | `paid` + `bank_transfer` | proof `rejected`, invoice remains `unpaid` | `paid` + `cash` |
| `overdue` | create `pending` proof, or replace prior `rejected` proof | `paid` + `bank_transfer` | proof `rejected`, invoice remains `overdue` | `paid` + `cash` |
| `paid` | `409 CONFLICT` | idempotent paid result only for same settled proof; no second transition | `409 CONFLICT` | idempotent paid result only for already-cash-settled invoice; otherwise `409 CONFLICT` |

A pending or approved proof blocks replacement. A rejected proof remains immutable history; at most one non-rejected proof exists per invoice. No operation moves `paid` back to `unpaid` or `overdue`.

### Live payment notification delivery

**Live contract; payment-proof and cash-confirmation events are emitted by runtime routes.**

Payment events use stable keys `invoice:<id>:proof-submitted`, `invoice:<id>:proof:<proofId>:proof-approved`, `invoice:<id>:proof:<proofId>:proof-rejected`, and `invoice:<id>:cash-confirmed`.

### Notification delivery

A notification is an outbound event; a channel is its transport. Payment events use stable keys `invoice:<id>:proof-submitted`, `invoice:<id>:proof-approved`, `invoice:<id>:proof-rejected`, and `invoice:<id>:cash-confirmed`. Web Push is attempted first after activation; permanent push failure deactivates the subscription and queues configured ZNS/ZBS fallback. SMS is not an MVP channel and may appear only after an explicit documented scope change. Delivery states are `pending`, `sent`, and `failed`; no route promises delivery. Delivery is idempotent, bounded, and redacted. Activation uses configured ZNS/ZBS or manager-generated manual link/QR fallback; no route promises Zalo-only delivery.

## Zalo webhook

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/webhooks/zalo` | `{event_id?,event_name:"follow"|"unfollow",user_id?|follower_id?,phone?,oa_id?}` | `200 {ok:true}` |

Unauthenticated by definition; `x-zalo-signature` must equal HMAC-SHA256 of raw body using
`ZALO_WEBHOOK_SECRET`. Invalid signature returns `401 {error,code:UNAUTHORIZED}`. Malformed or
unsupported events return `400 {error,code:VALIDATION_ERROR}`. `event_id` deduplicates retries;
missing IDs use a raw-body digest. Follow requires `oa_id` and `phone`. An unknown OA mapping is an internal mapping failure: return
`500 {error,code:INTERNAL_ERROR}`, roll back webhook dedupe state, and allow retry after mapping is
configured; do not classify it as `NOT_FOUND` or expose mapping details. Unfollow clears follower
state. Provider IDs, secrets, and raw payload credentials never enter responses or logs.


## Rollout flags and order

No runtime feature flags are implemented in this delivery; rollout is deployment-controlled.
Keep `ZALO_ACCESS_TOKEN`, `ZALO_OA_SECRET`, `ZALO_WEBHOOK_SECRET`, and all `ZNS_TEMPLATE_*`
values server-only. Roll out in this order: additive migrations and fake adapters; deploy R2/Zalo
configuration with sends disabled; verify private storage and webhook signatures; enable renter
reads and capture sync; enable notification delivery per event after provider smoke tests; publish
frontend route groups only after API and fixture E2E gates pass. `E2E_REAL=1` is a test-runner gate,
not an application feature flag.

## Conventions

- List endpoints return a **bare JSON array** of rows — no envelope, no `total`, no `page`, and
  no server-side pagination. A list is bounded by the motel's rooms or renters.
- `PATCH` endpoints are partial and idempotent.
- Mutations that emit notifications insert a generic `notification_events` outbox row atomically
  with the domain mutation. Provider delivery starts only after commit; Zalo delivery may add a
  linked `zalo_notifications` audit row. Provider failure never rolls back committed domain state.
- Nothing deleted is ever physically removed if it appears on an invoice — status columns
  carry that state instead.
