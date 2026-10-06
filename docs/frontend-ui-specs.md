# Frontend UI/UX Specs

- **Date:** 2026-10-03
- **Companion to:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](superpowers/specs/2026-10-03-motel-management-design.md)
- **Purpose:** frontend design and implementation handoff. Field names, statuses, and amounts
  here match the design spec exactly — if the two disagree, the design spec wins.

## Targets

| Surface | Viewport | Layout |
|---------|----------|--------|
| Manager app | Phone-first for on-site work; responsive through desktop | Compact mobile navigation; persistent sidebar only when viewport supports it |
| Renter portal | Mobile-first, `375px–430px`, centred, max `480px` on desktop | Single column, sticky header |
| Meter capture PWA | Mobile-only, `360px–430px`, installed to home screen | Full-screen, one-handed, no chrome |

Locale `vi-VN`. Currency VND, formatted `3.500.000 ₫` (dot thousands separator, no
decimals). Dates `DD/MM/YYYY`. Support narrow viewports from `360px`; never require horizontal
page scrolling. Tables must reflow into readable rows or focused detail editors on phones.

---

## 1. Design Tokens

### Colour

Use semantic tokens throughout; no per-screen hex values. Status must never rely on colour
alone. Normal text needs `4.5:1` contrast; focus indicators and control boundaries need `3:1`.

| Token | Light value | Use |
|-------|-------------|-----|
| `primary` | `#0369A1` | Primary actions, active nav, links; use white text |
| `primary-strong` | `#075985` | Primary hover/pressed; use white text |
| `success` / `success-bg` | `#15803D` / `#DCFCE7` | Paid status, resolved tickets; dark text on pale background |
| `warning` / `warning-bg` | `#92400E` / `#FEF3C7` | Draft period, unpaid invoice, expiring contract; dark text on pale background |
| `danger` / `danger-bg` | `#B91C1C` / `#FEE2E2` | Overdue, destructive actions, validation errors; dark text on pale background |
| `text` | `#0F172A` | Headings |
| `text-body` | `#334155` | Body copy |
| `text-muted` | `#475569` | Labels, helper text |
| `border` | `#E2E8F0` | Dividers, card borders |
| `border-strong` | `#64748B` | Control boundaries — input borders; the `3:1` rule above |
| `surface` | `#FFFFFF` | Cards |
| `canvas` | `#F8FAFC` | Page background |

`border` measures `1.23:1` on `surface`, so it separates content and never marks a control a
user has to see the edge of. Anything a user must perceive as a boundary — an input, select or
textarea outline — uses `border-strong` (`4.76:1` on `surface`, `4.55:1` on `canvas`), which
clears the `3:1` above. Status foregrounds are picked against their own `-bg` for the `4.5:1`
that `12px/600` labels need: `success` `4.57:1`, `warning` `6.37:1`, `danger` `5.30:1`.

Renters never see a red total unless the invoice is `overdue`; an `unpaid` invoice uses
`warning`, not `danger`. Invoices carry no due-date field (R1), so this palette is never
conditional on a deadline.

### Typography

Use Be Vietnam Pro for headings and Noto Sans for body and controls, with sans-serif fallbacks.
These families support Vietnamese diacritics and operational reading. Body text is at least
`16px` on mobile and `14px` on wider screens; line-height at least `1.5`. Page heading
`24px/700`, section heading `18px/600`, item title `16px/600`. Labels and table headers are
`12px/600`, sentence case, never required to be uppercase. Numeric columns and VND amounts use
`font-variant-numeric: tabular-nums`.

### Spacing, radius, elevation

4px base scale with 8px+ gaps between adjacent touch controls. Minimum control hit area
`44×44px`. Radius: `8px` inputs/buttons, `12px` cards, `999px` badges. Reserve elevation for
overlays; use surface contrast and dividers for ordinary content hierarchy.

### Components

Stat card, data table (sortable, paginated, searchable), modal, slide-over drawer, toast,
status badge, filter bar, empty state, and a form field with label + inline error.

The shared kit lives in `frontend/src/components/ui/`, with one default export per primitive.
Interactive callers are Client Components; render callbacks such as table columns and field
controls stay within that client boundary. The public contracts are:

- `Button`: `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`, `md`, `lg`),
  `pending`, `pendingLabel`, and native button props. Every size has a `44×44px` minimum target;
  pending disables the button, announces busy state, and shows Vietnamese progress text.
