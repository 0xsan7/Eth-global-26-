# Backend handoff

## BriefMint foundation — 6 November 2026

The user-approved BriefMint PRD now governs the new product. The sections below this update describe the preserved **legacy translation backend**, not BriefMint requirements. No Whitechain checkout/funding is required for BriefMint.

Starting HEAD `4f2f4d17c92ea7b3996ffefe7c5ae5e4e406b307`, branch `codex/payment-backend`, clean before work. Added `src/lib/shared/briefs.ts` (strict request/response DTOs, public projection/canonical SHA-256, approval checks, independent states and neutral Arkiv interfaces), `tests/server/briefs-contract.test.ts`, and [the frozen integration contract](briefmint/integration-contract.md). No legacy runtime/schema or `apps/web` edits. Frontend reference inspected at `cb0db61d3515ee0621547f7832e9826f4be08f2e` through Git objects, not merged.

Actual checks: `npm run test:server` passed **33 tests** (21 existing, 12 new); `npm run lint` passed; `npm run typecheck` passed. Initial typecheck found a test-only excess-property typing error in a deliberate hostile-input test; fixed and all checks rerun successfully. Independent read-only review prompted approved-payload snapshots, intent hash checking, source-reference checks and publication-state consistency validation. No production build or Solidity rerun was needed for this shared-contract-only change; no live dependency checks were performed.

Auth chain selection (BriefMint 7794095, legacy default 1874), single-origin Vite/Next hosting, browser-sign/server-reconcile ownership and exact Agent A/B files are **specified**, not activated. Next A task: additive migrations plus owner-bound brief CRUD/approval routes and purpose-selected auth. Next B task: shared DTO consumer and neutral Arkiv adapters. Real 0G, Arkiv lifecycle, quota/model measurements and integrated frontend/hosting remain live gates. Prepared-but-uncertain broadcast recovery must remain conservative; do not create duplicate intents to evade it. No credentials accessed, transactions, deployment, push or merge performed.

## Legacy backend handoff (preserved)

**Status:** implementation and reported code checks pass on this branch. All live readiness gates remain pending, and the work remains on the branch until those checks are satisfied. This does not claim a genuine deployment or paid translation.

## Contract

- Shared contract: `docs/briefs/TOOL-CITY-COMMON-STRUCTURE.md`, version 1.0 (6 November 2026).
- Backend assignment: `docs/briefs/san-backend-original.md`.
- Repository: one Next.js application, one API and one persistent SQLite database. The backend owns trusted job, auth, checkout verification, inference, recovery and settlement paths. Browser code must not import `src/lib/server/*`.
- Public API payloads and job states follow the shared contract. Buyer identity comes from the signed session; requested price, buyer, model, retry allowance and paid state are never trusted from the browser.
- Keep source text and translations private. Merchant reporting is limited to verified app settlement fields.

## Environment configuration

The agreed variable names are listed below. This is a names-only inventory; no local environment file or secret values were inspected or recorded. Required-at-runtime status should be documented against the implemented deployment mode.

| Variable | Purpose |
|---|---|
| `APP_ORIGIN` | Canonical application origin for auth-domain checks |
| `AUTH_ALLOWED_ORIGINS` | Explicit allowed origins for state-changing requests |
| `SESSION_SECRET` | Server-only session signing/hash secret |
| `DATABASE_PATH` | Persistent SQLite database location |
| `WHITECHAIN_RPC_URL` | Whitechain RPC for checkout verification |
| `ARKIV_RPC_URL` | Arkiv RPC for server-side listing checks |
| `ZERO_G_API_KEY` | Server-only 0G provider credential |
| `ZERO_G_BASE_URL` | Configured 0G API endpoint |
| `ZERO_G_MODEL_ID` | Configured model identifier |
| `INFERENCE_TIMEOUT_MS` | Bounded provider request timeout |
| `PAYMENT_CONFIRMATIONS` | Receipt confirmation policy |
| `DEPLOYER_PRIVATE_KEY` | Deployment tooling only; not needed by the running web service |
| `NEXT_PUBLIC_ENABLE_DEV_FIXTURES` | Development rendering fixtures only; must not bypass server authorization and must be false/absent in production |

Never put secrets in `NEXT_PUBLIC_*` variables, manifests, browser bundles, logs or committed files. Any provider-specific variable added during implementation should be listed here by name and its purpose, without a value.

## Integration and deployment status

Implemented backend behavior reported by the backend coordinator:

- Server modules and the agreed API endpoints are written. SQLite persistence is used for jobs and immutable source, accepted terms and model result.
- Auth uses nonce/session and origin checks. Expired challenge/session rows are pruned; challenge issuance is bounded to five outstanding challenges per address and 10,000 globally.
- Request bodies are limited to 32 KiB while streaming.
- Inference requests set `X-0G-Provider-Trust-Mode: private`, `X-0G-Provider-Allow-Fallbacks: false` and `verify_tee: true`. `x_0g_trace` is parsed; missing verification evidence remains null, and a reported false verification is rejected.
- The Arkiv reader fails closed when no neutral reader is supplied. The runtime integration still needs the teammate's reader wired through `runtime.ts` after merge.
- Public config remains `configured: false`. Public config can be read without a session; when `SESSION_SECRET` is missing, protected APIs return 503. Fixtures cannot bypass payment authorization.
- A review found that nonretryable provider failures could incorrectly expose retry eligibility. This was fixed: retry now requires both remaining attempt budget and a retryable failure, with a test covering the behavior.
- A follow-up security review reported no additional concrete findings.

