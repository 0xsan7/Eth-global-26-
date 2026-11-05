# Tool City — Two-Person Build Plan

**For:** you + Codex, and your teammate + OpenCode.\
**Prepared:** 6 November 2026.\
**Scope authority:** [Final project brief](TOOL-CITY-FINAL-PROJECT.md). This document turns that approved scope into tasks; it does not add a new product direction.\
**Current state:** planning only. No app, model request, contract deployment or payment has been implemented or tested in this turn.

**Agent handoff pack:** both agents read [the common structure and integration contract](TOOL-CITY-COMMON-STRUCTURE.md). You additionally give Codex [your backend assignment](TOOL-CITY-YOUR-BACKEND-STRUCTURE.md); your teammate gives OpenCode [the frontend/Arkiv assignment](TOOL-CITY-TEAMMATE-FRONTEND-STRUCTURE.md). These files make the directory ownership, DTOs and merge process concrete; use their shared names when implementing this plan.

## 1. What we are building

A small isometric city where a creator buys one private translation of a short unpublished English draft into Hindi, reviews and corrects the translated segments, exports the result, and reopens the paid job later.

**One merchant. One translation service. One language pair. One fixed test-USDT price.** Confirm a Hindi reviewer and useful private-model output in the opening gate. The backend funds the 0G calls; customer payment does not automatically replenish 0G credits.

Your main ownership is **payments + server + 0G**. Your teammate's main ownership is **city + browser experience + Arkiv**. Both review and demo the complete flow. This split follows the work, not an assumption that either of you is already a specialist.

## 2. Exact feature checklist

Every item below is part of the finished MVP. The ordering is the build priority.

| ID | Feature | What the user sees / does | Main owner | Done when |
|---|---|---|---|---|
| F01 | Wallet connection and buyer login | Connect wallet, sign a clear login challenge; see required network | Teammate: browser; you: authentication | A nonce-bound session works; another wallet cannot read the buyer's jobs |
| F02 | Merchant-owned listing | Merchant publishes, changes description and withdraws the workshop | Teammate | Actual owner-signed Arkiv operations; fresh reader sees changes |
| F03 | Real workshop discovery | City loads workshop from Arkiv; displays owner, freshness and fixed checkout terms | Teammate; you validate new jobs | A real query drives availability; unsupported owner/service references cannot enable purchase |
| F04 | Short-text job creation | Paste 100–250 words; see English → Hindi and exact price | Teammate: form; you: endpoint | Server creates random job ID and saves buyer/input/terms before checkout |
| F05 | Stablecoin checkout | See allowance, approve required amount if needed, then buy the job | You: contract; teammate: wallet UI | Official-token purchase succeeds on Whitechain; contract is verified |
| F06 | Server payment verification | Pending → verified purchase; receipt opens in explorer | You | Actual chain state matches buyer/job/service/amount/payee/terms |
| F07 | Private translation | Workshop becomes busy; useful translated segments return | You | Real private 0G operation, bounded timeout, validated segment IDs and request reference |
| F08 | Source-aligned review | Original left, corresponding editable translation right | Teammate; you persist edits | Human can correct one segment without overwriting saved model output |
| F09 | Buyer exports | Download translation TXT and structured JSON | Teammate | Current edited text exports correctly; receipt fields are labelled |
| F10 | Paid-job archive and recovery | Open My Jobs, refresh/reopen; retry eligible failure without another checkout | You: durable state; teammate: archive | Saved results survive restart; unauthorized access and duplicate execution are refused |
| F11 | City with real job states | Click buildings; worker moves according to purchase/execution/result state | Teammate | No timer can manufacture a successful result |
| F12 | Merchant settlement view | Merchant sees its purchase records and downloads a small CSV | You: data/export; teammate: screen | Listing ownership alone cannot expose buyer drafts; CSV matches verified settlement |
| F13 | Reusable checkout | Separate tiny example app embeds `ToolCityPay` | Teammate: component/example; you: ABI/server agreement | It uses the same real purchase flow without copying the whole city |
| F14 | Evidence and failure states | View listing reference, receipt, request ID and accurately labelled verification status | Shared | Wallet rejection, RPC failure, private-provider failure and recovery are understandable |
| F15 | Public demo and submission | Live app, reproducible repo, sponsor documents, video | You: deployment/payment/0G docs; teammate: Arkiv docs/video | Judge can try the real flow and follow the evidence |

