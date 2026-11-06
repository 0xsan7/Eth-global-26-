# Backend handoff

## Local BriefMint completion follow-up — 6 November 2026

Continued from `66a0931` while deferring further paid inference and live chain actions. Shared contract v1.1 adds `POST /api/briefs/:id/publication/refresh` and optional `audience=public` on export. Public downloads require current approval, validate the exact public hash/snapshot, recheck revision after asynchronous hashing, and omit private IDs even from filenames. Private export remains the default.

Refresh observes only the known entity/current block through the injected reader, records external changes or proved expiry, preserves pending intent/private edits/approval, and preserves confirmed evidence on errors. Stored observations are stale on ordinary reads rather than indefinitely fresh. Both directions of refresh/reconcile races are guarded; an owner mismatch cannot leave evidence labelled fresh. The actual chain reader remains unavailable until the teammate supplies its adapter.

Actual checks: **99 server tests passed**, lint/typecheck/production build passed, whitespace checks passed. Extended local standalone HTTP smoke passed with a real process restart, same temporary SQLite/session, zero inference dispatches, new-route authentication and rejection of unapproved public export. Initial smoke failed on sandbox loopback `EPERM`; the same command passed with approved local server access. Existing Vite checkout-example `use client` warning is unchanged and nonfatal. Solidity was not modified or rerun; its earlier five-test result remains historical.

Full-PRD completion is approximately **57%** (backend 38/40, existing frontend 10/25, live sponsor proof 0/20, validation/docs/deployment 9/15). See [current checkpoint](briefmint/backend-checkpoint.md), [integration contract](briefmint/integration-contract.md), [teammate handoff](briefmint/agent-b-handoff.md) and [local setup/privacy runbook](briefmint/local-integration.md). `apps/web` is absent from this checkout; teammate files, credentials and external state were not changed. The next implementation dependency is the teammate's city/Arkiv adapter, followed by coordinated local origin/cookie checks and separately authorized live validation. No push, merge or deployment.

## 0G first-request preflight — 6 November 2026

Focused follow-up from `a99a0d2`: hardened the guarded smoke and added [the exact operator setup/runbook](briefmint/0g-preflight.md). A public-only CLI run passed with TeeML `0gm-1.0-35b-a3b`, one catalog provider and zero inference requests. Private routing/fallback policy retained; single POST, redirects rejected, explicit authorization, fresh catalog checks, smoke-only non-thinking JSON/1200-token request and safe latency/provider/billing reporting are tested. Normal backend generation defaults stay unchanged.

91 server tests (17 new injected smoke cases), lint, typecheck and whitespace checks pass. The operator ran one authenticated inference attempt: HTTP 502 / `PROVIDER_UNAVAILABLE` after 1,827 ms; billing is uncertain, and the prior diagnostic output did not capture a safe upstream request ID or error subtype. The updated local smoke now captures only allowlisted error metadata on future attempts. No key was accessed by the assistant and no second inference was run. Independent verification remains unavailable, and capacity, actual debit, model quality and successful output remain live gates. Full-PRD completion stays approximately **55%**. `a99a0d2` remains the preserved backend checkpoint; this follow-up is isolated preflight work, not a claim of live integration success.

## BriefMint durable backend checkpoint — 6 November 2026

Resumed and preserved the uncommitted implementation on `codex/payment-backend` from committed foundation `5674d82`. Existing work supplied migration 002, private lifecycle services, quota/runner/compiler, publication service, auth purpose selection, draft handoff and guarded provider smoke. This continuation completed runtime/HTTP routing, migration 003 evidence/identity hardening, original-response persistence, standalone migration packaging, strict auth queries, security fixes, regression tests and the [Agent B handoff](briefmint/agent-b-handoff.md).

All ten shared API operations are installed: config; private list/create/get; run; draft save; approve; publication prepare/reconcile; export. The real compiler is installed but requires operator configuration and explicit finite quota; the production Arkiv reader is deliberately absent pending B's adapter. Neither dependency is faked. Legacy translation/payment tables, immutable quote trigger, payment checks and disabled checkout configuration are preserved. `apps/web` and teammate files are unchanged.

Actual final validation:

- `npm run test:server`: **74 tests passed** across six files (33 pre-existing foundation/legacy tests, 41 new execution/HTTP/publication tests).
- `npm run test:contracts`: **5 tests passed**, local Hardhat execution, no deployment.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. Build lists every BriefMint route and copies SQL migrations into standalone runtime. The existing checkout-example Vite build emits a nonfatal `use client` directive warning.
- `npm run smoke:local`: passed against the real standalone server and temporary SQLite: legacy auth/list/checkout denial; BriefMint chain/query policy, safe readiness, private create/list/get/export and unavailable compilation with zero attempts consumed. No external integration called.
- Initial local smoke was blocked by sandbox loopback `EPERM`; initial Solidity run timed out acquiring the compiler-cache mutex. Both were rerun with approved local runtime/cache access and passed. The operator-only authenticated provider smoke was **not run**.
- `git diff --check`: passed before commit; intended files reviewed, no real environment/credentials staged.

Publication safety limits are deliberate and visible: unknown/reverted transactions remain pending until exact intent binding can be proven; no cancellation/replacement endpoint; external changes block automatic overwrite pending explicit resolution; no expiry extension or reopening closed records. New prepare requires current approval; old legitimately broadcast intents may still reconcile after edits. Settled/submitted/uncertain intents cannot be prepared for signing again. Last confirmed state survives uncertain updates/RPC failures. Original provider bytes/evidence are retained privately and immutable after success, but independent signature verification remains unavailable.

Remaining live work: operator-funded model/credit/latency validation, independent response verification, B's real neutral Arkiv reader/browser writer/indexed filters, user-selected existing publisher account, actual chain lifecycle/expiry, connected city/session/account-switch tests, independent public reader and persistent HTTPS deployment/demo evidence. No credentials, paid inference, chain writes, contract deployment, push or merge performed. [Detailed completion estimate and next actions](briefmint/backend-checkpoint.md).

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
