# ADR-0010: Local VietQR rendering

## Decision

Render invoice `qrCodeData` locally in manager UI with `qrcode`. Do not call external QR image services.

## Reason

VietQR payload is payment data. Local rendering avoids leaking invoice amounts, bank account details, and transfer descriptions to third-party endpoints. `qrCodeData` remains copyable text fallback when no payload exists or rendering fails.
