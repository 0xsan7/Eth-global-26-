# BriefMint backend checkpoint

Date: 6 November 2026, IST. Branch: `codex/payment-backend`; foundation `5674d82`, durable backend `a99a0d2`, guarded preflight/diagnostics through `66a0931`, public export/publication checkpoint `847de7e`, and the current uncommitted city/Arkiv integration. The PRD and `src/lib/shared/briefs.ts` remain authoritative.

## What is implemented

The interrupted services were preserved and completed into a runnable backend: EOA authentication, private owner-bound intake, finite promotional/operator quota, atomic lease/attempt reservation, bounded structured private inference, saved revisioned edits, immutable original result/evidence, exact public approval, immutable Arkiv intent preparation, injected independent reconciliation and private recovery/export.

The local completion follow-up adds approved public TXT/JSON exports with no private ID in filename/content, a read-only authenticated publication refresh route, honest stale status for saved observations, and concurrency guards in both refresh/reconcile directions. The current integration installs a real SDK-backed Arkiv schema/reader/writer boundary, injects the reader only when `ARKIV_ACCESS_KEY` is configured, and replaces the merged Vite city's fake paid translation state with typed BriefMint API calls. Browser writes remain a deliberate wallet action over a server-prepared public intent; direct public discovery reads Arkiv without the BriefMint API. These are locally compiled and tested integrations, not live chain evidence.

Migrations 002/003 add briefs, attempts, approval snapshots, publication intents and quota ledger without changing historical jobs/attempts/settlements or their immutability trigger. Migration versions are recorded transactionally and reopening is idempotent; an existing pre-version-table legacy database is tested. Standalone packaging includes SQL files.

Runtime/API changes: `brief-runtime.ts`, `brief-http.ts`, existing `runtime.ts`, auth purpose selection and all routes under `src/app/api/briefs` plus `src/app/api/briefmint/config`. New services: `briefs.ts`, `quota.ts`, `brief-runner.ts`, `brief-inference.ts`, `brief-publication.ts`. The integrated files are `apps/web/src/App.tsx`, `apps/web/src/lib/briefmint-api.ts`, Vite aliases/proxy configuration, and `src/lib/arkiv/briefmint/{schema,read,write}.ts`. New adapter tests validate that SDK-encoded canonical content and indexed fields agree before an Arkiv row reaches BriefMint state.

## Completion estimate for the entire PRD

**Approximately 67%**, up from 57%. This is an engineering estimate of delivered scope, not a percentage of passed end-to-end acceptance tests. It credits the API-wired city and SDK adapters only for local validation, and gives no credit for unperformed live integrations.

| Workstream | Share of full PRD | Credit at this checkpoint | Basis |
|---|---:|---:|---|
| Backend/API/data safety | 40 | 39 | Durable lifecycle, exact export/approval/publication contracts, runtime reader injection and adapter validation are locally proven; explicit external-change resolution remains limited |
| Existing city and frontend integration | 25 | 18 | The merged city calls the typed API, wallet sign-in, persisted polling, exact review/intent handling and direct reader; no browser wallet journey has yet been exercised |
| Real 0G/Arkiv and independent-reader proof | 20 | 0 | No authorized live inference or chain lifecycle evidence |
| Deployment, validation, docs and demo evidence | 15 | 10 | Root and Vite production builds, typechecks, lint, 101 server tests and local runbook pass; HTTPS hosting, browser journey, and submission evidence remain |
| Total | 100 | **67** | Full PRD remains incomplete |

## Verified checks

101 server tests; root/Vite typechecks; root lint; root/Vite production builds; local standalone HTTP smoke including real process restart; Git whitespace checks. Test doubles are explicitly local. One operator-run live provider request returned HTTP 502 with uncertain billing; there is still no successful inference and no second request. The legacy checkout example retains its nonfatal `use client` bundling warning.

The HTTP smoke verifies actual compiled route availability, authentication/query policy, private persistence, safe configuration, default private export, rejection of unapproved public export, owner-authenticated publication refresh, and fail-closed compilation. It restarts the real standalone Node process with the same temporary SQLite and session secret and proves the brief/session survive with zero dispatched attempts. It intentionally clears provider/quota environment variables so it cannot dispatch external inference. It does not test the absent Vite app or a production host.

## Remaining limitations

- Arkiv's named schema, reader and writer are installed, but are deliberately inert without `ARKIV_ACCESS_KEY`; reads and receipt reconciliation have no live Rabdi evidence. A browser writer requires the owner to configure a public endpoint key and explicitly sign.
- No assistant credential access or further inference. One operator-run request failed with HTTP 502 after 1,827 ms; actual debit is unknown. Private model availability, usable structured output, promotional-credit eligibility, successful latency/token cost and independent registered-signer verification are unproven. Unknown verification stays unavailable; see [the preflight record](0g-preflight.md).
- Original response bytes are stored privately for future verification. This does not establish a signature's validity or semantic correctness of generated text.
- Unknown broadcasts/reverted receipts conservatively remain pending because the current receipt DTO cannot prove a failed transaction attempted that exact intent. Re-prepare is blocked after uncertainty/submission, revision changes or settlement. There is no safe cancellation/replacement operation yet.
- External chain changes are detected and block overwrite; explicit resolution is not implemented. Expiry extension and reopening closed records are not supported. A proved expiry can be observed during publication preparation or explicit read-only refresh; there is no autonomous chain watcher. Historical reads are stale until a new successful observation, and unavailable reads preserve previous evidence.
- Direct public-reader code, indexed discovery and city integration are built but unproven against live Rabdi. Real browser writes, account-switching exercise, native expiry evidence, HTTPS persistent hosting, intended-user trial and submission artifacts remain unfinished.

