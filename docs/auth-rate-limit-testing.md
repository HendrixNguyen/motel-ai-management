# Rate-limit PostgreSQL integration test

Run from `backend/` after migrations and PostgreSQL are available:

```bash
RATE_LIMIT_STORE=postgres NODE_ENV=test bun run db:migrate
RATE_LIMIT_STORE=postgres NODE_ENV=test bun test src/test/rate-limit.test.ts
```

Without reachable `TEST_DATABASE_URL`, test is blocked; do not treat local fallback as production verification.
