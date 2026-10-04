# ADR-0001 — Renters authenticate with magic links, not accounts

- **Date:** 2026-10-03
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

Renters are the population least likely to complete a registration flow. They move often,
share rooms, use old phones, and have no reason to care about a property manager's software.
A password-based renter account adds signup friction, a forgotten-password support path,
and credential storage — all to solve an identity problem that Zalo has already solved.

Zalo messages arrive on a phone number the renter already owns and already reads.

## Decision

Renters have no account and no password. Their identity is `(motelId, phone)`.

Access is granted by a single-use magic-link token delivered over Zalo:

- 32 cryptographically random bytes, base62-encoded, stored in `magic_links.token`
- 24-hour expiry
- marked consumed on first exchange, then replaced by an `httpOnly` session cookie
- the portal accepts either the URL token or the cookie, so a renter is never forced to
  carry a token in every URL

Managers keep normal email + password login.

## Consequences

**Good**

- Zero renter onboarding friction — the first ZNS message is also the account
- No renter password storage, reset flow, or credential-breach surface
- Renters cannot lock themselves out
- Phone is already the identity Zalo delivers to, so delivery is verifiable

**Bad**

- A renter who loses Zalo access to their number cannot self-recover and must contact
  the manager. Accepted: the manager can reissue a link.
- Delivery depends on a Zalo OA being configured and the Zalo API being reachable.
  Mitigated by rendering the link in the manager UI for manual copy as a fallback.
- A 24-hour session means a renter reading bills on a phone re-auths weekly. Acceptable;
  longer windows widen the blast radius of a shared phone.

**Revisit when** renter accounts would need to span motels (a single renter renting in two
places under one login), which the per-motel uniqueness constraint currently forbids.
