# ADR-0003 — Zalo channel routing: free OA messages, paid ZNS only as fallback

- **Date:** 2026-10-03
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

Zalo offers two ways for a business to message a person, and they cost very differently:

| Channel | Cost | Constraint |
|---------|------|-----------|
| **ZNS** — templated notification | paid per message (hundreds of VND) | Template must be submitted to and approved by Zalo |
| **OA follower message** | free | Recipient must follow the OA; template restrictions are looser |

Every month a motel sends at least one bill notice per renter, plus payment confirmations,
contract events, and expiry reminders. At 20 rooms that is 20–60 messages a month per
motel, every month. Paying per message for all of it is a permanent, growing expense for a
business with thin margins.

The complication: a renter cannot follow an OA before the first message reaches them, so
first contact is unavoidably a paid ZNS message.

## Decision

Route by follow status, with an explicit cold-start exception.

1. **First contact** — when a renter is created, send a paid ZNS welcome carrying the
   magic link and a prompt to follow the OA.
2. **Follow webhook** — when the OA follow event arrives, set `isOaFollower = true` and
   store `zaloOaId`.
3. **Every message thereafter** — check `isOaFollower`:
   - `true` → free OA follower message
   - `false` → paid ZNS, because there is no free channel that reaches them

Triggers that route this way: bill ready, payment confirmed, contract sent for signing, OTP
delivery, contract expiry reminder, ticket created, ticket status change.

Every attempt writes a `zalo_notifications` row so the manager UI can show what was sent,
what failed, and offer **Gửi lại**.

## Consequences

**Good**

- Per-message cost falls to near zero once a renter follows, which is the steady state
- Message delivery still works for renters who never follow — the paid path is a fallback,
  not a requirement
- The channel decision is made once, in the service, so no caller has to think about it

**Bad**

- Two message formats and two failure modes to maintain
- Cost is now a function of follow rate, which the product does not directly control. The
  welcome message exists specifically to raise that rate.
- ZNS template ids are assigned only after Zalo approves each template, so sending fails
  closed until the ids are filled in. Env vars ship as `PLACEHOLDER` and the failure is
  loud rather than silent.

**Revisit when** Zalo changes pricing, or when OA follower messages acquire restrictions
that make them unusable for billing notices.