- `Field`: `id`, `label`, optional `hint`, `error`, and `describedBy`; its `children` callback
  applies the returned accessibility props and default `className` to the control. Hints and
  errors join existing descriptions rather than replacing them; the default control style
  supplies a touch target, semantic border, and visible focus ring. Callers may extend or
  override that class while maintaining those requirements.
- `Modal` / `Drawer`: controlled `open`, `onClose`, `title`, optional `description`, `children`,
  and optional `footer`. Native `showModal()` provides inertness, focus trapping, and Escape.
  Closing, including a controlled close or unmount, restores the opening control's focus.
- `Badge`: required text `label` and `tone` (`success`, `warning`, `danger`, `neutral`), mapped
  to the semantic palette above. `StatCard` takes `label`, `value`, optional `description`;
  values use tabular numerals.
- `EmptyState`: `title`, `description`, `actionLabel`, and `onAction`; the copy and button name
  the next action. `Skeleton` takes an optional loading `label` and sizing `className`; its
  pulse only runs when reduced motion is not requested.
- `CopyButton`: `value` and optional `label`; success appears only after the clipboard write
  resolves. Failure offers manual copying. `TruncatedText` takes `value` and optional
  `className`, preserving the full value in `title`, `aria-label`, and screen-reader text.
- `FilterBar`: controlled `search`, `onSearchChange`, optional `searchLabel`, and optional
  filter `children`. `DataTable<T>` takes `rows`, `columns`, `getRowId`, optional `searchText`,
  optional `pageSize` (default 10), and an accessible `caption`. Each column supplies `key`,
  `label`, `render`, optional `sortValue`, and optional `money`. Search filters row text with
  Vietnamese case folding; sorting happens before pagination. Monetary sort callbacks return
  `BigInt` or digit strings, never converted amounts. Below `640px`, labelled cells reflow
  into readable rows; sort buttons remain reachable. Search and sort reset to page one,
  stale pages clamp to the result count, and no results names the next filtering action.
- Named `ToastProvider` / `useToast`: the manager content is wrapped in the provider;
  `useToast()` returns a notifier accepting `{ message, tone? }`. Messages are announced in
  a polite live region and remain until dismissed, allowing time to read and use the controls.

Only the skeleton animates; all other primitives use immediate state changes and have no
motion requiring a reduced-motion override. No third-party UI library is added.

---

## 2. Manager App

Shell: responsive. On wide screens, left sidebar `240px`, sticky. On phones, use compact
navigation with no more than five primary destinations; expose remaining sections in a clearly
labelled secondary menu. Top bar carries motel selector, notification inbox, and manager menu.
Controls must work without hover.

Sidebar items: **Tổng quan**, **Nhà trọ**, **Phòng trọ**, **Khách thuê**, **Tính tiền &
Hóa đơn**, **Hợp đồng**, **Sự cố & Yêu cầu**, **Cài đặt**.

The motel selector in the top bar is global state. Every screen below is scoped to the
selected motel; switching motels reloads the current route against the new id.

### What is built

Only the endpoints in [`docs/api-contract.md`](../api-contract.md) can be served. A destination
with no endpoint gets **no route and no nav item** — a sidebar entry that 404s is a broken
affordance — and a measure with no endpoint is omitted rather than rendered zero-filled, since
a "Doanh thu dự kiến 0 ₫" tile is a false claim about data that does not exist.

| Surface | Built | Deferred — no endpoint exists |
|---------|-------|-------------------------------|
| Sidebar | **Tổng quan**, **Nhà trọ**, **Phòng trọ**, **Khách thuê** | **Tính tiền & Hóa đơn** (M5, M6), **Hợp đồng** (M7, M7a), **Sự cố & Yêu cầu** (M8), **Cài đặt** (M9) |
| M1 Overview | **Phòng** card, live quick actions | **Doanh thu dự kiến**, **Tiền chưa thu**, **Sự cố chưa xử lý** cards, and both widgets |
| M3 Phòng trọ | filters, cards, add/edit, change status | overdue indicator, meter history |
| M4 Khách thuê | list, detail, **Tạo magic link** | **Gửi Zalo** |
| M9 Cài đặt | prices, `otherFees`, and bank account — carried by the M2 edit modal | the Zalo OA status panel |

Each section below still describes the full intended screen. Read the table as what is
delivered, not the section as what is.

### M1 — Overview `/`

Four summary measures, shown as a compact list or restrained grid rather than interchangeable
cards:

