# Integration checklist

This checklist tracks integration and release evidence. Reported code checks are recorded below; all live readiness gates remain pending. Keep this work on its branch until the user's required readiness checks are complete. No deployment or paid translation is claimed.

## Completed targeted backend checks (reported)

- [x] Node version `v24.21.0`.
- [x] `npm run test:server` — 21/21 across two files (18 backend lifecycle/auth/payment tests; 3 root public-config tests).
- [x] `npm run typecheck` — passed.
- [x] `npx eslint src/lib/server src/app/api tests/server` — passed.
- [x] `npm run test:contracts` — 5/5 passed; contract worker reports actual contract compilation and ABI.
- [x] Root compile, lint and typecheck reported passing.
- [x] Earlier production build reported passing; final standalone-assets rebuild is pending. Earlier standalone inspection found the SQLite migration in bundled output.
- [x] Backend implementation includes agreed routes, SQLite persistence, immutable source/terms/model result, nonce/session/origin controls, 32 KiB streaming body cap, and bounded challenge issuance (five per address, 10,000 globally) with expired-row pruning.
- [x] Inference request construction explicitly asks for private routing, disables fallback, requests TEE verification, parses `x_0g_trace`, leaves missing evidence null and rejects reported false verification.
- [x] Public config reports `configured: false`; missing session secret yields 503 for protected APIs, and fixtures do not bypass payment authorization.

These are code and test results, not evidence of live inference, deployment, sponsor integration or Hindi quality. The final standalone-assets rebuild remains pending. The actual Arkiv reader is not yet wired: runtime requires the neutral reader from the frontend/Arkiv owner and currently fails closed when it is absent.

Security review follow-up: nonretryable provider failures previously could incorrectly offer retry; the fix now requires both remaining attempt budget and a retryable failure, and a test covers it. No additional concrete findings were reported by the follow-up review.

Known implementation limits/defaults: verified payment cache does not track later chain reorganizations; Router verification is reported but not independently checked; EIP-1271 contract-wallet signatures are unsupported (EOA only); the backend receives plaintext drafts and translations. Configured defaults are a 60-second inference timeout, 30-second lease grace and three payment confirmations; these are not measured latency or finality claims.

All live readiness checks remain pending, including provider credentials/use, Hindi quality review, actual deployment/funds/paid flow, and Arkiv runtime wiring. Do not move this branch to `MAIN` until the required readiness checks are complete.

## Shared contract and repository

- [ ] Confirm all work uses the single `tool-city` repository and root npm lockfile.
- [ ] Confirm common structure contract version 1.0 is the shared source for DTOs, routes, environment names and ownership boundaries.
- [ ] Confirm `src/lib/shared/*` is the only shared client/server contract; browser code imports no `src/lib/server/*` module.
- [ ] Confirm `.env.example` contains names only, with no real credentials.
- [ ] Confirm fixture data is visibly development-only and cannot authorize a job or payment.

## Backend and auth

- [ ] Validate required server configuration at startup and keep secrets out of client bundles.
- [ ] Verify one-use signed challenge behavior, expiration, replay rejection, session expiry and logout.
- [ ] Verify allowed-origin and same-origin protections on state-changing endpoints.
- [ ] Verify buyer identity is session-derived and another buyer receives the same 404 as a missing job.
- [ ] Verify text limits, segmentation, immutable source/accepted terms and response envelopes at route boundaries.
- [ ] Verify merchant access is based on configured merchant identity and responses contain no drafts, model output or edits.

## Whitechain checkout and entitlement

- [ ] Confirm official Whitechain chain ID, RPC, token address and token decimals from current authoritative sources.
- [ ] Compile the actual checkout contract and run tests for correct settlement, failed-transfer atomicity, incorrect expected service/amount/terms, duplicate buyer/job, and separate buyers using the same job ID.
- [ ] Confirm deployment config remains unconfigured until actual deployment values exist.
- [ ] Deploy only after service terms bytes, service ID, merchant, amount and token decimals are frozen and reconciled.
- [ ] Verify deployed bytecode/interface and publish the generated ABI and actual deployment manifest together.
- [ ] Exercise browser approval/purchase on the configured chain with a real test wallet and native test gas.
- [ ] Verify successful receipt, confirmation policy, token transfer, contract state and buyer/job/service/payee/amount/terms match before marking paid.
- [ ] Verify pending and repeated verification are safe; a transaction hash alone never grants entitlement.

## Arkiv and job creation

- [ ] Confirm the frontend Arkiv write uses the connected wallet and correct application namespace.
- [ ] Confirm the neutral Arkiv read adapter returns normalized records and distinguishes missing records from read failures.
- [ ] Verify backend job creation independently checks current listing owner and supported service terms.
- [ ] Verify withdrawal prevents new quotes/jobs while already accepted jobs remain recoverable under their immutable terms.
- [ ] Record live Arkiv reads/writes separately from injected test adapters or fixtures.

## 0G inference and recovery

- [ ] Confirm configured 0G endpoint/model availability and explicit private-routing behavior from actual requests.
- [ ] Confirm reported verification metadata is normalized honestly; missing evidence remains null and Router reports are not described as independent verification.
- [ ] Have a Hindi reviewer assess five harmless samples, including names, a date, numbers and a URL; record actual latency and cost/credit observations.
- [ ] Verify model output contains the complete expected segment ID set and valid strings before saving it.
- [ ] Verify durable atomic claim prevents concurrent dispatch and the server enforces at most two dispatched attempts.
- [ ] Verify timeout/lease settings against the deployment host and reconcile expired leases to interrupted state without stealing active work.
- [ ] Verify provider failure preserves paid entitlement, records sanitized failure, and allows only the eligible manual retry.
- [ ] Verify saved result and edits survive process restart; original model result remains intact after edits.

## App and example integration

- [ ] Confirm city/UI pages consume the shared DTOs and show persisted backend state as the source of truth.
- [ ] Confirm inference begins only from an explicit user action; polling occurs only during active states.
- [ ] Confirm review/export uses saved edits, or saved model output when no edits exist.
- [ ] Confirm merchant CSV includes verified settlement fields only and does not imply a full-chain transaction index.
- [ ] Build the checkout demo through the root workspace and verify same-origin production API/cookie behavior; verify local proxy origins are explicitly allowlisted.

## Release gate

- [ ] Complete all user-required readiness checks before moving this branch to `MAIN`.
- [ ] From the integrated branch, run clean `npm ci`, lint, typecheck, production build, targeted server tests and contract tests; record exact commands and results in the handoff.
- [ ] Manually verify unpaid-run denial, wrong-buyer denial, wrong-terms rejection, duplicate purchase rejection, concurrent execution, provider failure/retry, listing withdrawal and exports.
- [ ] Verify one real paid private translation, saved-result reopen and persistence after a service restart.
- [ ] Confirm the production runtime is one Node instance with persistent SQLite storage and that measured timeout and confirmation settings are documented.
- [ ] Record live vs fixture integrations, deployment dependencies, known failures and next owner action in `docs/backend-handoff.md`.

No release gate should be marked complete based solely on matching interfaces, a passing mock, a fixture, or an unverified transaction hash.
