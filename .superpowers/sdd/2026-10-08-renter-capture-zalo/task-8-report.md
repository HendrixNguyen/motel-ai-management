
## Follow-up fixes

- Removed direct contract/OTP sender plus outbox duplicate path; OTP and contract delivery now use notification outbox only.
- Removed magic-link notification ownership from `issueMagicLink`; welcome remains renter creation, avoiding duplicate welcome events.
- Broke renter↔notification import cycle with `notification.recipient.ts` projection resolver.
- OTP notification enqueue failure restores prior contract OTP state; event key remains idempotent.
- Typecheck passes. DB-backed contract test remains blocked by local PostgreSQL query failures.