| Card | Value | Sub-label |
|------|-------|-----------|
| Phòng | total rooms | `X đang thuê · Y trống · Z bảo trì` + occupancy % |
| Doanh thu dự kiến | sum of `unpaid` + `overdue` `totalAmount` for the current period | `Tháng MM/YYYY` |
| Tiền chưa thu | count of unsettled invoices | total VND |
| Sự cố chưa xử lý | count of `open` + `in_progress` tickets | oldest age in days |

Quick actions: **Chốt số điện/nước**, **Tạo hóa đơn**, **Thêm khách thuê**. Keep the next
operational action prominent on mobile without hiding alerts or unpaid balance.

Two widgets below: *Hóa đơn chưa thanh toán* (top overdue invoices, each with a **Gửi
lại Zalo** action) and *Sự cố mới* (latest tickets with room, category, snippet,
timestamp).

### M2 — Nhà trọ `/motels`

Card grid of motels: name, address, room count, electricity/water unit price, and bank
account name. Actions: edit, settings (prices, fees, bank account), create.

### M3 — Phòng trọ `/rooms`

Filters: floor, status (`Trống` / `Đang ở` / `Bảo trì`), search by name.

Room card shows name (`P.101`), floor, **base price** (`3.500.000 ₫`), status badge, the
current renter's name and phone, and an overdue indicator when an unsettled invoice
exists. Actions: edit, change status, view renter, meter history.

Add/edit modal: Tên phòng, Tầng, Giá thuê cơ bản. No amenities field — deliberately out
of scope (see spec non-goals).

### M4 — Khách thuê `/renters`

Table: Họ tên, SĐT, Số CCCD, Phòng, Trạng thái (`Đang thuê` / `Đã kết thức hợp đồng`), Trạng thái
Zalo OA (`Đã follow` / `Chưa follow`), Ngày bắt đầu, actions. Renter status is the tenancy, not
the room: a renter can be `Đang thuê` with no room assigned.

Renter detail page: personal info with front/back CCCD images (or an "chưa cập nhật"
placeholder), active contract summary with end date and deposit, invoice history with
payment status, and **Tạo magic link / Gửi Zalo**.

### M5 — Nhập số & tính tiền `/billing/[periodId]`

Header: `Tháng MM/YYYY`, `Giá điện 3.500 ₫/kWh`, `Giá nước 25.000 ₫/m³`, period status
badge.

Batch-entry table on wider screens, one row per room. On phones, edit one room at a time:

`Phòng | Khách | Điện cũ | Điện mới (input) | kWh | Nước cũ | Nước mới (input) | m³ | Phí khác | Tổng tiền`

- Totals recalculate on every keystroke; no save required to see them.
- Invalid input (`mới < cũ`) turns the cell red with an inline message.
- Consumption above 500 kWh or 30 m³ shows an amber "bất thường" hint but is allowed.
- Rooms with no active contract show a muted "Không có hợp đồng" row and are excluded
  from totals.

Actions: **Lưu nháp**, **Tạo hóa đơn**, **Gửi Zalo cho tất cả phòng**.

### M6 — Hóa đơn `/billing/[periodId]/invoices`

Table: Mã HĐ, Phòng, Khách, Tổng tiền, Trạng thái (`Chưa thanh toán` / `Đã thanh toán` /
`Quá hạn`), Ngày gửi. Row actions: view detail with QR, **Xác nhận đã chuyển khoản**,
**Gửi lại Zalo**, copy magic link.

Confirming payment asks for confirmation, stamps `paidAt`, and fires the Zalo payment
notification. A failed notification surfaces an inline warning with **Gửi lại**. This records
the manager's manual confirmation; it does not verify a bank transfer automatically.

### M7 — Hợp đồng `/contracts`

Two tabs.

*Tab 1 — Hợp đồng:* grouped Active / Sắp hết hạn (≤30 days) / Đã thanh lý. Detail view
lists every clause, rent, deposit, term, and signing metadata (`otpSignedAt`, renter
phone).

*Tab 2 — Mẫu hợp đồng `/contracts/templates`:* template list with a default marker.
Template editor is a clause builder — add, reorder, edit, or remove `{title, content}`
rows, with a preview of the rendered contract. Setting a template as default clears the
previous default for that motel.

### M8 — Sự cố & Yêu cầu `/tickets`

Board columns `Chờ tiếp nhận` (`open`), `Đang xử lý` (`in_progress`), `Đã giải quyết`
(`resolved`). Card: room, category chip (Điện / Nước / Cơ sở vật chất / Khác), description
snippet, thumbnail, relative time.

