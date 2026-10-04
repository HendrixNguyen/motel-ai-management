# ADR-0007 — Readings are captured on-site via an installable PWA

- **Date:** 2026-10-03
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

Collecting a monthly bill means visiting every room and reading two meters. Vietnamese
motel managers do this with a paper notebook, standing at each meter, then retyping every
number into the desktop dashboard at the end of the round.

That produces two transcription steps per reading — meter → paper → database. The second
one is pure loss. Every misread becomes a bill the renter disputes, and disputes consume
manager time that the manager is not being paid for. It is also the single largest source
of error in the product, and it happens entirely outside the software.

The manager is already holding a phone at the meter. The only question is what the phone
should be running.

Four containers were considered:

| Container | Availability | Cost | Notes |
|-----------|--------------|------|-------|
| **Zalo Mini App** | Weeks — Zalo platform approval, business verification | Free | Richest native feel, second frontend, platform review on every release |
| **H5 page inside Zalo's in-app browser** | Immediate | Free | Reached by OA message or a QR sticker by the meter |
| **Installable PWA** | Immediate | Free | Works in any browser, installable to home screen, works outside Zalo entirely |
| **Native iOS/Android** | Weeks of development + store review | Free | Two codebases for one workflow |

The Zalo Mini App was already rejected for the renter portal, where a magic link into a
web page was sufficient. The manager case is different — this is a daily, repeated,
hands-on workflow — but that difference argues for *a good mobile interface*, not
specifically for Zalo's container.

Meter rooms are also basements, stairwells, and ground-floor units with poor signal. An
online-only interface fails exactly where the readings are taken.

## Decision

An installable PWA, with three capabilities:

1. **Walk mode** — one full-screen room entry at a time, previous reading shown large and
   read-only, large numeric input for the current reading, camera button, and the computed
   cost rendering live beneath (`150 kWh × 3.500 ₫ = 525.000 ₫`). A misread is caught at
   the meter, not at month end.
2. **Offline read** — the service worker caches the active period and every room's
   `previousReading`, so the whole round works with no signal.
3. **Offline write queue** — every save lands in an IndexedDB queue and advances
   immediately. Sync happens on reconnect.

Conflict handling uses `meter_readings.updatedAt`. Each queued write carries the
`updatedAt` it read; the server compares and returns `409 READING_CONFLICT` with the
current row on mismatch. The affected room is flagged **Cần kiểm tra** and the manager
re-enters that one number.

**Last write never silently wins.** This is the load-bearing decision. A silently
overwritten reading is exactly the failure mode this feature was built to eliminate — a
"last write wins" merge would reintroduce it one layer up.

Adding `meter_readings.photoUrl` captures the meter at reading time and shows it to the
renter on their invoice. This is worth more than the capture optimisation itself: it turns
"I think you misread my meter" into a photograph the renter can look at.

Desktop batch entry is retained. Both paths write the same
`(billingPeriodId, roomId, type)` row, which is already unique; a period that is no longer
`draft` rejects writes from either path with `409`.

## Consequences

**Good**

- One transcription step instead of two; errors surface at the meter
- The manager can finish a round in a basement with no signal
- Works during a Zalo outage, and does not add a second frontend or a platform dependency
- Meter photos remove most of the surface area for disputes
- A partial round is never lost, so a manager can stop and resume

**Bad**

- **Next.js App Router plus offline is the hard part.** The mitigation is that capture
  screens are client components reading from the API, never server components — the
  service worker cannot meaningfully cache an RSC payload. This constraint is load-bearing
  and must be proven first in the sub-project, not last.
- Conflict resolution currently asks a human to retype one number. Coarse but trustworthy;
  automatic merge of two readings of the same physical meter has no correct answer.
- Two entry paths can exist at once, so "who changed this reading" needs the sync badge to
  be honest about what is queued and what is saved.
- `photoUrl` means the system now stores renter-adjacent imagery, which raises retention
  and access questions that did not exist before.

**Revisit when** capture volume grows beyond one room-round a month (then it wants to be a
chat-based flow with renters sending meter photos), or when a second manager per motel
becomes common enough that whole-period locking beats per-reading conflicts.
