# ADR-0006 — MVP contract consent in authenticated renter session

- **Date:** 2026-10-15
- **Status:** Superseded by plan decision; retain for historical rationale
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

Vietnam recognises electronic signatures under the Law on Electronic Transactions
(Luật Giao dịch điện tử 2023), which distinguishes signatures made with a **digital
signature certificate** (chữ ký số) from other electronic consent mechanisms. House rental
contracts are signed by individuals and small landlords, often one signature at a time.

Three options were considered:

| Option | Legal strength | Cost | Effort |
|--------|---------------|------|--------|
| **OTP consent** — 6-digit code sent over Zalo, renter types it back | Weaker: consent evidence, not a certified digital signature | free (an OA/ZNS message) | small |
| **Provider integration** — FPT.eSign, VNPT SmartSign, Viettel CA | Strong: certified chữ ký số | per-signature fee + account + integration | weeks |
| **Both, OTP first** | Starts weak, upgrade path preserved | free now | small now |

## Historical decision

The 2026-10-03 implementation planned OTP consent delivered over Zalo. On 2026-10-15 the MVP scope changed: new signing uses authenticated renter session plus explicit consent and immutable terms snapshot. OTP is not used for new signing, no certificate provider is integrated, and prior OTP fields/evidence remain for historical records.

The current flow records session consent, not independent identity proof or a certified digital signature. Legal sufficiency is not established; obtain external legal assessment before commercial reliance.

## Consequences

**Good**

- No per-signature cost, no provider contract, no weeks of integration before the product
  can sign anything
- The signing evidence is timestamped and tied to a phone number the renter proved
  ownership of via Zalo delivery — defensible as evidence of consent
- Cheap enough to re-sign freely if a contract needs regenerating

**Bad**

- It is **not** a chữ ký số. Do not market it as one, and do not use it where a certified
  signature is legally required. This is the single most important caveat in the feature.
- OTP delivery inherits Zalo's reachability. A renter who never follows the OA pays a ZNS
  fee per signing attempt.
- The 5-minute window is short for a renter reading a contract on a phone. Resend is
  allowed after 5 minutes.

**Revisit when** any of these becomes true:

- a contract type in this market legally requires chữ ký số
- a dispute arises that turns on the strength of the signature record
- the business prefers to bill the certification cost into rent
