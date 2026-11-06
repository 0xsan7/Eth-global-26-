# BriefMint backend checkpoint

Date: 6 November 2026, IST. Branch: `codex/payment-backend`; foundation `5674d82`, durable backend `a99a0d2`, guarded preflight/diagnostics through `66a0931`. This checkpoint completes additional local backend work while successful live inference and chain tests are deferred. Read the [Agent B handoff](agent-b-handoff.md) for exact API examples, browser steps, adapter signatures and ownership. The [integration contract v1.1](integration-contract.md) and `src/lib/shared/briefs.ts` remain authoritative.

## What is implemented

The interrupted services were preserved and completed into a runnable backend: EOA authentication, private owner-bound intake, finite promotional/operator quota, atomic lease/attempt reservation, bounded structured private inference, saved revisioned edits, immutable original result/evidence, exact public approval, immutable Arkiv intent preparation, injected independent reconciliation and private recovery/export.

The local completion follow-up adds approved public TXT/JSON exports with no private ID in filename/content, a read-only authenticated publication refresh route, honest stale status for saved observations, and concurrency guards in both refresh/reconcile directions. External updates/expiry are observable through the injected reader while pending intents and newer private edits remain intact. No actual Arkiv reader or wallet write is installed or claimed.

Migrations 002/003 add briefs, attempts, approval snapshots, publication intents and quota ledger without changing historical jobs/attempts/settlements or their immutability trigger. Migration versions are recorded transactionally and reopening is idempotent; an existing pre-version-table legacy database is tested. Standalone packaging includes SQL files.

Runtime/API changes: `brief-runtime.ts`, `brief-http.ts`, existing `runtime.ts`, auth purpose selection and all routes under `src/app/api/briefs` plus `src/app/api/briefmint/config`. New services: `briefs.ts`, `quota.ts`, `brief-runner.ts`, `brief-inference.ts`, `brief-publication.ts`. Supporting changes: `.env.example`, standalone packaging, local production smoke and guarded live-provider smoke. New tests: `brief-execution.test.ts`, `brief-http.test.ts`, `brief-publication.test.ts`. No frontend, Solidity, dependency or lockfile changes.

## Completion estimate for the entire PRD

**Approximately 57%**, up from 55%. This is an engineering estimate of delivered scope, not a percentage of passed end-to-end acceptance tests. It includes the existing inspected city visuals but gives no completion credit for mocked live integrations. Use this same weighting for future progress updates rather than counting files or lines.

| Workstream | Share of full PRD | Credit at this checkpoint | Basis |
|---|---:|---:|---|
| Backend/API/data safety | 40 | 38 | Approved public export, explicit chain observation/freshness and bidirectional race guards added; cancellation/uncertain-intent and external-change resolution remain limited |
| Existing city and frontend integration | 25 | 10 | Reusable visual reference exists; actual wallet/API/state wiring not validated |
| Real 0G/Arkiv and independent-reader proof | 20 | 0 | No authorized live inference or chain lifecycle evidence |
| Deployment, validation, docs and demo evidence | 15 | 9 | Production build/HTTP smoke now proves actual process restart with persistent records/session; local integration/privacy runbook added. HTTPS hosting, end-to-end trial and submission evidence remain |
| Total | 100 | **57** | Full PRD remains incomplete |

## Verified checks

99 server tests; lint; typecheck; production build; local standalone HTTP smoke including real process restart; Git whitespace checks. The 5 Solidity tests previously passed at the durable checkpoint and were not rerun for this server-only change. Test doubles are explicitly local. One operator-run live provider request returned HTTP 502 with uncertain billing; there is still no successful inference and no second request. Initial local smoke failed on sandbox loopback `EPERM`, then passed with approved local server access. The legacy Vite checkout example retains its nonfatal `use client` bundling warning.

The HTTP smoke verifies actual compiled route availability, authentication/query policy, private persistence, safe configuration, default private export, rejection of unapproved public export, owner-authenticated publication refresh, and fail-closed compilation. It restarts the real standalone Node process with the same temporary SQLite and session secret and proves the brief/session survive with zero dispatched attempts. It intentionally clears provider/quota environment variables so it cannot dispatch external inference. It does not test the absent Vite app or a production host.

## Remaining limitations

- Production has no Arkiv reader injected; prepare fails with sanitized `ARKIV_UNAVAILABLE` until B's neutral adapter is supplied. Reconciliation is tested with injected chain doubles, not a claimed live receipt.
- No assistant credential access or further inference. One operator-run request failed with HTTP 502 after 1,827 ms; actual debit is unknown. Private model availability, usable structured output, promotional-credit eligibility, successful latency/token cost and independent registered-signer verification are unproven. Unknown verification stays unavailable; see [the preflight record](0g-preflight.md).
- Original response bytes are stored privately for future verification. This does not establish a signature's validity or semantic correctness of generated text.
- Unknown broadcasts/reverted receipts conservatively remain pending because the current receipt DTO cannot prove a failed transaction attempted that exact intent. Re-prepare is blocked after uncertainty/submission, revision changes or settlement. There is no safe cancellation/replacement operation yet.
- External chain changes are detected and block overwrite; explicit resolution is not implemented. Expiry extension and reopening closed records are not supported. A proved expiry can be observed during publication preparation or explicit read-only refresh; there is no autonomous chain watcher. Historical reads are stale until a new successful observation, and unavailable reads preserve previous evidence.
- Independent public reader, indexed public discovery, real browser writes, city integration, account switching, native expiry evidence, HTTPS persistent hosting, intended-user trial and submission artifacts remain unfinished.

## Exact next task

The teammate supplies the city and neutral Arkiv adapter from its owned branch; neither exists in this checkout. Use shared contract v1.1 (including `refresh` and optional public export) and inject the verified reader into `createBriefRuntime(db,env,{reader})`. Validate the coordinated Vite/Next cookie flow using [the local integration runbook](local-integration.md), replace fixture state with typed API calls, and finish the independent Arkiv reader in B's ownership area. Once the operator separately authorizes live actions, resolve the 0G 502 and execute harmless 0G plus owner-signed Arkiv lifecycle gates. Record actual evidence and SDK/network compatibility before declaring the full PRD complete. None of these unproven steps can be completed by another backend unit test.

The user still controls account selection and live authorization. No push, merge, deployment or broadcast is part of this checkpoint.
