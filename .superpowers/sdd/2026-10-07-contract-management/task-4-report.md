

## Remaining finding follow-up

Status: complete with DB verification blocker.

Sign-request flow now serializes per contract with `FOR UPDATE`, checks cooldown inside lock, stages OTP, and sender-failure rollback uses compare-and-set on this request's hash and timestamps so newer OTP state is never erased. Zalo-unwired default is explicit in API docs. Existing signing test remains DB-blocked by PostgreSQL authentication.

Checks:
- `bun run typecheck`: passed.
- `bun test src/test/contract-signing.test.ts`: blocked: `password authentication failed for user "postgres"`.
