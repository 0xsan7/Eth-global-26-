# BriefMint backend checkpoint

Date: 6 November 2026, IST. Branch: `codex/payment-backend`; resumed from `5674d82`. Read the [Agent B handoff](agent-b-handoff.md) for exact API examples, browser steps, adapter signatures and ownership. The [integration contract](integration-contract.md) and `src/lib/shared/briefs.ts` remain authoritative.

## What is implemented

The interrupted services were preserved and completed into a runnable backend: EOA authentication, private owner-bound intake, finite promotional/operator quota, atomic lease/attempt reservation, bounded structured private inference, saved revisioned edits, immutable original result/evidence, exact public approval, immutable Arkiv intent preparation, injected independent reconciliation and private recovery/export.

Migrations 002/003 add briefs, attempts, approval snapshots, publication intents and quota ledger without changing historical jobs/attempts/settlements or their immutability trigger. Migration versions are recorded transactionally and reopening is idempotent; an existing pre-version-table legacy database is tested. Standalone packaging includes SQL files.

Runtime/API changes: `brief-runtime.ts`, `brief-http.ts`, existing `runtime.ts`, auth purpose selection and all routes under `src/app/api/briefs` plus `src/app/api/briefmint/config`. New services: `briefs.ts`, `quota.ts`, `brief-runner.ts`, `brief-inference.ts`, `brief-publication.ts`. Supporting changes: `.env.example`, standalone packaging, local production smoke and guarded live-provider smoke. New tests: `brief-execution.test.ts`, `brief-http.test.ts`, `brief-publication.test.ts`. No frontend, Solidity, dependency or lockfile changes.

## Completion estimate for the entire PRD

**Approximately 55%**. This is an engineering estimate of delivered scope, not a percentage of passed end-to-end acceptance tests. It includes the existing inspected city visuals but gives no completion credit for mocked live integrations. Use this same weighting for future progress updates rather than counting files or lines.

| Workstream | Share of full PRD | Credit at this checkpoint | Basis |
|---|---:|---:|---|
| Backend/API/data safety | 40 | 37 | Local workflow and failure tests pass; recovery/cancellation and external-change resolution remain limited |
| Existing city and frontend integration | 25 | 10 | Reusable visual reference exists; actual wallet/API/state wiring not validated |
| Real 0G/Arkiv and independent-reader proof | 20 | 0 | No authorized live inference or chain lifecycle evidence |
| Deployment, validation, docs and demo evidence | 15 | 8 | Production build/local HTTP smoke and handoffs pass; HTTPS hosting, end-to-end trial and submission evidence remain |
| Total | 100 | **55** | Full PRD remains incomplete |

## Verified checks

74 server tests; 5 Solidity tests; lint; typecheck; production build; local standalone HTTP smoke; Git whitespace checks. Test doubles are explicitly local. The provider smoke is prepared and gated but not run. Initial sandbox loopback/compiler-cache failures passed after appropriate local-access reruns. The legacy Vite checkout example retains its nonfatal `use client` bundling warning.

The HTTP smoke verifies actual compiled route availability, authentication/query policy, private persistence, safe configuration, export and fail-closed compilation. It intentionally clears provider/quota environment variables so it cannot dispatch external inference.

## Remaining limitations

- Production has no Arkiv reader injected; prepare fails with sanitized `ARKIV_UNAVAILABLE` until B's neutral adapter is supplied. Reconciliation is tested with injected chain doubles, not a claimed live receipt.
- No paid inference or credentials access. Private model availability, usable structured output, promotional-credit eligibility, latency/token cost and independent registered-signer verification are unproven. Unknown verification stays unavailable.
- Original response bytes are stored privately for future verification. This does not establish a signature's validity or semantic correctness of generated text.
- Unknown broadcasts/reverted receipts conservatively remain pending because the current receipt DTO cannot prove a failed transaction attempted that exact intent. Re-prepare is blocked after uncertainty/submission, revision changes or settlement. There is no safe cancellation/replacement operation yet.
- External chain changes are detected and block overwrite; explicit resolution is not implemented. Expiry extension and reopening closed records are not supported. A proved expiry can be observed during publication preparation; there is no autonomous chain watcher.
- Independent public reader, indexed public discovery, real browser writes, city integration, account switching, native expiry evidence, HTTPS persistent hosting, intended-user trial and submission artifacts remain unfinished.

## Exact next task

Agent B imports the shared contract, replaces fixture state with relative typed API calls, implements neutral Arkiv schema/read and browser write adapters, then supplies the reader to A for injection into `createBriefRuntime(db,env,{reader})`. Validate the coordinated Vite/Next cookie flow locally. Once the operator separately configures credentials and authorizes live actions, execute harmless 0G and owner-signed Arkiv lifecycle gates, record actual evidence, and resolve any SDK/network differences before declaring the full workflow complete.

The user still controls account selection and live authorization. No push, merge, deployment or broadcast is part of this checkpoint.
