# Live QA core-flow audit status

- Date: 2026-10-11
- Commit inspected: `f160c9d2558c93a53a63ae4812803fa7a23a6bd7`
- QA mutation run: blocked; no QA URLs, manager credentials, environment label, dedicated test account, or isolated motel were configured/confirmed.
- Production/Dokploy mutation: not run.
- Local browser flow: not run against remote QA.

## Gate configuration

Required for an explicitly approved, isolated QA run:

- `E2E_REAL=1`
- `E2E_QA_MUTATIONS=1`
- `E2E_QA_ENVIRONMENT=qa`
- `E2E_QA_ALLOWED_ORIGINS=<comma-separated exact frontend/backend origins, including scheme and port>`
- `E2E_QA_MANAGER_ID=<dedicated disposable QA manager ID>`
- `E2E_QA_MOTEL_ID=<dedicated disposable QA motel ID>`
- `E2E_FRONTEND_URL=<QA frontend origin>
- `BACKEND_URL=<QA backend origin>`
- `E2E_LOGIN_EMAIL=<dedicated QA manager account>`
- `E2E_LOGIN_PASSWORD=<dedicated QA manager password>`

Set each frontend hostname and backend hostname exactly in `E2E_QA_ALLOWED_HOSTS`, comma-separated.

The live run is unsafe until dedicated account/motel isolation is confirmed. Hostnames must be explicitly enumerated in `E2E_QA_ALLOWED_HOSTS`; no inferred QA host heuristic is accepted. Do not print secret values in command output.

## Current UI journey coverage

Added live browser persistence checks for manager login and motel, room, renter creation/reload. Audit design targets contract, billing period, meter capture, invoice generation/finalization, magic-link exchange and renter invoice view. QA execution is blocked, so these stages have no live findings and no product fixes were made. Contract create/send controls are expected absent based on existing route/UI review; payment-proof approval/rejection and cash confirmation remain explicitly blocked product scope, not implemented by this audit.

## Existing limitations

- Fixture-backed Playwright coverage does not prove real QA persistence or real user usability.
- Payment-proof, manager review, and cash-confirmation flows lack complete product journeys; retain as blocked until separately designed and implemented.
- QA records must be uniquely run-tagged and left in place if cleanup would affect history.