Detail drawer: enlarged photos, full description, **Liên hệ qua Zalo** (copies the phone
number / opens Zalo), the renter's phone as a copy button, an internal-note textarea, and a
status dropdown. The note is manager-only and must never appear in renter responses. Resolving
stamps `resolvedAt` and notifies the renter.

There is no chat UI in this product. The drawer must not imply one exists.

### M9 — Cài đặt `/settings`

- **Ngân hàng VietQR:** bank code, account number, account name. Required before any
  invoice can generate a QR payload.
- **Đơn giá & phí:** electricity per kWh, water per m³, and the editable `otherFees` list
  (name + amount).
- **Tích hợp Zalo:** read-only connection/configuration status and ZNS template readiness.
  Secrets and template IDs are environment-managed, not editable or returned by the API; show
  only configured / missing status. Provide no secret fields or secret values in the UI.

### M5a — Meter Capture (PWA)

Design intent: the manager is standing at a meter, one hand on the phone, poor light, and
wants to type four digits and move on. No sidebar, no tables, nothing that needs two hands.
Designed at `360px` upward and treated as phone-only.

**`/capture`** — draft periods only, each showing `Tháng MM/YYYY`, `7/24 phòng`, and a
state (`Đang nhập` / `Chưa bắt đầu`). Sent and closed periods are not listed; deep-linking
to one renders it read-only with an explanatory banner.

**`/capture/[periodId]`** — the walk queue:

- Header: `Tháng MM/YYYY`, sync-state chip, progress `7/24`
- One row per room: room name, previous electricity and water readings inline, and a state
  — empty / check / **Cần kiểm tra** (danger)
- Tapping a room opens its entry screen
- Footer CTA stays disabled until every room has a reading, then becomes
  **Hoàn tất & tạo hóa đơn**

Sync-state chip, always visible, never a bare spinner:

| State | Chip |
|-------|------|
| Online, nothing queued | `Đã đồng bộ · 17:42` |
| Offline | `Ngoại tuyến · 3 đang chờ` (warning) |
| Queued, flushing | `Đang gửi 2/3` |
| Conflict present | `1 phòng cần kiểm tra` (danger) |

Sync state and progress must include text, not colour alone. Offline saves immediately confirm
that the entry is stored on this device and waiting to sync.

**`/capture/[periodId]/room/[readingId]`** — single room entry, full screen:

- Room name as the title, large
- `Điện cũ` — large, read-only, greyed
- `Điện mới` — large numeric input, `inputmode="decimal"` (meter readings allow two decimal
  places); autofocus only when advancing to the next room, not when returning to an error
- Computed cost live beneath, tabular numerals: `150 kWh × 3.500 ₫ = 525.000 ₫`
- The same two fields for water
- Camera button per meter type, thumbnail once captured, retake available
- Primary button **Lưu & tiếp tục** — saves locally and advances to the next unentered room
- One secondary link, **Quay lại danh sách**. No other navigation

Inputs have persistent visible labels and validation beside the affected reading, associated
with that field for assistive technology. Camera controls have accessible names; provide a
non-camera path to enter readings. Saving gives immediate feedback.

Validation: `currentReading < previousReading` blocks the save and states both numbers.
Consumption above 500 kWh or 30 m³ shows an amber `Số liệu bất thường — kiểm tra lại`
hint but still allows saving.

There is no submit-at-the-end step — each room is committed the moment it is saved.

**On the desktop meter-entry table (M5):** add an optional meter-photo cell and the same
`Cần kiểm tra` state, so both paths speak the same vocabulary.

---

## 3. Renter Portal

Sticky header: motel name + room badge (`Nhà Trọ An Khang · P.202`), renter name, and a
sign-out control that clears the session cookie.

### R0 — Magic-link landing `/r/[token]`

The only token-bearing route. It shows a brief "Đang xác thực..." state, exchanges the
token, then replaces the address with `/portal`. Failure renders a dedicated screen:
**Liên kết đã hết hạn** with the instruction to message the manager on Zalo, and no
technical error text. This route is never linked directly from the app UI.

### R1 — Trang chủ `/portal`

Current-invoice card:

- `Hóa đơn Tháng MM/YYYY`
- Total, large, tabular numerals
- Status badge: `Chưa thanh toán` (warning), `Đã thanh toán` (success), `Quá hạn` (danger)
- Primary CTA **Xem mã VietQR** → invoice detail

Invoices have no due-date field; do not display or imply one.

When there is no invoice for the current period, the card is replaced by a neutral
"Hóa đơn tháng này chưa được phát hành" state.