Checks reported as passing on this branch:

| Command | Result |
|---|---|
| Node version | `v24.21.0` |
| `npm run test:server` | 21/21 across two files: 18 backend lifecycle/auth/payment tests and 3 root public-config tests |
| `npm run typecheck` | passed |
| `npx eslint src/lib/server src/app/api tests/server` | passed |
| `npm run test:contracts` | 5/5 passed; contract worker reports actual contract compilation and ABI |
| Root compile, lint and typecheck | reported passing |
| `npm run build` | passed, including independent example and standalone public/static asset preparation |
| `npm run smoke:local` | passed against the actual standalone HTTP server: home/example, unconfigured public config, signed ephemeral test-wallet login, protected job list and fail-closed new job creation |

Standalone inspection found the SQLite migration in bundled output, and the HTTP smoke created its temporary SQLite database successfully. The smoke used an ephemeral unfunded identity, cleaned up its database/process and called no external provider. Passing code checks do not establish live sponsor operation or readiness to move this branch to `MAIN`.

Live/deployment items remain **pending evidence**:

- Whitechain live deployment and explorer source verification, followed by real official-token settlement. Local compilation/tests and the generated ABI exist; the public deployment manifest remains unconfigured.
- Arkiv server-side listing adapter available and independently checked by job creation.
- 0G private routing and verification metadata confirmed against an actual configured service; Hindi usefulness reviewed with a qualified reviewer.
- Persistent Node deployment and SQLite volume configured; restart recovery demonstrated.
- Paid end-to-end path completed with a real test purchase, server verification, translation and saved-result reopen.
- Deployment location, block, contract and token details recorded in public config and evidence. No address, transaction receipt, success response or sponsor endorsement should be filled in from a fixture.

## Provider references and live gates

Implementation was aligned to the 0G Router documentation for [routing](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/routing), [chat completions](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/chat-completions) and [verifiable execution](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution). Documentation alignment and request construction are not evidence of a successful live request.

No live readiness gate has passed. No provider keys, deployed contract, funds, paid inference or Hindi reviewer results are available yet. Keep this work on its branch until the user's required readiness checks are complete. Do not label gates complete based on code checks or fixtures. Keep test doubles, development fixtures and live sponsor evidence clearly distinguished.

## Known limitations and configured defaults

- Runtime dependency audit (`npm audit --omit=dev`) reports zero vulnerabilities at this snapshot. Full development-tool audit still reports legacy Zod 3 and minimatch advisories through Hardhat/lint dependencies; no unsafe forced major toolchain downgrade/override was used. These development-only findings need review before release and do not justify a main promotion.
- Verified payment state is cached; later chain reorganizations are not tracked.
- Router verification is reported provider evidence and is not independently checked by the application.
- Wallet authentication supports EOA signatures only; EIP-1271 contract-wallet signatures are not supported.
- The application backend receives plaintext drafts and translations to perform the service; private routing does not hide content from the backend.
- Current configured defaults are a 60-second inference timeout, a 30-second lease grace period and three payment confirmations. These are configuration defaults, not values measured from provider latency or demonstrated network finality.

## Known gates and next actions

1. Keep the branch out of `MAIN` until all user-required readiness checks are complete.
2. Frontend/Arkiv owner: merge and pass the neutral Arkiv reader through `runtime.ts`; job creation must continue failing closed until it is available.
3. Validate current network/token/provider prerequisites and report any unavailable dependency without substituting a fake success.
4. Obtain authorized provider configuration and a Hindi reviewer, then record actual private inference evidence and review findings.
5. Deploy and verify the real checkout only after terms and configuration are frozen; record remaining limitations and evidence.

## Coordination and branch publishing

The root used a dedicated GPT-6.1 Sol high coordinator, GPT-6.1 Terra high contract worker and GPT-6 Luna medium documentation worker. The root reviewed/integrated the changes and performed broad build/runtime checks. The complete staged assignment and prerequisite instructions are in `docs/san-backend-payments.md` and `docs/SETUP-LIVE-INTEGRATIONS.md`.

Branch is `codex/payment-backend`. Main has not been changed. The local repository now scopes HTTPS credentials by repository path to avoid reusing a different cached GitHub login. Do not place a PAT in any document or remote URL. Remote publishing status must be recorded from the actual push result.

Actual local commits: `8e5a2a2` (staged plan/setup) and `d5abe3c` (tested backend foundation). Push was attempted and failed because the noninteractive environment could not read the password for the repository-scoped login. No remote push is claimed. Follow the Terminal command in the setup guide to publish the branch interactively; no token needs to enter chat. Clean `npm ci` completed, and the final root lint/typecheck plus 21 server tests and 5 contract tests passed after that clean install.
