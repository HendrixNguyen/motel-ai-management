# QA Dokploy Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision and verify native PostgreSQL, Redis, backend, and frontend services in the existing Dokploy QA environment, then remove the obsolete Compose stack.

**Architecture:** Traefik exposes only the Next.js frontend at `qa.motel.huyndg.io.vn`. Next.js proxies relative `/api/*` requests to the private Elysia backend, which connects to native Dokploy PostgreSQL and receives the native Redis URL for future integration.

**Tech Stack:** Dokploy v0.30.8 MCP, Dockerfile builds, GitHub integration, Bun, ElysiaJS, Next.js, PostgreSQL 16, Redis, Traefik/Let's Encrypt

**Spec:** `docs/superpowers/specs/2026-10-06-qa-dokploy-topology-design.md`

## Global Constraints

- Target project is `Motel Management`; target environment is `qa` (`Oeqj-lLit1xC2UxqLDeHp`).
- Re-resolve IDs from live Dokploy state before every mutation; never guess an opaque ID.
- Use repository `HendrixNguyen/motel-ai-management`, branch `main`, through the existing GitHub integration.
- Both Docker builds use repository root `.` as context; Dockerfiles are `backend/Dockerfile` and `frontend/Dockerfile`.
- Only `motel-qa-frontend` receives a public domain; backend, PostgreSQL, and Redis expose no public domain or host port.
- Never print generated credentials, connection URLs, environment-file contents, or secrets.
- Every mutation uses `confirm: true` and is followed by a read that verifies stored or running state.
- Do not delete `Motel QA` until public frontend and proxied API verification succeed.
- Do not claim Redis-backed application behavior: the current backend does not consume `REDIS_URL`.
- Stop on the first failed dependency or deployment and leave successfully created resources available for diagnosis.

## Review Focus

- Duplicate service names after a partial run: resolve exact names first and reuse valid resources rather than creating duplicates.
- Wrong Docker build context: application reads must show `dockerContextPath: "."` and the package-prefixed Dockerfile before deployment.
- Missing build-time backend URL: frontend configuration must include `BACKEND_URL` in Docker build arguments and runtime environment before deployment.
- Unsafe test database target: `TEST_DATABASE_URL` must not equal or resolve to the QA `DATABASE_URL`.
- Premature cleanup: the old Compose ID must still resolve until HTTPS and `/api` checks both pass.

---

### Task 1: Preflight Live State and Build Inputs

**Files:**
- Read: `backend/Dockerfile`
- Read: `frontend/Dockerfile`
- Read: `frontend/next.config.ts`
- Read: `backend/.env.example`
- Read: `frontend/.env.example`

**Interfaces:**
- Consumes: Approved topology spec and current Dokploy session.
- Produces: Verified QA `environmentId`, GitHub connection ID, old `composeId`, DNS readiness, and an exact inventory showing no conflicting target names.

- [ ] **Step 1: Verify repository build assumptions**

Run `sed` reads for both Dockerfiles and confirm their `COPY` sources begin with `backend/` and `frontend/`; confirm `next.config.ts` evaluates `BACKEND_URL` for `/api/:path*` rewrites.

- [ ] **Step 2: Verify Dokploy identity and health**

Call `dokploy_whoami`, `dokploy_check_health`, and `dokploy_list_projects`. Expect a reachable v0.30.8 instance and QA environment `Oeqj-lLit1xC2UxqLDeHp` under `Motel Management`.

- [ ] **Step 3: Resolve all target names exactly**

Resolve `motel-qa-postgres`, `motel-qa-redis`, `motel-qa-backend`, `motel-qa-frontend`, and `Motel QA` with project/environment/type filters. Expect either no exact replacement resource or one reusable resource of the correct type; record the old Compose ID from the live result.

- [ ] **Step 4: Validate public DNS**

Call `dokploy_validate_domain({ domain: "qa.motel.huyndg.io.vn" })`. Expect the hostname to resolve before creating its route; a missing record pauses only domain creation and leaves private resources intact.