2×2 quick links: **Chi tiết điện nước**, **Lịch sử hóa đơn**, **Hợp đồng thuê**, **Báo
hỏng / Yêu cầu hỗ trợ**.

When `isOaFollower` is false, a dismissible banner sits above the card: follow the Zalo
OA to receive bill notifications free of charge, with a **Quan tâm OA ngay** button.

### R2 — Chi tiết hóa đơn `/portal/bills/[id]`

Itemised breakdown, each line showing its derivation so the renter can check the maths:

```
Tiền phòng            3.000.000 ₫
Tiền điện   (1450 − 1300) = 150 kWh × 3.500 ₫   525.000 ₫
Tiền nước   (82 − 76) = 6 m³ × 25.000 ₫          150.000 ₫
Phí dịch vụ  Rác 50.000 ₫ · Internet 100.000 ₫ · Xe 25.000 ₫   175.000 ₫
─────────────────────────────────────────────
Tổng cộng                                    3.850.000 ₫
```

Below the breakdown, an **Ảnh chụp đồng hồ** block shows the meter photo the manager
captured for each of electricity and water, with the capture date. Tapping opens a full-screen
viewer. If no photo was taken for a meter, that row is absent rather than shown empty — the
portal never implies evidence it does not have.

This block is the main reason the capture feature exists. A renter who can see the meter
they were billed on does not open a dispute.

Payment block:

- QR image rendered from `invoices.qrCodeData`
- Bank name, account number, account holder — each with a copy button
- Transfer description shown verbatim, with a copy button
- Instruction: open your banking app and scan, or transfer manually with the exact
  description so the manager can match it

If `motel.bankAccount` is null the payment block is replaced by "Chưa cập nhật thông tin
ngân hàng — vui lòng liên hệ chủ nhà trọ".

### R3 — Lịch sử hóa đơn `/portal/bills`

Reverse-chronological cards: month, total, status badge, `paidAt` when settled. Each
opens the same detail view as R2.

### R4 — Hợp đồng `/portal/contract`

Summary (rent, deposit, term, room) then clauses as an accordion.

- **Signed:** a confirmation block with `otpSignedAt` and the signing phone number.
- **Draft, unsigned:** CTA **Xác nhận & ký hợp đồng** → clear confirmation of the clauses
  and renter consent, then OTP entry. OTP may be visually grouped but must accept paste and
  assistive-technology input; do not require manually focused one-digit boxes. Resend is
  disabled for 5 minutes. Wrong or expired OTP shows an inline error and keeps the form open.
- **Terminated/expired:** read-only with an explanatory banner.

### R5 — Yêu cầu hỗ trợ `/portal/tickets`

Two tabs.

*Đã gửi:* ticket cards with status chip (`Đang chờ` / `Đang xử lý` / `Đã xử lý`),
category, date, description, thumbnails. Manager notes are never rendered here.

*Tạo yêu cầu mới (`/portal/tickets/new`):* category selector, description textarea
(min 10 characters, counter shown), up to 5 photos with thumbnail previews and per-photo
remove, then **Gửi yêu cầu**. Submit shows a success toast and returns to the list.

After submitting, the portal shows the renter's phone number with a copy button and the
line "Chủ nhà trọ sẽ phản hồi qua Zalo" — the app promises Zalo, not in-app replies.

---

## 4. States Every Screen Needs

Empty, loading skeleton, and error states are designed for each list and detail screen —
not left to implementation. Empty copy names the next action ("Chưa có hóa đơn — bấm
**Tạo hóa đơn** để bắt đầu"). Long Vietnamese room and renter names truncate to one line
with the full value available to keyboard and touch users, not tooltip-only; money never
wraps — any element holding a formatted amount is `white-space: nowrap`, which is what keeps an
amount from breaking across lines (amounts also carry `tabular-nums`, see Typography); a column
too narrow for its amounts is a layout bug to fix there, since an amount may never be truncated or
ellipsised. Mutations show pending feedback and a clear success or actionable error.

## 5. Accessibility

Keyboard reachable throughout, visible focus rings that sticky UI does not obscure, accessible
names and state for icon-only actions, form fields wired to visible labels and error text via
`aria-describedby`, and status badges carrying text rather than relying on colour alone. Keep
normal text contrast at least `4.5:1`, support reduced motion, and allow browser zoom and text
enlargement without clipping or horizontal page scroll. Provide clear pressed, disabled,
loading, success, and error states; no action may rely on hover alone.
