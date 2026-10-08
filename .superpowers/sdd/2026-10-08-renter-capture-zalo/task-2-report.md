# Task 2 report

Status: implemented.

Changes:
- Added upload metadata schema and migration with motel ownership, opaque object key, MIME, size, checksum, timestamps, and unique resource/key indexes.
- Added private meter photo upload/read service methods using Task 1 `StorageAdapter`.
- Added draft-only multipart upload and signed-read routes.
- Added replacement cleanup and external storage error mapping.
- Added `upload.test.ts` covering metadata/signing, replacement, sent-period rejection, tenant 404, and storage failure.

Verification:
- `bun run typecheck` passed.
- `bun test src/test/upload.test.ts` blocked by local PostgreSQL query failures; same failure reproduces in existing billing tests.

Concerns:
- Database test environment unavailable/invalid during verification, so integration tests need rerun with healthy `TEST_DATABASE_URL`.

## Review fixes

- Removed `objectKey` from upload responses; signed reads remain the only capability returned.
- Validation now runs before storage and maps MIME, magic-byte, and size failures to `400 VALIDATION_ERROR`; provider failures map to `502 EXTERNAL_SERVICE_ERROR`.
- Moved upload metadata schema under `modules/billing`.
- Replacement now commits metadata and meter linkage transactionally, deletes old storage only after commit, and cleans new objects on failure.
- Added regression coverage for response redaction and validation boundaries; API contract documents multipart and signed-read behavior.

Verification after fixes:
- `bun run typecheck` passed.
- `bun test src/test/upload.test.ts` still blocked by PostgreSQL query failures.
- `git diff --check` passed.
