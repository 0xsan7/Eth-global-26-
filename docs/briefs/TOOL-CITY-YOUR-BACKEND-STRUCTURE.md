# Tool City — Your Agent Assignment: Backend, Payments and 0G

**Assigned to:** you + Codex, Agent A.\
**Required companion:** [Common structure and integration contract](TOOL-CITY-COMMON-STRUCTURE.md), version 1.0.\
**Branch:** `codex/payment-backend`.\
**Status:** implementation instructions, not implemented code. Read the common document in full before starting.

## 1. Mission

Own the complete trusted path: authenticated buyer → durable job → contract purchase → server verification → useful private translation → saved/recoverable result. You are also the repository integrator. Your teammate owns city/browser UI and Arkiv; they are not building another backend.

The product is one fixed-price English → Hindi text-translation service. No voice, gasless path, Storage, dynamic pricing, extra merchants or autonomous payments. Actual private quality/availability must be tested before committing to the main workflow. Do not substitute fake responses when an integration fails.

## 2. What you own

```text
tool-city/
├── package.json / package-lock.json / tsconfig.json / next.config.ts
├── hardhat.config.ts / .env.example / .gitignore
├── README.md / WHITECHAIN_FEEDBACK.md
├── config/
│   ├── deployment.json
│   └── service-terms.txt
├── contracts/
│   ├── ToolCityCheckout.sol
│   └── test/ToolCityCheckout.test.ts
├── scripts/
│   ├── deploy-checkout.ts
│   └── verify-deployment.ts
├── src/app/layout.tsx
├── src/app/api/                         all common-contract route handlers
├── src/lib/shared/
│   ├── domain.ts
│   ├── api.ts
│   ├── validation.ts
│   ├── deployment.ts
│   ├── checkout-abi.ts
│   └── fixtures.ts
├── src/lib/server/
│   ├── env.ts
│   ├── auth.ts
│   ├── db.ts
│   ├── jobs.ts
│   ├── payment.ts
│   ├── inference.ts
│   ├── recovery.ts
│   ├── settlements.ts
│   └── migrations/001-initial.sql
├── tests/server/
└── docs/
    ├── backend-handoff.md
    └── integration-checklist.md
```

Also establish dependencies for `examples/checkout-demo/package.json` during bootstrap. Afterwards B owns that example's UI/build configuration; dependency changes still go through you. You may add deployment configuration at the root, documented in your handoff.

**Do not edit after bootstrap:** B-owned pages, global CSS, components, browser hooks, original assets, Arkiv adapter/schema/writes, demo UI or `/arkiv/` documentation. Request a change or fix through B. The only bootstrap exception is creating agreed, minimal compiling placeholders before B branches.

## 3. First delivery: a common base, not a separate backend app

1. Create `tool-city/` and verify Git's top-level path is that directory. Initialize the project there rather than inheriting an unrelated parent repo.
2. Scaffold one Next.js App Router app with TypeScript and Node server routes. Choose/pin versions from current supported official tooling; do not copy guessed old API syntax.
3. Configure one npm root lockfile and the small checkout-example workspace. Establish the common script names and alias `@/*` → `src/*`.
4. Implement common `domain.ts`, API envelopes/DTOs, validation and public-config parsing exactly as specified. Create one obvious development fixture covering awaiting payment, running, ready and interrupted.
5. Add minimal `ClientProviders`, `AppShell`, city page and global style placeholders so the base builds. Root layout imports B's `ClientProviders`; do not build an alternate wallet provider.
6. Commit this baseline and give B its commit hash. They start from it and replace their own placeholders. Send the shared types and relevant dependency versions before either agent invents new payloads.
7. Set deployment configuration to honestly unconfigured until actual values exist. Do not invent an ABI, receipt or successful request as a live integration.

In parallel with scaffolding, validate actual 0G private translation using harmless samples and obtain Whitechain prerequisites. B proves Arkiv owner-signed operations. If a gate fails, report the exact failure; do not quietly widen scope.

## 4. Server modules and responsibilities

