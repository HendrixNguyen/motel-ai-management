# ADR-0002 — Payment confirmation is manual

- **Date:** 2026-10-03
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

Renters must pay by bank transfer. Two shapes are available:

1. **Gateway** — VNPay, MoMo, or ZaloPay. The provider handles checkout, confirms payment,
   and settles. Cost: a percentage fee per transaction (commonly 1–2%), merchant
   registration, a business licence, and a settlement delay.
2. **VietQR + manual confirmation** — the system generates a bank-transfer QR code; the
   renter pays in their own banking app; the manager marks the invoice paid.

Target customers are small motels, typically 10–40 rooms. At roughly 20 invoices per month
and a 1.5% gateway fee, fees stay small in absolute terms — but merchant registration is
the real blocker. It requires a business licence, a bank account in the motel's name, and
Zalo merchant approval, none of which the manager may hold.

## Decision

Generate VietQR payloads and confirm payments manually. The manager marks an invoice paid
from the dashboard.

- `invoices.qrCodeData` holds the VietQR payload string, built from the motel's
  `bankAccount` plus the invoice total
- the QR image is rendered from that payload at request time — no gateway call, no network
  hop between a renter opening a bill and seeing a code
- transfer description is `[motelName] T[month]/[year] P[roomName]` so the manager can
  match a bank statement line to an invoice without ambiguity
- no webhook, no auto-reconciliation

## Consequences

**Good**

- Zero fees, zero merchant onboarding, works with any Vietnamese bank account
- No payment data touches the system beyond a boolean and a timestamp
- Nothing to break in a payment provider outage

**Bad**

- A renter who pays may see "unpaid" until the manager notices. Mitigated by the transfer
  description making statement matching a 10-second job for a human.
- The manager is a single point of failure for cash reconciliation. Accepted — they are
  already the one holding the bank statement.
- "Overdue" is only as accurate as the manager's diligence. Accepted; the dashboard
  surfaces ageing per invoice.

**Revisit when** either of these becomes true:

- a motel operates enough rooms that manual matching is a daily burden — then a bank
  statement webhook beats a gateway, because it keeps the zero-fee model
- the business wants to accept cards or wallets, which VietQR structurally cannot do
