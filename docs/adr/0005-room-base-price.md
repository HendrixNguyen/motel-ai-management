# ADR-0005 — Room carries a base price; the contract overrides it

- **Date:** 2026-10-03
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

The manager UI needs to show a price on every room card and offer a default in the
add-room form. Rent, however, is agreed per renter: two occupants of the same room can
negotiate differently, and a room's rent changes over the years it stands.

So there are two candidate homes for "what does this room cost":

- **On `rooms.basePrice`** — a default the room carries, overridden by a signed contract
- **Only on `contracts.monthlyRent`** — the single source of truth, and the UI derives a
  display value from whichever contract is active

Storing it only on contracts means a vacant room has no price to show, and the add-room
form has nothing to default to. Storing it in two places with no precedence rule means the
invoice generator has to guess which one wins.

## Decision

`rooms.basePrice NUMERIC(14,0) NOT NULL DEFAULT 0` exists as the room's default rent.
Precedence is fixed and non-overlapping:

```
Invoice.rentAmount  =  the active contract's monthlyRent
                      (rooms.basePrice is NEVER used to bill)
```

`basePrice` is used in exactly two places: seeding `monthlyRent` when the manager creates a
new contract, and rendering the room grid / add-room form.

No unit test in the billing module reads `basePrice`. That is the invariant that keeps a
stale default from ever charging a renter the wrong amount.

## Consequences

**Good**

- A vacant room still displays a price
- Contract creation has a sensible starting value
- One unambiguous answer to "what gets billed": the contract, always
- The failure mode is safe — a stale `basePrice` shows a wrong number on a card, it never
  produces a wrong invoice

**Bad**

- Two places store a rent figure, so a careless reader can assume they are equivalent.
  Countered by naming (`basePrice` vs `monthlyRent`), a spec section that states the rule,
  and the billing module never reading the field.
- Editing `basePrice` retroactively changes how *future* contracts are seeded, which may
  surprise a manager mid-negotiation. Surfaced in the room form as a hint, not a hidden
  behaviour.

**Revisit when** rent ever needs to vary by something other than renter or room — per
floor, per lease length, per season — which would make a per-room default insufficient.