| Module | Responsibility |
|---|---|
| `env.ts` | Validate required server configuration; no secret exports to client modules |
| `auth.ts` | One-use signed challenges, secure sessions, buyer/merchant authorization and allowed-origin checks |
| `db.ts` | SQLite on persistent disk, migrations and atomic transactions; single production app instance |
| `jobs.ts` | New job/input/terms binding, state transitions, source segmentation, result access and edited versions |
| `payment.ts` | Trusted RPC reads, receipt/settlement/contract-state reconciliation, pending/idempotent verification |
| `inference.ts` | Explicit private routing, supported verification request, bounded inference and output validation |
| `recovery.ts` | Durable execution lease, attempt budget, expired-lease interruption and authorized recovery |
| `settlements.ts` | Merchant's verified app-purchase rows and safe CSV export |

Use the common DTOs at all route boundaries. Route handlers should call modules rather than contain independent versions of the business rules. Server-only dependencies must stay out of the client bundle.

### Minimum durable records

- Challenges: ID, intended address, exact message, expiration and consumed state.
- Sessions: opaque identifier/hash, address and expiration; do not store plaintext secrets in public config.
- Jobs: random 32-byte ID, buyer, entity/service reference, source segments, immutable checkout terms, job status, payment reference, original model output, edited output and timestamps.
- Attempts: job, attempt number, dispatched/running/success/failure/interrupted status, lease expiration, reported request/model/routing/verification fields and sanitized error.
- Settlements: verified buyer/job purchase fields for merchant views, either stored with the job or in a related table.

Use unique constraints and atomic updates for buyer/job purchases and execution ownership. Do not hold a SQLite transaction open during an external model request. Raw drafts/results stay private and out of operational logs. Merchant views must not join them into response payloads.

## 5. Contract and checkout handoff

Implement the common `purchase`/`getPurchase` interface and exact `PurchaseMade` event. Configure official token, merchant, service ID, amount and terms at deployment; no permissionless registration, setters, authorization wrapper or upgrade mechanism is needed.

Required behavior:

- Purchase checks expected service/amount/terms before moving tokens.
- Caller is the buyer. Key purchases by buyer + random job ID so another caller cannot squat that buyer's job ID.
- Successful safe token transfer and entitlement record are atomic. Failed transfer leaves neither a paid record nor a success event.
- Correctly reject a duplicate buyer/job purchase. Reopening is an API operation, not another contract transaction.
- Compile and test actual Solidity. Do not reuse the earlier attachment's broken declarations or tests for nonexistent methods.

Use the deployment account only through deployment tooling. The production web server does not need a customer-spending key or a relayer key.

After deployment and explorer verification, publish these together in one commit: actual compiled `checkout-abi.ts`, updated public manifest, service terms file, deployment block/address, official token decimals and integer price, merchant, service ID, terms hash, successful settlement evidence and any still-unverified assumptions. B consumes these exact files.

Until that commit exists, B may build with a labelled fixture and disabled live purchase. They must not create their own pretend contract interface.

## 6. HTTP implementation checklist

Implement every common endpoint, including `GET /api/config` and `GET /api/auth/session`; do not omit them and force the browser to infer configuration or login state. The common document owns route names, body fields, envelopes and status codes.

Important behavior:

1. New job creation independently reads B's neutral `getWorkshop` adapter and validates current owner/service/terms against configured checkout. Browser-supplied ownership and `supported` are not trusted.
2. Buyer comes from the session, not request JSON. Source and terms become immutable after creation.
3. Payment submission can be pending. Save the reference without marking it verified; rechecking it is safe and returns existing state once paid.
4. Verify actual successful transaction, configured chain/token/contract, settlement, buyer/job/service/payee/amount/terms and stored purchase. Use a documented network confirmation policy, not an arbitrary finality claim.
5. A missing or different buyer's job returns the same 404 response. Merchant role is the configured merchant address, not anyone who can publish an Arkiv record.
6. Repeated run requests cannot dispatch concurrent inference. A ready job returns its saved result; an active job returns running; ineligible retries are rejected.
7. Edits require ready status and the full valid segment ID set. Original model output stays intact. Job-list endpoints return summaries, not every draft.
8. Merchant JSON/CSV contains verified app settlements only. Label that scope; do not present it as an index of every direct transaction on the chain.