- [ ] **Step 5: Confirm GitHub provider access**

Read the old Compose configuration and confirm repository owner, name, branch, `hasGitProviderAccess`, and GitHub connection ID. Do not copy its environment because it contains obsolete placeholder secrets and Compose hostnames.

### Task 2: Provision Native PostgreSQL and Redis

**Files:** None.

**Interfaces:**
- Consumes: QA `environmentId` from Task 1 and generated in-memory credentials.
- Produces: `postgresId`, PostgreSQL internal connection URL, `redisId`, and Redis internal connection URL.

- [ ] **Step 1: Generate credentials without persisting them locally**

Generate independent high-entropy PostgreSQL, Redis, manager JWT, and renter-session secrets in memory. Do not print them or place them in shell history, repository files, commentary, or final output.

- [ ] **Step 2: Create or reuse PostgreSQL**

If exact resolution found no service, call `dokploy_create_database` with type `postgres`, name/appName `motel-qa-postgres`, QA environment ID, database `motel`, a non-default database user, generated password, and `confirm: true`. If a correct resource exists, read and reuse it.

- [ ] **Step 3: Deploy and verify PostgreSQL**

Call `dokploy_deploy_database` for the resolved `postgresId`, then poll `dokploy_get_database` until running or failed. On failure, read the last 200 database log lines and stop. On success, retain the internal connection URL only in memory.

- [ ] **Step 4: Create or reuse Redis**

If exact resolution found no service, call `dokploy_create_database` with type `redis`, name/appName `motel-qa-redis`, QA environment ID, generated password, and `confirm: true`. If a correct resource exists, read and reuse it.

- [ ] **Step 5: Deploy and verify Redis**

Call `dokploy_deploy_database` for the resolved `redisId`, then poll `dokploy_get_database` until running or failed. On failure, read its logs and stop. Confirm neither database has an external public port.

### Task 3: Create and Deploy the Private Backend

**Files:** None.

**Interfaces:**
- Consumes: QA environment, GitHub connection, PostgreSQL internal URL, Redis internal URL, and generated secrets.
- Produces: Running `motel-qa-backend`, `applicationId`, and verified private URL `http://motel-qa-backend:3000` or the actual internal hostname read from Dokploy.

- [ ] **Step 1: Create or reuse the backend application**

Resolve the exact name. If absent, call `dokploy_create_application` with name/appName `motel-qa-backend`, QA environment ID, a QA description, and `confirm: true`.

- [ ] **Step 2: Connect the GitHub source**

Connect the application through the verified GitHub account to owner `HendrixNguyen`, repository `motel-ai-management`, branch `main`, root build path, and `confirm: true`.

- [ ] **Step 3: Configure the Dockerfile build**

Call `dokploy_update_application` with build type `dockerfile`, `dockerContextPath: "."`, `dockerfile: "backend/Dockerfile"`, branch `main`, auto-deploy enabled, rollback enabled, and `confirm: true`.

- [ ] **Step 4: Set the complete backend environment**

Call `dokploy_set_application_env` once with the complete required environment: production mode, port 3000, internal PostgreSQL URL, internal Redis URL, a deliberately unreachable `TEST_DATABASE_URL` distinct from QA data, generated auth secrets, both public frontend URLs, and authorized QA R2/Zalo values or explicit non-production placeholders. Keep `createEnvFile: false`; do not echo values.

- [ ] **Step 5: Read back safe configuration**

Call `dokploy_get_application`. Assert source is GitHub, branch is `main`, build type is Dockerfile, context is `.`, Dockerfile path is correct, and the environment-variable count is nonzero. If any assertion fails, correct it before deployment.

- [ ] **Step 6: Deploy and verify the backend**

Call `dokploy_deploy_application` with title `Provision QA backend`, retain its `deploymentId`, and poll service/deployment state. A failed deployment is diagnosed with deployment logs; a successful deployment is followed by container logs. Require a running state with no database connection or environment-validation error.

