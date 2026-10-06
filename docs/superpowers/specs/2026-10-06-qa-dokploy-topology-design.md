# QA Dokploy Topology Design

## Purpose

Replace the failed QA Docker Compose deployment with four first-class Dokploy resources in
the existing `Motel Management` project's `qa` environment:

1. PostgreSQL database
2. Redis database
3. Backend application
4. Frontend application

The QA frontend is public at `https://qa.motel.huyndg.io.vn`. The backend, PostgreSQL, and
Redis remain private to Dokploy's internal network.

## Current State

The QA environment contains one idle Compose service named `Motel QA`. It builds the repository's
root `docker-compose.yml`, which combines PostgreSQL, backend, and frontend. Its recorded
deployments failed, and it does not include Redis. No native Dokploy database or application
resources currently exist in QA.

The old Compose service is deleted only after all replacement resources are deployed and the
public QA flow is verified. A failed replacement leaves it intact for diagnosis.

## Target Architecture

```text
Browser
  -> HTTPS qa.motel.huyndg.io.vn
  -> Traefik
  -> frontend:3000
  -> Next.js /api/:path* rewrite
  -> backend:3000
  -> PostgreSQL internal connection
  -> Redis internal connection (reserved; application integration is not implemented yet)
```

Only the frontend receives a Dokploy domain. The backend has no public domain or host port.
Frontend-to-backend traffic uses the backend application's verified internal hostname and port.
Database traffic uses the internal connection values returned by Dokploy; neither database is
exposed through an external port.

## Resources

All resources belong to the existing `qa` environment.

| Resource | Dokploy type | Name | Purpose |
| --- | --- | --- | --- |
| PostgreSQL | PostgreSQL database | `motel-qa-postgres` | Persistent QA application data in database `motel` |
| Redis | Redis database | `motel-qa-redis` | Reserved backend cache/rate-limit dependency |
| Backend | Application | `motel-qa-backend` | Elysia API on container port 3000 |
| Frontend | Application | `motel-qa-frontend` | Next.js UI and same-origin API proxy on container port 3000 |

Dokploy-generated strong credentials are used for PostgreSQL and Redis. Strong, independent QA
values are generated for `MANAGER_JWT_SECRET` and `RENTER_SESSION_SECRET`. Secret values must not
be written to this document, committed to Git, or echoed in session output.

## Source and Build Configuration

Both applications use the existing GitHub integration:

- Repository: `HendrixNguyen/motel-ai-management`
- Branch: `main`
- Build type: Dockerfile
- Build context: repository root
- Backend Dockerfile: `backend/Dockerfile`
- Frontend Dockerfile: `frontend/Dockerfile`

The root build context is mandatory. `backend/Dockerfile` copies `backend/package.json`,
`backend/bun.lock`, `backend/tsconfig.json`, and `backend/src`; `frontend/Dockerfile` similarly
copies paths prefixed with `frontend/`. Using either package directory as the build context would
make those paths unavailable and fail the build.

The frontend image bakes the Next.js rewrite destination during `bun run build`. Therefore
`BACKEND_URL` must be supplied as a build argument or build environment value in addition to the
runtime environment. Its value is the verified private backend URL, not a public hostname and not
`localhost`.

## Runtime Configuration

### Backend

The backend receives:

- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL` using the native PostgreSQL service's internal connection values
- `REDIS_URL` using the native Redis service's internal connection values
- `TEST_DATABASE_URL` set to an intentionally unreachable, non-production URL because the current
  environment parser requires the variable even outside tests; it must never point at QA data
- Independent generated auth secrets
- `RENTER_PORTAL_URL=https://qa.motel.huyndg.io.vn`
- `FRONTEND_URL=https://qa.motel.huyndg.io.vn`
- Required R2 and Zalo QA values already authorized for this environment; if real QA credentials
  are unavailable, explicit non-production placeholders may allow boot, but external workflows
  are considered unavailable and are not reported as healthy
- ZNS template IDs may remain `PLACEHOLDER`, matching the application's fail-closed behavior

The current backend does not read `REDIS_URL`. Creating and wiring Redis prepares the deployment
topology but does not claim that Redis-backed behavior exists. Redis integration requires a
separate application change with tests and documentation.

### Frontend

The frontend receives `BACKEND_URL=http://<verified-backend-internal-host>:3000` at build time and
runtime. Browser code continues to call relative `/api/...` paths.

## Public Routing

Dokploy configures one HTTPS domain:

- Host: `qa.motel.huyndg.io.vn`
- Application: `motel-qa-frontend`
- Path: `/`
- Container port: `3000`
- HTTPS: enabled with the instance's Let's Encrypt certificate resolver

There is no direct Traefik `/api` route to the backend. Traefik sends all public requests to the
frontend, and Next.js applies the repository's existing same-origin rewrite. This preserves the
host-only HTTP-only session-cookie design and avoids CORS.

## Provisioning Sequence

1. Confirm Dokploy control-plane health and re-read the QA environment.
2. Create PostgreSQL and Redis as native Dokploy databases.
3. Start both databases and verify their status and logs.
4. Create the backend application and connect it to the GitHub repository.
5. Configure its root build context, Dockerfile path, runtime environment, and container port.
6. Deploy the backend; verify deployment status, logs, and database connectivity.
7. Resolve and verify the backend's private network address.
8. Create the frontend application and connect it to the same GitHub repository.
9. Configure its root build context, Dockerfile path, build-time and runtime `BACKEND_URL`, and
   container port.
10. Add the frontend HTTPS domain and deploy it.
11. Verify the public page and an `/api` request through the frontend proxy.
12. Delete the old `Motel QA` Compose service only after every preceding verification succeeds.

Each mutating Dokploy call is followed by a read of the affected resource. A successful API
acknowledgement is not treated as proof that a deployment is healthy.

## Failure Handling

- Database failure stops provisioning before application deployment.
- Backend build or startup failure is diagnosed from deployment and container logs; the frontend
  is not declared ready.
- Frontend build must be repeated if `BACKEND_URL` was missing or incorrect because the rewrite is
  evaluated during the image build.
- DNS or certificate failure leaves the applications and databases intact for correction.
- The old Compose stack remains until end-to-end verification passes.
- Secrets and complete environment files are never printed in reports or logs intentionally.

## Acceptance Criteria

- QA contains two native Dokploy databases and two Dokploy applications with the specified names.
- PostgreSQL and Redis report healthy/running state without public database ports.
- Backend and frontend images build from the repository root using their package Dockerfiles.
- Backend starts successfully and connects to PostgreSQL through its internal address.
- Frontend starts with a non-localhost private `BACKEND_URL`.
- `https://qa.motel.huyndg.io.vn` serves the frontend over HTTPS.
- A request to `https://qa.motel.huyndg.io.vn/api/...` reaches the backend through the Next.js
  rewrite without a public backend domain or CORS configuration.
- The obsolete `Motel QA` Compose service is absent only after the new topology passes verification.
- Redis is provisioned and configured, with its currently unused application status explicitly
  documented rather than misrepresented as active integration.