While B's Arkiv read adapter is unfinished, use an injected test adapter for isolated unit checks only. Do not expose a bypass in production job creation. Merge the genuine adapter for the paid slice.

## 7. Private inference and recovery

Confirm actual model/API support through current official docs and the available 0G mentor. The earlier advertised model `0gm-1.0-35b-a3b` is a candidate, not proof of availability or Hindi quality. Validate five harmless drafts with someone who can assess Hindi, including names, a date, numbers and a URL. Record real latency and costs/credits rather than inventing a margin.

Request explicit private routing and supported Router verification metadata. Do not silently downgrade on 503 or invent a `tee_verified` value. Normalize reported evidence to the common type; leave missing fields null. Say Router-reported verification, not independently proven correctness.

Send stable source segment IDs and ask for one corresponding translation per ID. Validate IDs, completeness and string structure. Display the saved source rather than a model restatement. Reject malformed or incomplete responses; a valid schema alone is not a quality verdict.

Before dispatch, atomically claim a durable lease and increment attempts. Permit at most two dispatched attempts per job. Set a measured/configured inference timeout and lease longer than that timeout; verify the host accommodates it. Persist result/evidence before marking ready. Do not use a detached promise and assume the host will preserve it.

On failure retain entitlement, record the sanitized outcome and derive retry eligibility server-side. Reconcile expired leases to interrupted state; do not clear a still-active lease on every process start. A crash/timeout may leave provider execution uncertain. That attempt counts and a retry may incur more compute; no exactly-once execution or automatic-refund promise.

## 8. Required verification

Run meaningful checks appropriate to the implementation, including:

- Contract: correct settlement, failed transfer atomicity, wrong expected terms/service/amount, duplicate buyer/job and two different buyers using the same random ID.
- API: unsigned/expired/reused auth challenge; unpaid run; other buyer denied; listing owner/service mismatch; merchant data access restrictions.
- Verification: pending receipt, mismatched receipt/contract state and repeated legitimate verification.
- Runner: two concurrent callers dispatch once, private-provider failure, bounded retry, incomplete segment rejection, restart/expired-lease recovery and saved result retrieval.
- Data: edited version does not overwrite original, CSV contains settlement fields and no private text, production fixture switch cannot bypass entitlement.

Contract/server checks may use explicit test doubles. Live sponsor evidence requires genuine reads/writes/settlement/inference and must be labelled separately. Do not create tests solely to mirror helper functions or inflate counts.

## 9. Integration, deployment and final handoff

Merge B's small completed commits at M1–M3 rather than waiting for the final day. Run the paid slice in a plain UI before asking B to finish decorative city work. Review their API consumption; do not fix mismatches by quietly changing JSON names.

Deploy one Node instance with persistent SQLite storage; no ephemeral serverless filesystem. Secrets stay in host configuration. The separate checkout example builds to generated public assets before the main Next build, using the common same-origin API. Verify a restart preserves the actual paid result.

Own setup/architecture/limitations/AI disclosure, onchain rationale, `WHITECHAIN_FEEDBACK.md`, actual 0G evidence and an integration checklist. B supplies Arkiv and visual/demo material. Record actual commands and results in `docs/backend-handoff.md`, with:

```text
Commit / common contract version:
Files changed:
Commands run and actual results:
Public deployment + ABI + manifest commit:
Live Arkiv / Whitechain / 0G evidence:
Development-only fixtures or stubs still present:
Environment requirements (names only):
Known failures / limitations:
What Agent B must pull or do next:
```

You are done when the **combined** project installs from the root lockfile, builds, passes the relevant checks, performs one real paid private translation, persists/reopens its result, denies wrong/unpaid access, handles one failed attempt honestly and serves the standalone checkout example. A green backend alone is not completion of the shared project.