## Exact next task

Run the Vite/Next cookie journey in a browser using [the local integration runbook](local-integration.md), then, only after separate authorization, resolve the 0G 502 and execute harmless 0G plus owner-signed Arkiv lifecycle gates. Record actual evidence and SDK/network compatibility before declaring the full PRD complete. None of these unproven steps can be completed by another backend unit test.

The user still controls account selection and live authorization. No push, merge, deployment or broadcast is part of this checkpoint.

## Part 1 — backend core and guarded live-probe readiness

6 November 2026, IST. Implementation commit: `1ebeeab`, based on clean `3e26a65` on `codex/payment-backend`. This note supersedes earlier descriptions of the city integration as uncommitted/absent; the history above is retained. Overall PRD estimate remains **67%**: this part closes safety/readiness defects without claiming new live or browser evidence.

Confirmed fixes: challenge redemption checks the current signed domain/URI after an origin change; provider credential echoes (including escaped strings/property names) cannot enter evidence/original storage; an explicitly mismatched returned model is rejected; HTTPS/timeout/output limits fail before dispatch when invalid. The real public config route now probes the configured Arkiv reader, with a five-second readiness deadline, instead of permanently reporting false. No frontend/shared DTO, migration or legacy payment code was changed.

The existing one-request smoke now preserves sanitized response identifiers on structured-response failure, reads bounded response bodies once to avoid clone-cancellation stalls, and explicitly reports promotional debit as `not_measured` with credit source `unverified`. [0G_LIVE_PROBE.md](0G_LIVE_PROBE.md) is the current operator command/interpretation contract. The public-only catalog preflight passed at 09:57:30 UTC / 15:27:30 IST: pinned `0gm-1.0-35b-a3b`, TeeML, one provider, 2,558 ms, **zero inference requests**. No key values or populated env file were accessed.

Targeted verification: **67 passed across six BriefMint test files** (`brief-auth-security`, `brief-execution`, `brief-http`, `brief-readiness`, `brief-smoke`, `briefs-contract`); **4 legacy auth/HTTP tests passed**, 14 unrelated legacy cases intentionally skipped by the name filter. Typecheck, ESLint on changed TypeScript files and `git diff --check` passed. All provider/chain behavior in tests is synthetic. Full server/contract/build/browser verification is deferred to Part 3 as requested.

| Acceptance | Part 1 status |
|---|---|
| BM-01 | Locally verified challenge/signature, distinct nonce, replay/expiry, concurrent redemption, current domain/URI, chain-purpose policy, session owner, secure cookies and origin checks. Legacy default remains isolated; BriefMint challenge uses 7794095. |
| BM-02 / BM-03 | Owner intake and strict bounds verified; quota/lease reservation is atomic. Per-wallet allowance counts **new briefs started** in a window; every retry/uncertain attempt counts against global dispatch allowance. No payment entitlement is introduced. |
| BM-04 / BM-05 | Private-only request contract, weaker/failed/mismatched response rejection, structured/source validation and honest evidence locally verified. **Live acceptance blocked**: no successful private completion or independent signature/content verification. |
| BM-06 | Concurrent claims, single active local lease, bounded attempts, timeout accounting/late-response rejection and expired-lease recovery locally verified. Provider work may continue remotely after timeout; local lease limits do not prove remote cancellation or exactly-once execution. |
| BM-07 / BM-08 | Immutable input/original output, revision checks, approval invalidation, canonical allowlist/hash and racing edit/export checks verified. Hostile notes remain private structurally; semantic owner review remains necessary. |
| BM-13 / BM-16 | Owner-scoped recovery/archive, restart persistence, no regeneration on read, labelled private export and approved public-only export locally verified. Production host/browser recovery remains a later gate. |

Exact 0G blocker: the earlier operator POST returned HTTP 502 / `PROVIDER_UNAVAILABLE` after 1,827 ms, with unknown debit and no preserved upstream identifiers. It has **not** been solved. Catalog availability does not prove private capacity, credential/credit eligibility, output quality or independent verification. Provider-side signature verification is documented by 0G, but the app/probe do not implement its chain/signature/content checks; report unavailable rather than unsupported or verified. A new potentially billable request needs new explicit user authorization. No wallet signature, Arkiv write, deployment or push occurred. **READY FOR PART 2.**