- [ ] **Step 7: Verify the private backend address**

Read the deployed application/network configuration and confirm the internal hostname resolves from the shared Dokploy network on port 3000. Use the observed hostname for the frontend; do not invent it and do not add a public backend domain.

### Task 4: Create, Route, and Deploy the Frontend

**Files:** None.

**Interfaces:**
- Consumes: Verified private backend URL and GitHub connection.
- Produces: Running `motel-qa-frontend` at `https://qa.motel.huyndg.io.vn`.

- [ ] **Step 1: Create or reuse the frontend application**

Resolve the exact name. If absent, create name/appName `motel-qa-frontend` in QA with `confirm: true`.

- [ ] **Step 2: Connect the GitHub source**

Connect owner `HendrixNguyen`, repository `motel-ai-management`, branch `main`, root build path, and the verified GitHub account.

- [ ] **Step 3: Configure the Dockerfile and build argument**

Call `dokploy_update_application` with build type `dockerfile`, context `.`, Dockerfile `frontend/Dockerfile`, branch `main`, auto-deploy and rollback enabled, plus build argument `BACKEND_URL=<verified-private-backend-url>`.

- [ ] **Step 4: Set the complete frontend runtime environment**

Call `dokploy_set_application_env` with exactly `BACKEND_URL=<verified-private-backend-url>`, `createEnvFile: false`, and `confirm: true`.

- [ ] **Step 5: Read back safe configuration**

Assert GitHub source, `main` branch, root context, frontend Dockerfile, nonempty build arguments, and one runtime environment variable. Do not deploy if the backend URL could have defaulted to localhost.

- [ ] **Step 6: Create the frontend domain**

Revalidate DNS, ensure no existing domain row conflicts, then call `dokploy_create_domain` for the frontend application with host `qa.motel.huyndg.io.vn`, port 3000, HTTPS enabled, Let's Encrypt, no strip path, and `confirm: true`.

- [ ] **Step 7: Deploy and verify the frontend**

Deploy with title `Provision QA frontend`, poll to completion, and inspect build logs on failure or runtime logs after success. Require a running service and a domain row targeting frontend port 3000.

### Task 5: End-to-End Verification and Old Stack Removal

**Files:** None.

**Interfaces:**
- Consumes: All four running resource IDs and frontend domain.
- Produces: Verified QA deployment with the obsolete Compose stack deleted.

- [ ] **Step 1: Verify all four resources from fresh project state**

Call `dokploy_list_projects` and exact resolvers. Assert one PostgreSQL, one Redis, two applications, correct environment membership, and no public backend/database domains or ports.

- [ ] **Step 2: Verify HTTPS frontend behavior**

Request `https://qa.motel.huyndg.io.vn` and require a valid HTTPS response from the Next.js application. A temporary certificate issuance delay may be retried; routing to another service is a failure.

- [ ] **Step 3: Verify the same-origin API proxy**

Request a known `/api` endpoint through `https://qa.motel.huyndg.io.vn/api/...`. Require a backend-shaped response rather than a Next.js 404, Traefik 404, gateway error, or CORS failure. Authentication rejection is acceptable for a protected endpoint if it uses the documented backend error envelope.

- [ ] **Step 4: Recheck logs after traffic**

Read recent backend and frontend runtime logs. Require no connection refusal, hostname-resolution failure, missing environment variable, or repeated crash/restart.

- [ ] **Step 5: Delete the obsolete Compose stack**

Resolve `Motel QA` exactly in the QA environment immediately before deletion. Only after Steps 1-4 pass, call `dokploy_delete_compose` with its live `composeId` and `confirm: true`.

- [ ] **Step 6: Verify final state**

Call `dokploy_list_projects` again. Assert the four replacement resources remain healthy and `Motel QA` no longer exists. Report resource names, statuses, routing, and verification results without secrets or connection strings.
