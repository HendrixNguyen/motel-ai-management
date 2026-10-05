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

| Prefix | Credential | Session |
|--------|-----------|---------|
| `/api/manager/*` | Manager JWT | `manager_session` httpOnly cookie |
| `/api/renter/*` | Renter session | `renter_session` httpOnly cookie |

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

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Schema validation failed. No `details` — see above |
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired credential |
| `MAGIC_LINK_EXPIRED` | 401 | Magic link past `expiresAt` or already `consumedAt` |
| `OTP_INVALID` | 401 | Wrong OTP |
| `OTP_EXPIRED` | 401 | OTP past 5 minutes |
| `RATE_LIMITED` | 429 | Too many OTP or magic-link requests; `details.retryAfterSeconds` |
| `READING_CONFLICT` | 409 | Reading write based on a stale `updatedAt`; `details.server` is the current row |
| `PERIOD_ALREADY_SENT` | 409 | Capture or generation on a period that is no longer `draft` |
| `FORBIDDEN` | 403 | Valid credential, wrong role |
| `NOT_FOUND` | 404 | Row absent or outside the caller's tenant |
| `CONFLICT` | 409 | Uniqueness or state violation |
| `EXTERNAL_SERVICE_ERROR` | 502 | Zalo or R2 rejected the call; `details.failureReason` |
| `INTERNAL_ERROR` | 500 | Unexpected server fault; details stay server-side |

## Manager endpoints

### Auth — `/api/auth`

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/register` | `{email, password, name, phone?}` | `201 {manager}` + sets cookie |
| POST | `/login` | `{email, password}` | `200 {manager}` + sets cookie |
| POST | `/logout` | — | `204` + clears cookie |
| GET | `/me` | — | `200 {manager}` |

`password` ≥ 8 characters. Login is rate-limited per IP and per email.

### Magic links — `/api/renter/magic-links`

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/exchange` | `{token}` | `200 {renter}` + sets `renter_session`, marks token consumed |
| POST | `/resend` | — | `200 {message, url}` — renter asks the manager for a fresh link |

