# ADR-0009: S3-compatible SDK for private object storage

## Decision
Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for Cloudflare R2 operations.

## Reason
R2 exposes S3-compatible APIs. AWS SDK provides maintained SigV4 PUT, DELETE, and presigned GET without custom cryptography. Credentials stay server-side in the adapter.

## Consequence
Backend gains two production dependencies. Signed URL TTL remains bounded by storage policy.
