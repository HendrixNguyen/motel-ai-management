# Frontend UI/UX Specs

- **Date:** 2026-10-03
- **Companion to:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](superpowers/specs/2026-10-03-motel-management-design.md)
- **Purpose:** handoff document for UI design in Stitch. Field names, statuses, and amounts
  here match the design spec exactly — if the two disagree, the design spec wins.

## Targets

| Surface | Viewport | Layout |
|---------|----------|--------|
| Manager app | Desktop-first, `1280px+`, usable down to `768px` | Fixed sidebar + content |
| Renter portal | Mobile-first, `375px–430px`, centred, max `480px` on desktop | Single column, sticky header |
| Meter capture PWA | Mobile-only, `360px–430px`, installed to home screen | Full-screen, one-handed, no chrome |

Locale `vi-VN`. Currency VND, formatted `3.500.000 ₫` (dot thousands separator, no
decimals). Dates `DD/MM/YYYY`.

---

## 1. Design Tokens

### Colour

| Token | Light value | Use |
|-------|-------------|-----|
| `primary` | `#0284C7` | Primary actions, active nav, links |
| `primary-strong` | `#0369A1` | Primary hover/pressed |
| `success` / `success-bg` | `#16A34A` / `#DCFCE7` | Paid status, resolved tickets |
| `warning` / `warning-bg` | `#D97706` / `#FEF3C7` | Draft period, unpaid invoice, expiring contract |
| `danger` / `danger-bg` | `#DC2626` / `#FEE2E2` | Overdue, destructive actions, validation errors |
| `text` | `#0F172A` | Headings |
| `text-body` | `#334155` | Body copy |
| `text-muted` | `#64748B` | Labels, helper text |
| `border` | `#E2E8F0` | Dividers, card borders, inputs |
| `surface` | `#FFFFFF` | Cards |
| `canvas` | `#F8FAFC` | Page background |

Renters never see a red total unless the invoice is `overdue`; an `unpaid` invoice inside
its due window uses `warning`, not `danger`.

### Typography

Inter. Base `14px`. Page heading `24px/700`. Section heading `18px/600`. Card title
`16px/600`. Body `14px/400`. Label & table header `12px/600`, uppercase, letter-spacing
`0.02em`. Numeric columns and all VND amounts use `font-variant-numeric: tabular-nums` so
digits align down a column.

### Spacing, radius, elevation

4px base scale. Radius: `8px` inputs/buttons, `12px` cards, `999px` badges. Elevation:
`shadow-sm` for cards, `shadow-lg` for modals and drawers.

### Components

Stat card, data table (sortable, paginated, searchable), modal, slide-over drawer, toast,
status badge, filter bar, empty state, and a form field with label + inline error.

---

## 2. Manager App

Shell: left sidebar `240px`, sticky. Top bar carries the motel selector, notification
bell, and the manager's account menu.

Sidebar items: **Tổng quan**, **Nhà trọ**, **Phòng trọ**, **Khách thuê**, **Tính tiền &
Hóa đơn**, **Hợp đồng**, **Sự cố & Yêu cầu**, **Cài đặt**.

The motel selector in the top bar is global state. Every screen below is scoped to the
selected motel; switching motels reloads the current route against the new id.

### M1 — Overview `/`

Four stat cards:

| Card | Value | Sub-label |
|------|-------|-----------|
| Phòng | total rooms | `X đang thuê · Y trống · Z bảo trì` + occupancy % |
| Doanh thu dự kiến | sum of `unpaid` + `overdue` `totalAmount` for the current period | `Tháng MM/YYYY` |
| Tiền chưa thu | count of unsettled invoices | total VND |
| Sự cố chưa xử lý | count of `open` + `in_progress` tickets | oldest age in days |

Quick actions: **Chốt số điện/nước**, **Tạo hóa đơn**, **Thêm khách thuê**.

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

Table: Họ tên, SĐT, Số CCCD, Phòng, Trạng thái Zalo OA (`Đã follow` / `Chưa follow`),
Ngày bắt đầu, actions.

Renter detail page: personal info with front/back CCCD images (or an "chưa cập nhật"
placeholder), active contract summary with end date and deposit, invoice history with
payment status, and **Tạo magic link / Gửi Zalo**.

### M5 — Nhập số & tính tiền `/billing/[periodId]`

Header: `Tháng MM/YYYY`, `Giá điện 3.500 ₫/kWh`, `Giá nước 25.000 ₫/m³`, period status
badge.

Batch-entry table, one row per room:

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
notification. A failed notification surfaces an amber inline notice with **Gửi lại**.

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

Detail drawer: enlarged photos, full description, **Mở chat Zalo với khách** (copies the
phone number / opens Zalo), the renter's phone as a copy button, an internal-note
textarea, and a status dropdown. Resolving stamps `resolvedAt` and notifies the renter.

There is no chat UI in this product. The drawer must not imply one exists.

### M9 — Cài đặt `/settings`

- **Ngân hàng VietQR:** bank code, account number, account name. Required before any
  invoice can generate a QR payload.
- **Đơn giá & phí:** electricity per kWh, water per m³, and the editable `otherFees` list
  (name + amount).
- **Tích hợp Zalo:** OA id, secret key, access token, and the ZNS template id fields,
  each with a "chưa cấu hình" state while the env value is still a placeholder.

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

**`/capture/[periodId]/room/[readingId]`** — single room entry, full screen:

- Room name as the title, large
- `Điện cũ` — large, read-only, greyed
- `Điện mới` — large numeric input, autofocus, `inputmode="numeric"`
- Computed cost live beneath, tabular numerals: `150 kWh × 3.500 ₫ = 525.000 ₫`
- The same two fields for water
- Camera button per meter type, thumbnail once captured, retake available
- Primary button **Lưu & tiếp tục** — saves locally and advances to the next unentered room
- One secondary link, **Quay lại danh sách**. No other navigation

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
- Due date `Hạn chót: DD/MM/YYYY`
- Status badge: `Chưa thanh toán` (warning), `Đã thanh toán` (success), `Quá hạn` (danger)
- Primary CTA **Thanh toán bằng VietQR** → invoice detail

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
Tiền điện   (1450 − 1300) × 150 kWh × 3.500 ₫   525.000 ₫
Tiền nước   (82 − 76) = 6 m³ × 25.000 ₫          150.000 ₫
Phí dịch vụ  Rác 50.000 ₫ · Internet 100.000 ₫ · Xe 25.000 ₫   175.000 ₫
─────────────────────────────────────────────
TỔNG CỘNG                                    3.850.000 ₫
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
- **Draft, unsigned:** CTA **Xác nhận & Ký hợp đồng** → modal stating the renter is
  agreeing to the clauses, then a 6-box OTP input. Resend is disabled for 5 minutes.
  Wrong or expired OTP shows an inline error and keeps the modal open.
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
with the full value in a tooltip; money never truncates or wraps.

## 5. Accessibility

Keyboard reachable throughout, visible focus rings, `aria-label` on icon-only actions,
form fields wired to their labels and error text via `aria-describedby`, and status
badges carrying text rather than relying on colour alone.