### Manager-issued magic links — `/api/manager/motels/:motelId/renters/:renterId`

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/magic-link` | — | `200 {token, url}` — manager-issued link for the renter |

### Motels — `/api/manager/motels`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | All motels owned by the manager |
| POST | `/` | Create; `400 VALIDATION_ERROR` if `electricityPrice`/`waterPrice` missing |
| GET | `/:motelId` | `404` if not owned by caller |
| PATCH | `/:motelId` | Partial update of prices, fees, bank account, address |
| DELETE | `/:motelId` | `204` if motel has no dependent rows (rooms, renters, etc.); `409 CONFLICT` if any dependent rows exist |

### Rooms — `/api/manager/motels/:motelId/rooms`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Supports `?floor=&status=&search=`; `basePrice` returned as VND digit string |
| POST | `/` | `409 CONFLICT` on duplicate `(motelId, name)`; `basePrice` as VND digit string |
| GET | `/:roomId` | `basePrice` returned as VND digit string |
| PATCH | `/:roomId` | Partial update of name, floor, `basePrice`, status; `basePrice` as VND digit string |
| DELETE | `/:roomId` | `409 CONFLICT` if an active contract exists OR any renter is assigned to the room |

### Renters — `/api/manager/motels/:motelId/renters`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Supports `?status=&roomId=&search=` |
| POST | `/` | `409` on duplicate `(motelId, phone)`; triggers the ZNS welcome |
| GET | `/:renterId` | Includes contract summary and invoice history |
| PATCH | `/:renterId` | Name, phone, CCCD, `idCardFrontUrl`, `idCardBackUrl`, `roomId`, status |
| DELETE | `/:renterId` | Soft-delete: sets `status = inactive`, keeps financial history |

Phone is normalized to `84XXXXXXXXX` on write.

### Billing — `/api/manager/motels/:motelId/billing`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/periods` | All periods, newest first |
| POST | `/periods` | `{month, year}`; `409` if that month already exists; seeds `meter_readings` |
| GET | `/periods/:periodId` | Period + per-room reading rows with previous/current |
| PUT | `/periods/:periodId/readings` | Batch upsert readings; `400` if `currentReading < previousReading`; `409 PERIOD_ALREADY_SENT` once sent. See [Capture sync](#meter-capture-sync) |
| POST | `/periods/:periodId/invoices` | Generates invoices; `details.skippedRooms` lists rooms with no active contract |
| GET | `/periods/:periodId/invoices` | Invoice list with statuses |
| POST | `/periods/:periodId/send` | Period → `sent`; sends one Zalo message per invoice |
| PATCH | `/invoices/:invoiceId/paid` | Stamps `paidAt`, triggers confirmation notification |
| PATCH | `/invoices/:invoiceId/overdue` | Manual overdue marking |

Invoice generation is idempotent per `(billingPeriodId, roomId)`: re-running updates draft
invoices rather than duplicating them. Once the period is `sent`, generation returns `409`.

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
      "expectedUpdatedAt": "2026-10-03T09:14:22.000Z"
    }
  ]
}
```

`expectedUpdatedAt` is the `updatedAt` the client read. Per-row outcomes:

| Server state | Response | Notes |
|--------------|----------|-------|
| `expectedUpdatedAt` matches, or `currentReading` already equals the submitted value | row accepted, `updatedAt` bumped | Equal-value case makes a retried queued write idempotent without a key column |
| `expectedUpdatedAt` stale and value differs | `409 READING_CONFLICT`, `details.server` = current row | Client flags **Cần kiểm tra**; manager re-enters. Last write never silently wins |
| Period is no longer `draft` | `409 PERIOD_ALREADY_SENT` | Client switches the whole capture session read-only |

`photoUrl` is an R2 **object key**, not a public URL. Responses expose short-lived signed
URLs instead; a stored key is never a capability. Photos upload independently of the
reading — a failed upload leaves the reading saved and re-queues only the image.

### Contracts — `/api/manager/motels/:motelId/contracts`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Supports `?status=` |
| POST | `/` | `{renterId, roomId, templateId?, startDate, endDate, monthlyRent?, deposit?, clauses?}`; `monthlyRent` defaults to `room.basePrice`; `409` if the room already has an active contract |
| GET | `/:contractId` | Full clause list + signing metadata |
| PATCH | `/:contractId` | Only while `draft`; `409` once `active` |
| POST | `/:contractId/send` | Sends the magic link to the renter |
| POST | `/:contractId/terminate` | Status → `terminated`; frees the room |

### Contract templates — `/api/manager/motels/:motelId/contract-templates`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | |
| POST | `/` | `{name, clauses[], isDefault?}`; setting a default clears the previous one |
| GET | `/:templateId` | |
| PATCH | `/:templateId` | Name, clauses, isDefault |
| DELETE | `/:templateId` | `409` if a contract references it |

### Tickets — `/api/manager/motels/:motelId/tickets`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Supports `?status=&category=` |
| GET | `/:ticketId` | Includes `managerNote`, renter phone, photos |
| PATCH | `/:ticketId` | `{status?, managerNote?}`; `resolved` stamps `resolvedAt` and notifies |

`managerNote` is never serialised by any `/api/renter/*` endpoint.

### Settings — `/api/manager/motels/:motelId/settings`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Prices, `otherFees`, `bankAccount` |
| PATCH | `/` | Same fields; validates bank account shape when present |

### Zalo — `/api/manager/motels/:motelId/notifications`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Sent/failed log with `channel`, `status`, `failureReason` |
| POST | `/:notificationId/resend` | Re-sends; new row, original left as history |

## Renter endpoints

All under `/api/renter`, all scoped to the session's `renterId`. No endpoint accepts a
renter id from the client.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/me` | Renter + room + motel name, for the portal header |
| GET | `/invoices` | Reverse-chronological; `?year=&month=` optional |
| GET | `/invoices/current` | Current period invoice, or `404` if not yet issued |
| GET | `/invoices/:invoiceId` | Full breakdown, `qrCodeData`, bank details, and `meterPhotos[]` — `{type, signedUrl, capturedAt}` per meter, signed URLs short-lived |
| GET | `/contract` | Active or latest contract with clauses |
| POST | `/contract/:contractId/sign-request` | Generates the OTP, sends it over Zalo, stamps `otpSentAt`; `429` within 5 minutes of a resend |
| POST | `/contract/:contractId/verify` | `{otp}` → `200 {otpSignedAt}`; `OTP_INVALID` / `OTP_EXPIRED`; max 3 attempts |
| GET | `/tickets` | Own tickets, never `managerNote` |
| POST | `/tickets` | `{category, description, photoUrls[]}`; description ≥ 10 chars, max 5 photos |
| GET | `/tickets/:ticketId` | Own ticket only |

## Webhooks

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/webhooks/zalo` | OA follow/unfollow events. Verified with `ZALO_WEBHOOK_SECRET`; sets `isOaFollower`, `zaloOaId` |

Unauthenticated by definition, authenticated by shared secret. Must reject replays and
unknown event types with `200` (Zalo retries on non-2xx).

## Conventions

- List endpoints return a **bare JSON array** of rows — no envelope, no `total`, no `page`, and
  no server-side pagination. A list is bounded by the motel's rooms or renters.
- `PATCH` endpoints are partial and idempotent.
- All mutations that trigger a Zalo message do so **after** the transaction commits, and
  write a `zalo_notifications` row regardless of outcome.
- Nothing deleted is ever physically removed if it appears on an invoice — status columns
  carry that state instead.