Do not add audio, file upload, SRT, gasless relaying, 0G Storage, iAI login, multiple paid merchants, price editing, subscriptions, refunds, autonomous spending or more languages. The city is required; a game engine is not.

## 3. How we get the Claude City-like interface

The relevant inspiration is [mittal-parth/claude-clan](https://github.com/mittal-parth/claude-clan): an isometric world that makes real work spatial and inspectable. We borrow that interaction principle. Our world represents service discovery, purchases and translation jobs.

### Visual direction: a small workshop neighbourhood

- Warm stone paving, muted green ground, terracotta roofs and one teal-accented Translation Studio.
- Five substantial buildings, one worker carrying a document, connecting streets, a few trees, benches and lamps. Decorative props perform no fake business actions.
- A compact header: Tool City, wallet status, My Jobs and Merchant.
- City occupies roughly two-thirds of a desktop screen. A right detail panel handles the selected building and current action. On narrow screens the panel moves below the map.
- Building nameplates, clear hover/focus selection, simple roof/window state changes, and readable text status. Keep instructions and errors in HTML rather than tiny text painted into the map.
- Translation review can expand across the page for legibility, with a Back to City action. Users should not edit long text inside miniature speech bubbles.

### Where everything lives

```text
                      Registry Hall
                    public workshop data

        Creator's Home                 Translation Studio
        draft + review                 actual 0G operation

                   street / document worker

          Treasury                       Archive
          approve + purchase             paid jobs + results

         [right panel: selected building / current action]
```

Five buildings plus the worker are the six functional scene objects. There is only one executable AI workshop; Registry, Treasury and Archive are views of supporting systems, not extra paid services.

| Object | On click | Visible state |
|---|---|---|
| Registry Hall | Listing, entity owner/key, last successful refresh; merchant management if authorized | Fresh, stale or unavailable |
| Creator's Home | Draft form; later source/translation review | Draft prepared or review available |
| Treasury | Reusable checkout, exact terms and purchase receipt | Signature needed, confirming or payment verified |
| Translation Studio | Current job progress and inference evidence | Idle, running, ready or interrupted |
| Archive | Authenticated buyer's jobs; open/export saved result | Existing job records |
| Worker | Opens current job details | Carries the same job through these states |

### Rendering decision

**React + an SVG city + HTML controls + CSS transitions.** SVG polygons make the roof and two shaded walls of each reusable isometric building. One small character can also be an original vector drawing. No game engine, physics, Three.js or pathfinding.

1. Define five building positions in a small scene configuration.
2. Build one reusable `IsoBuilding` with roof, left wall, right wall, door, windows and a text nameplate. Vary dimensions and details for each building.
3. Draw one ground tile and two or three streets. Render objects in back-to-front order so buildings overlap naturally.
4. Give each building an accessible HTML button/label over its location. Offer the same building navigation as ordinary text buttons for keyboard and small-screen use.
5. Move `Worker` between a few predefined waypoints with one short CSS transition. Use a fixed-duration transition to reach the destination, then wait there for actual state changes.
6. Use a pure `jobStateToScene` mapping. Changing a job state changes the destination, building activity and panel text. It never marks the job successful.

If a request completes before the walk ends, show the result immediately; animation must not delay access. Respect reduced-motion preferences. Start with original simple vectors so visual work does not depend on buying assets or generating a large sprite set.

### The actual animation sequence

| Confirmed application state | Worker and city reaction |
|---|---|
| Draft | Worker at Home; Studio idle |
| Awaiting purchase | Worker goes to Treasury and waits |
| Payment submitted | Treasury says Confirming; no inference animation yet |
| Purchase verified | Worker carries the document to Studio |
| Inference running | Studio windows show activity; label says Translating |
| Result saved | Worker returns to Home with the result; Archive gains the job |
| Paid inference interrupted | Studio shows Interrupted; worker waits; Retry appears only when eligible |
| Reopen | Load the saved result; do not replay checkout or pretend a new model operation occurred |

The planning preview uses simulated states only. Production must remove preview controls and connect this mapping to real job responses. A development fixture must never appear as a live sponsor integration.

## 4. Work split and file ownership

### You + Codex: payment and execution path

Own the full server lifecycle so payment verification and job authorization cannot drift between two agents.

1. Bootstrap the repository, dependency lockfile, shared types and configuration.
2. Implement wallet authentication, authorization, SQLite schema and job APIs.
3. Write, meaningfully test, deploy and verify the single fixed-service checkout contract.
4. Verify purchases server-side; expose safe receipt and merchant settlement data.
5. Integrate 0G private translation, segment validation, bounded attempts, timeouts and durable recovery.
6. Persist review edits; serve authenticated job data and merchant CSV export.
7. Deploy the Node application with persistent disk and configure server secrets.
8. Write contract/0G/architecture/setup documentation and `WHITECHAIN_FEEDBACK.md` from actual experience.

**Owned paths:** `contracts/`, `src/app/api/`, `src/lib/server/`, deployment configuration, and the initial `src/lib/shared/`. You own the root package and lockfile. Share a compiled ABI and deployment manifest early.

### Teammate + OpenCode: city and catalogue experience

Own the browser journey from a visible workshop to a useful review screen.

1. Create the city scene, building components, worker, responsive layout and interaction panels.
2. Implement browser wallet connection and chain-switch prompts using agreed configuration.
3. Implement Arkiv publication, owner updates, withdrawal, query adapter and freshness handling.
4. Build draft form, review editor, TXT/JSON export and My Jobs screen.
5. Build `ToolCityPay`, allowance/approval/purchase UI and the separate embed example using your deployed ABI.
6. Build the merchant console, settlement table, download action and evidence drawer.
7. Connect the UI to the shared API; replace development fixtures with actual data before integration signoff.
8. Write Arkiv schema/criterion files, gather a non-builder's feedback, and own the video edit/recording checklist.

**Owned paths:** non-API pages under `src/app/`, `src/components/`, `src/lib/client/`, `src/lib/arkiv/`, `public/`, `examples/checkout-demo/` and `/arkiv/` documentation.

**Shared review:** payment/result authorization, interrupted jobs, persistent-host restart, final demonstration and submission. During the plain-slice phase, your teammate starts with working forms and Arkiv instead of spending the whole morning on art. Both review the successful slice before the detailed city work.

### Avoid merge and agent conflicts

- Work in separate clones/branches: `codex/payment-backend` and `codex/city-frontend`. Merge small completed changes at agreed checkpoints.
- Do not let either coding agent rewrite the other owner's directory as an incidental cleanup.
- Only you change dependencies/lockfile; teammate requests additions. Pin the versions actually validated, not guessed versions from an old plan.
- Freeze shared API/types after the opening gate. Changing a field requires updating the shared contract and notifying the other person first.
- Exchange deployment address, ABI, service ID, merchant address, token/decimals/amount and terms reference in a committed public manifest. Share credentials separately through the host's secret settings; never commit them.
- Commit real incremental work. Do not generate artificial commit history to satisfy a sponsor requirement.

## 5. The handshake that lets you work in parallel

Agree on these interfaces before writing separate implementations. They are proposed contracts, not existing endpoints.

### Shared records

`WorkshopView`: entity key, system owner, title, description, active state, language pair, expiry information when supported, last successful fetch time, freshness, checkout reference and supported-service validation.

`CheckoutTerms`: chain ID, checkout address, official token address, token decimals, integer amount encoded as a string, merchant, service ID and terms reference. Browser display values are derived from these terms; client values never authorize server execution.

`JobView`: random job ID, authenticated buyer, workshop/service reference, immutable source segments, status, saved terms, purchase reference, original model segments, edited segments, attempt count, retry eligibility and sanitized evidence/error fields. Never include credentials.

`JobStatus`: `awaiting_payment`, `payment_pending`, `paid`, `running`, `ready`, `interrupted`, `failed`. The unsubmitted draft is local UI state. `retryEligible` is a server decision; interrupted/failed jobs retain their paid entitlement when payment succeeded.

### API responsibilities

| Endpoint | Owner / purpose | Required behavior |
|---|---|---|
| `GET /api/auth/challenge` | You: issue nonce and signed-message parameters | Domain/origin binding, expiration, one use |
| `POST /api/auth/verify` | You: verify wallet signature and create session | Secure session; do not confuse login with payment |
| `POST /api/auth/logout` | You: end session | Wallet account change clears buyer context |
| `POST /api/jobs` | You: bind draft, buyer, supported workshop and fixed terms | Validate live listing/owner/service before creating a purchasable new job |
| `GET /api/jobs` | You: buyer's job list | Only authenticated buyer's records |
| `GET /api/jobs/:id` | You: current job and saved result | Buyer authorization on every read |
| `POST /api/jobs/:id/verify-payment` | You: accept transaction reference and verify chain state | Idempotent; pending response is not success; reject mismatched entitlement |
| `POST /api/jobs/:id/run` | You: execute or authorized bounded retry | Require paid state; lock execution; never charge the buyer again |
| `PATCH /api/jobs/:id/edits` | You: save buyer's reviewed segments | Retain original model output separately |
| `GET /api/merchant/purchases` | You: authenticated merchant settlement data | Return verified purchase fields, never buyer drafts/results |
| `GET /api/merchant/purchases.csv` | You: settlement export | Same merchant authorization |

Arkiv's browser writes go directly through the merchant wallet. Teammate supplies a read-only query adapter usable by both UI and server; the server independently validates listing ownership for new jobs rather than trusting a browser-provided owner.

One bounded inference request runs in the persistent Node server, with a durable execution lock and timeout. Avoid detached promises or introducing a queue service. Configure the hosting/request timeout to accommodate the measured inference time. UI may poll job status while the request runs; a reload returns the saved job. Detect abandoned execution on restart or expired lock and permit the bounded recovery path. An uncertain provider attempt is not an exactly-once guarantee.

Frontend polls approximately every two seconds only while a job is active, stops at a terminal state, and refreshes on reopening. Payment verification can return pending and be safely retried with backoff. Never rerun inference merely because a component mounted.

### One shared development fixture

Create one fixture covering awaiting payment, running, ready and interrupted states so the city can be built while the server is unfinished. Give it an obvious development-only badge and environment switch. Do not make separate agents invent different fake shapes. Paid execution on the real deployment cannot be unlocked by this fixture.

## 6. Build sequence and joint checkpoints

Use elapsed times from when both of you start. At preparation time the official deadline is **7 November, 09:00 IST**, leaving roughly 29 hours. If starting later, protect the submission window and reduce polish; do not assume these estimates are guaranteed. [Official event instructions](https://ethglobal.com/events/mumbai/info/details)

| Stage | You + Codex | Teammate + OpenCode | Joint acceptance gate |
|---|---|---|---|
| First 90 minutes | Get actual private translation samples; verify Whitechain funding/token/tooling; bootstrap shared types | Get actual Arkiv owner-signed write/read/update; confirm language reviewer; browser shell | All three integrations have a credible path; useful translation demonstrated; types agreed |
| Next 4–5 hours | Contract, authentication, durable jobs, payment verification and real inference | Arkiv owner console, basic draft/checkout/review screens using agreed ABI/types | One real buyer pays and gets a useful saved result in a plain UI |
| Next 1 hour | Fix API/authorization integration issues | Fix wallet/network/UI integration issues | Refresh and reopen work; unpaid and wrong-buyer access fail |
| Next 3–4 hours | Retry/interrupt handling, edits persistence, merchant settlement endpoints | Finish city, state mapping, editor/export, checkout embed and merchant screens | Complete city journey with real data; separate embed works |
| Next 2 hours | Deploy persistent Node host, restart/recovery and contract checks | Responsive/reduced-motion check, Arkiv withdrawal and freshness, non-builder trial | Public deployment and negative cases pass |
| Rest + stabilization | Reserve a meaningful shared rest block; return for a final live-flow check | Same | No new product scope after restart |
| Protected final 4 hours | README/evidence/payment/0G documents, final technical check | Arkiv documents, recording/editing, demo review | Submission uploaded and checked before the deadline |

Allow roughly **16–19 productive hours including integration and stabilization**, plus documentation/recording, rest and contingency. The workload has real dependency risk; the first paid slice is the main milestone, not a promised completion time.

Hard checkpoints: freeze features by approximately **01:00 IST on 7 November**; aim to finish recording by **05:00** and submit by **07:00**, retaining two hours before the deadline. If the paid slice is still broken after about eight working hours, both builders stop decorative work and fix it. If an integration cannot be made real, do not claim its sponsor track.

## 7. Meaningful validation, divided between you

| Check | Driver | Expected result |
|---|---|---|
| Correct official-token purchase | You | Receipt and contract state agree; merchant receives the configured amount |
| Wrong terms, duplicate purchase, copied job ID from another buyer | You | Wrong terms/duplicate reject; another buyer cannot block the intended buyer's entitlement |
| Unpaid run and wrong-buyer access | You | Denied without inference or private data exposure |
| Concurrent run requests | You | One lock wins; no parallel duplicate provider calls |
| Private provider failure, one retry, process restart | You | Paid entitlement persists; saved result recovers or unresolved state is honest |
| Owner update, wrong-wallet update and withdrawal | Teammate | Genuine ownership enforced; fresh city reflects listing changes |
| Arkiv refresh failure | Teammate | Label stale/unavailable; do not invent successful refresh or closure |
| Wallet rejection/account or chain change | Teammate | Clear recovery; previous account's private UI clears |
| Names, dates, numbers, URL and meaning in five drafts | Both + reviewer | Useful translation; structure checks alone do not count as quality |
| Edit/export/reopen and settlement CSV | Teammate, you review data | Correct buyer output; original model version retained; settlements reconcile |
| Tiny checkout example + public demo | Both | Same deployed purchase flow, real evidence, no development fixture enabled |

## 8. Submission and explanation ownership

| Deliverable | Owner |
|---|---|
| Setup, architecture, configuration, limitations, AI attribution | You, teammate reviews |
| Verified contract/address, official-token explorer receipt, onchain rationale, `WHITECHAIN_FEEDBACK.md` | You |
| Actual 0G request evidence, private-tier explanation, repeat-use rationale | You |
| `/arkiv/schema.md`, `friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`; writer address and runnable query | Teammate |
| Original visual assets and licence/attribution notes | Teammate |
| Non-builder trial and truthful feedback | Teammate, both observe if possible |
| Approximately 2:40 demo, live URL and submission form | Teammate assembles; both verify; you submit |

These map to [Arkiv's current requirements](https://ethglobal.com/events/mumbai/prizes/arkiv), [Whitechain Operate](https://ethglobal.com/events/mumbai/prizes/whitechain) and [0G Private Computer](https://ethglobal.com/events/mumbai/prizes/0g). Qualification remains dependent on what actually works and the published rules.

You should be able to explain purchase verification, authorization and private inference. Your teammate should explain owner-controlled discovery and the city-state mapping. Both should explain the whole user journey in a minute, including the limitation that the backend sees the input and paid inference can fail without automatic refunds.

## 9. Ready-to-paste agent assignments

### Your Codex assignment

> Read TOOL-CITY-FINAL-PROJECT.md and TOOL-CITY-BUILD-PLAN.md. Own contracts, server APIs, authentication, durable jobs, Whitechain verification, 0G translation and persistent deployment. First prove a real private translation and Whitechain prerequisites; then implement a paid vertical slice with meaningful authorization/recovery checks. Establish shared types and deployment manifest before frontend integration. Stay within your owned directories and approved scope. Never treat browser payment claims as authority, expose secrets/private drafts, silently downgrade privacy, or fabricate successful integrations. Coordinate interface changes with the frontend owner. Report actual verification results and blockers.

### Teammate's OpenCode assignment

> Read TOOL-CITY-FINAL-PROJECT.md and TOOL-CITY-BUILD-PLAN.md. Own browser UI, React/SVG city, Arkiv owner-signed listing/query/update/withdrawal, review/export, wallet checkout component and separate embed example. First prove a real Arkiv write/read and build working plain screens against the shared types; polish the city only after the paid slice works. Follow the shared API and deployment manifest. Keep development fixtures clearly marked and disabled in the public demo. Every city state must reflect actual records or backend job status. Do not modify server/contract files or dependency lockfiles without coordination. Include Arkiv documentation and actual user feedback.

**First action when implementation starts:** open both briefs together, agree on ownership and types, then run the three integration checks. Do not begin with a full day of city art.
