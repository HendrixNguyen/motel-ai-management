

## Security follow-up

Status: complete with DB verification blocker.

Fixed response allowlist: contract responses omit `otpHash`, `otpExpiresAt`, and `otpAttempts`. Split manager notification and renter OTP sender seams. Renter OTP sender receives plaintext only inside delivery seam; API never returns it. Sender failure clears staged hash and restores prior cooldown state. OTP attempt increment uses atomic SQL predicate capped at three attempts; activation remains transactional. Docs headings and signing coverage updated.

Verification: `bun run typecheck` passed. `bun test src/test/contract-signing.test.ts` blocked by `password authentication failed for user "postgres"`. Commit: `8b8c241`.

Brief artifact issue remains: task brief requested files relative to its own working root; report kept under requested `.superpowers/sdd/...` path.
