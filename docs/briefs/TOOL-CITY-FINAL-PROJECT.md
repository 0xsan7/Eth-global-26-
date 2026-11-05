# Tool City — Final Project Decision and Build Brief

**For:** our two-person ETHGlobal Mumbai team.\
**Decision date:** 6 November 2026, approximately 03:50 IST.\
**Status:** final recommended scope, not a built or validated application. This review has not executed inference, deployed contracts, submitted payments or established prize eligibility.\
**Authority:** this brief supersedes the earlier Tool City proposals, including the voice/gasless proposal.

**Implementation plan:** [Tool City — Two-Person Build Plan](TOOL-CITY-BUILD-PLAN.md) defines the feature checklist, city design, file ownership, shared APIs and delivery checkpoints for this scope.

## 1. The decision

**Build the original short-text translation workflow, with the newer plan's clearer verification, durable recovery and state-driven city.**

One active merchant, one translation service, one supported language pair, one fixed price, one private inference operation per normal job. Use Arkiv for the merchant-owned listing, Whitechain for the purchased job entitlement, and 0G for the actual translation. Keep the Claude City-style neighbourhood.

Do not add voice, gasless checkout, Storage, multiple paid merchants, dynamic pricing or autonomous payments during this hackathon. These are excluded from this build, rather than promised extras to reconsider near the deadline.

This is a **moderate integration project**. The difficult part is making a real purchase lead to a private, buyer-bound, recoverable result across three services. It is not a new payment protocol or a full marketplace.

## 2. What changed from the initial plan, and what we keep

Some features described as improvements in the new proposal were already in the original: owner-controlled listings, contract payment verification, private routing, segment review, recovery, and an embedded checkout. The new proposal makes several of those requirements more concrete; they are not all new scope.

| Area | Original translation plan | New prototype proposal | Final decision and assessment |
|---|---|---|---|
| User task | Translate a short unpublished draft | Transcribe a private recording, then translate it | **Keep text.** Voice is a plausible later product, but changes the problem and adds upload, ASR and timing dependencies. |
| Model pipeline | One translation operation | Whisper followed by a chat-model operation | **Keep one call.** Voice still needs the translation model, so it does not remove the original quality risk. |
| Review/export | Corresponding source/translation segments; text/JSON | Timed transcript, translation, SRT and manifest | **Keep aligned text, editing, TXT/JSON.** SRT requires reliable timestamps that have not been demonstrated. |
| Payment | Normal approval and contract purchase | Normal checkout plus proposed EIP-3009 gasless path | **Keep ordinary checkout.** The gasless design is additional security and operational work. |
| Whitechain target | Operate | Introduction pushes Scale; later sections park gasless | **Choose Operate.** Remove the contradictory Scale commitment. |
| Provider scope | One executable merchant/service | Three providers and publish/edit-price/withdraw | **One executable merchant.** Demonstrate real ownership and withdrawal; do not build multi-merchant registration. |
| Arkiv ownership | Provider signs its record | Stronger console and wrong-wallet demonstration | **Keep.** This makes the registry's trust boundary visible. |
| Arkiv reads | Query the real catalogue | Live reads, explicitly no cache | **Real reads plus refresh and labelled stale state.** A network failure must not masquerade as a closed workshop. |
| Pricing | Fixed authoritative checkout terms | Editable listing prices; service-update tests | **Freeze price/payee/terms in the contract.** No price editor or missing update methods to implement. |
| Recovery | Durable paid jobs | Explicit SQLite records, attempts and events | **Keep the clearer design.** It directly prevents lost purchases and confusing retries. |
| Storage | Private durable backend; Storage optional | Storage appears in architecture but is later parked | **Cut Storage for this event.** Export is sufficient; another network does not establish execution provenance. |
| City | Small SVG/HTML scene | Six state-driven objects, no game engine | **Keep the tighter rendering scope.** The city remains a core feature. |
| Deployment | Small app/backend | Persistent Node host plus Vercel front tier | **One Node deployment with persistent disk.** Avoid separate deployments and cross-origin sessions. |
| Checkout embed | Required small reusable integration | More explicit component and demo | **Keep.** This supports the merchant-payment submission. |
| Evidence/failure tests | Required but broad | Named negative cases and receipt panel | **Keep, correcting the tests and code assumptions below.** |
| Prize strategy | Three prospective sponsor fits | Numerical odds and assumed competitor counts | **Delete the probabilities.** They cannot support track selection or a winning prediction. |

**Overall:** the new plan improves operational detail but adds too much product and payment scope. The best final version combines the original task with the newer reliability work.

## 3. The problem and the actual product

**Problem statement:** A wallet-equipped creator or community organizer occasionally needs a short unpublished announcement translated. They want to buy one bounded task, compare the result with the original, correct it, and recover the purchased result later without buying it again or taking a subscription.

The MVP addresses that complete workflow. It does not establish that existing translators are inadequate, that creators will pay us, or that a blockchain is needed to translate text. Interview one nearby creator and observe a real use attempt; document what they found useful and what they would not pay for.

**Pitch:**

> Tool City is a small city of wallet-owned AI workshops. A creator buys one private translation job, watches the real job move through the city, reviews the result beside the source, and reopens the saved purchase later. Arkiv discovers the workshop, Whitechain records the purchase, and 0G performs the translation.

### Exact MVP boundaries

- **Input:** pasted plain text, approximately 100–250 words. No uploads or microphone permission.
- **Language pair:** English → Hindi for the initial implementation, provided a teammate or nearby reviewer can assess it. Confirm that reviewer during the first gate; do not claim quality for a language nobody can judge.
- **Output:** deterministic source segment IDs and corresponding translated text. Render the saved source, not a model's reconstruction of it.
- **Review:** edit a translation segment and export TXT plus JSON. Label human edits separately from the saved model output.
- **Price:** one nominal fixed test-USDT amount, initially 1 test USDT. Verify token decimals before calculating its integer amount. This is a demo price, not a validated business margin.
- **Merchant:** one real wallet publishes and controls the executable workshop. Describe team-controlled wallets as team wallets. No invented independent providers or users.
- **Recovery:** the authenticated buyer can reopen a saved result or retry an unresolved paid job within the app's bounded retry policy. No second purchase for that job.

The translation workflow is the product; the city is the visual explanation of its real operations.

## 4. Why the three sponsors belong

| Sponsor and target | Necessary capability in this product | What the demo proves | Honest limitation |
|---|---|---|---|
| **Arkiv — Build on Arkiv (from scratch)** | Public discovery of wallet-owned workshop records that another reader can query | Merchant signs publication/update; buyer's fresh query reflects it; another wallet cannot edit it | One merchant demonstrates ownership, not marketplace demand. Another appropriate public registry could substitute. |
| **Whitechain — Operate · Stablecoin Payments for Business** | Inspectable stablecoin settlement and a buyer/job-specific entitlement | Official-token purchase, verified contract, reusable checkout, merchant/buyer receipt views and settlement export | Another compatible chain could host equivalent logic. The payer needs testnet gas. |
| **0G — Build with 0G Private Computer** | The purchased translation is actually executed through explicitly private inference | Useful returned translation, request reference and accurately labelled Router verification metadata | The app backend sees the draft. Model quality and private-provider availability remain untested. |

The exact companies are not technically irreplaceable. The required properties are provider-controlled public discovery, inspectable purchase authorization and the selected private inference boundary. Removing one integration removes one of those implemented properties or requires a replacement.

For Whitechain, the justification is a wallet-native service purchase that can be independently checked without relying on a payment processor's private order database. A conventional payment rail could support a similar translation business; it does not supply this same public contract entitlement as implemented here.

These are **prospective track fits**, not guaranteed qualification or awards. The published pages are the authority: [Arkiv](https://ethglobal.com/events/mumbai/prizes/arkiv), [Whitechain](https://ethglobal.com/events/mumbai/prizes/whitechain), [0G](https://ethglobal.com/events/mumbai/prizes/0g). Ask the available 0G mentor whether this specific reviewed-translation experience meets their consumer-product bar; a bare prompt box would be weak.

## 5. The complete journey

1. The merchant connects on Arkiv Rabdi and publishes the workshop, including its service and checkout references. The wallet signs the write.
2. The customer opens the city. A real Arkiv query populates the workshop; the app reconciles its owner and service references with the configured checkout.
3. The buyer authenticates by signing a nonce-bound, expiring application challenge. Payment transactions and login signatures are distinct actions.
4. The buyer pastes a draft. The backend creates a random job ID, saves the buyer/input/service binding privately, and returns the exact checkout terms.
5. On Whitechain Sepolia, the buyer approves only the required token allowance when needed, then purchases the job through the checkout contract.
6. The server verifies a successful receipt from the configured network/contract and reads the matching purchase state. Browser-supplied `paid: true` is never authority.
7. The server acquires a job execution lock, calls the validated private 0G configuration, validates segment structure, and saves output and request evidence durably.
8. The parcel appears only after the result has been saved. The buyer reviews, edits and exports it.
9. Refreshing or reopening returns the same authorized job. A merchant can withdraw the listing from new discovery without deleting existing purchases or saved outputs.

## 6. Implementation scope and invariants

### One application and one durable store

Use one Next.js application on a Node host with a persistent disk. React/SVG renders the city; server routes handle authentication, quote/job creation, verification, inference and retrieval. SQLite stores private job state and results. Keep credentials on the server and exclude drafts/results from request logs. No ORM, Redis, microservices or separate Vercel deployment is required.

Keep the app process running for the demo. On startup, detect abandoned running attempts and mark them interrupted; allow an authorized retry. This is a small durable job runner, not a guarantee of exactly-once external inference. A crash after a provider accepted a request may leave uncertainty and incur another compute charge on retry.

Minimum private records: jobs, original segments, model output, edited output, payment references and execution attempts. Store the accepted buyer/service/price/terms with the job. Do not publish raw text, translations or content fingerprints on Arkiv or another public network.

### Arkiv: discovery with real ownership

Use Rabdi, chain ID **7794095**, and current official examples. Reuse the connected wallet's transport in a wagmi app. [Official React guide](https://docs.arkiv.network/guides/react/)

Publish only public service information: application namespace, title, job type, language pair, active flag, checkout chain/address, service ID and displayed terms reference. Derive ownership from the entity's system owner, not a self-declared `provider` string. A schema tag alone is not provenance; other wallets can publish with that tag. Validate supported contract/service references and merchant ownership before enabling purchase.

Query by namespace, supported job type and active status; expose the query in the evidence panel. Refresh after writes and on focus. Label cached records stale when refresh fails. A missing record is unavailable; do not pretend absence proves whether it expired, was deleted or suffered a read error. Use explicit `active=false` for the withdrawal demonstration.

No editable financial terms in this MVP. The owner may change descriptive copy or withdraw discovery. Existing paid jobs use their saved context. Direct contract purchases may remain possible after catalogue withdrawal; this is not a global onchain pause.

### Whitechain: small contract, bounded authorization

Use Whitechain Sepolia **1874** and official test USDT **`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`**. Deploy and verify one checkout contract using official EVM tooling. [Deployment guide](https://docs.whitechain.io/build/deploy/deploy-with-hardhat)

Contract requirements, rather than the attachment's unvalidated implementation:

- Fixed token, merchant, service ID, amount and terms reference configured at deployment. No public numerical-ID registration or price-management subsystem.
- `purchase` checks the expected amount and terms reference before transfer, binds the caller as buyer, and atomically records the successful entitlement and transfers tokens using established safe token handling.
- Uniqueness is scoped to **buyer + job ID**. Another wallet must not be able to reserve the buyer's job ID by copying it from a pending transaction.
- Record buyer, job ID, service, amount, payee and terms reference; emit a matching event. Reusing that buyer/job purchase reverts.
- No draft text or guessable plain-text hash onchain. The backend privately binds the random job ID to the submitted input.

Server verification checks the configured chain/token/checkout, receipt success, accepted confirmation policy, buyer, job, service, merchant, amount and terms. Reconcile the emitted settlement with contract purchase state. A transaction hash is evidence to verify, not a password.

Build reusable `<ToolCityPay/>` and a tiny **separate demo application** under `examples/checkout-demo` that embeds it in roughly 20 lines. It can share repository/hosting resources. Include a merchant view listing purchases and a simple CSV settlement export; no analytics dashboard.

### 0G: one useful private operation

Start by testing the previously advertised private chat-model ID `0gm-1.0-35b-a3b`; re-check current support with the mentor and a real request. Catalogue metadata is not an inference success or a translation benchmark.

Explicitly select private routing and request the supported verification metadata. Fail visibly when required private capacity is unavailable; do not silently route to a weaker tier. Keep response handling simple and non-streaming unless actual latency makes streaming necessary. [Privacy behavior](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/privacy)

Require every source segment ID exactly once and reject unknown/missing IDs. That verifies structure, not meaning. Save the request ID, actual reported model/tier and verification fields. Label `tee_verified` as **Router-reported verification**, not our independent proof of model execution or correct translation. [Verification trust model](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution)

Five harmless sample drafts must pass a human review for meaning, names, numbers, dates, URLs and acceptable wait. No latency promise or profit margin is established yet.

## 7. The city we actually build

One isometric block, six objects, one reusable worker, predefined paths and one detail panel. Use an original visual treatment inspired by the city metaphor. Avoid a game engine, free roaming, custom pathfinding and a large asset pipeline.

| Object | What drives it |
|---|---|
| Creator's home | Saved input, authenticated buyer and review screen |
| Registry Hall | Real Arkiv query; fresh/stale/unavailable indicator |
| Translation Studio | The actual supported merchant listing and processing status |
| Treasury | Approval, pending transaction and verified purchase |
| Worker / parcel | Queued → running → saved result; unresolved on failure |
| Receipt Archive | Authorized recovery, purchase evidence and exports |

Expose text status beside animation, support reduced motion, and keep the evidence drawer readable. A worker walking is a visualization, not evidence of an autonomous agent.

State model: `draft → awaiting_payment → payment_pending → paid → running → ready`. Separate failure/interrupt states retain the paid entitlement. Reopening is an action, not a new charge. Use execution locks to prevent two simultaneous calls. Allow one user-triggered retry after a retriable failure; further failures remain unresolved for merchant support.

Do not claim successful payment guarantees successful inference. Automatic refunds are excluded from this prototype; show that limitation before checkout and use only test tokens. Refunds are permitted by the Whitechain track, simply outside our selected scope.

## 8. Corrections to the new attachment before implementation

1. **The gasless wrapper is unsafe as proposed.** A transfer authorization can be submitted directly to the token, moving funds without invoking the wrapper that records the purchase. ERC-3009 explicitly discusses this wrapper-bypass risk. Backend relayer checks do not remove it. Exclude this path; a later gasless design needs separate security work. [ERC-3009 security considerations](https://eips.ethereum.org/EIPS/eip-3009#security-considerations)
2. **The pasted contract is not ready to deploy.** Its authorization function declares both a signature parameter `s` and a local `Service memory s`. Its test list also references `setPrice` and `setActive` that are absent from the supplied contract. These are static review findings; no compiler or contract tests were run here.
3. **ABI/domain reads do not demonstrate gasless settlement.** Even if the token exposes the expected interface, a genuine successful purchase and entitlement are separate proof obligations.
4. **A mutable-price checkout needs a pre-transfer expected-terms check.** Detecting a mismatch in the backend after payment is too late. This final MVP removes dynamic pricing and still checks expected terms.
5. **Speech assumptions remain unproven.** An advertised token limit does not establish a 2.5-minute audio cap, required silence chunking, timestamp response shape or expected latency. Voice is deferred rather than built on those assumptions.
6. **Metadata storage is not execution authentication.** Uploading hashes, model names and request IDs does not by itself prove which model processed which content. Storage is not required by our selected 0G track.
7. **The odds are not measured probabilities.** Assumed competitor counts, uniform ranks and an arbitrary correlation adjustment do not establish our chances or which Mumbai lanes are most crowded. Do not repeat the one-in-three claim.
8. **Other submission claims need correction.** iAI and USDT are not expressly mutually exclusive in the published rules; iAI is excluded for scope. A 2:40 video is a convenient choice, not the only valid duration. `reach.md` should discuss users, actual use and future availability, not just SDK operations. Wallet rejection or preflight failure may produce no explorer transaction.

## 9. Build order and stop rules

At approximately 03:50 IST on 6 November, about **29 hours** remain until the **7 November, 09:00 IST** deadline. The estimate below is conditional planning, not demonstrated implementation speed. Reserve sleep/rest and at least four hours for evidence, recording and submission. [Official event instructions](https://ethglobal.com/events/mumbai/info/details)

| Phase | Time budget | Required outcome |
|---|---|---|
| Integration/quality gate | First 90 minutes | Actual private translation and usable output; actual Arkiv wallet write/read; Whitechain funding, official token and tooling access confirmed |
| Plain vertical slice | Next 5–6 hours | Contract deployed/verified; official-token purchase authorizes a real saved result; buyer authentication and reopen work |
| City and merchant experience | Next 4–5 hours | State-driven neighbourhood; publish/edit-description/withdraw; review/export; checkout embed and merchant CSV |
| Hardening and deployment | Next 3–4 hours | Persistent-host restart/recovery and meaningful negative checks pass |
| Evidence and submission | Protected final 4 hours | Repo/docs/evidence complete, video recorded and submission verified |

Target roughly **14–17 hours of implementation**, plus the protected submission window. Two unfamiliar wallet/network integrations can overrun this estimate. Divide work after the gate: one builder owns contract/checkout/chain verification/embed; the other owns Arkiv, city and review UI. Agree on job/payment API shapes together; implement the shared server runner before polishing the scene.

**Stop rules:**

- If private translation is not useful or accessible, get a mentor-supported private configuration before building around it. Do not pivot automatically to a larger speech pipeline or fake a successful response.
- If the full paid slice is not working after the first approximately eight hours, stop decorative polish and fix the slice. Do not add another track or subsystem.
- If a sponsor remains nonfunctional, remove that prize claim and document the actual missing capability. Never substitute a local mock and call it integrated.
- Freeze features before the evidence window. No late gasless or Storage experiment.

## 10. What counts as finished

- Merchant wallet publishes and edits its real listing; wrong-wallet edit fails; a fresh reader sees withdrawal. Record whether failures occurred before or after broadcast.
- Official-token checkout settles and the contract is verified. Wrong service/terms and duplicate purchase fail without charging.
- Unpaid execution and another buyer's result access are refused. Repeating a legitimate verification/reopen request returns existing state rather than incorrectly rejecting normal recovery as a replay.
- A real private inference produces a useful aligned translation. Editing/export works and evidence fields are honest.
- Refresh after payment and restart of the persistent app preserve the paid job. A simulated provider failure remains paid/unresolved and permits the bounded retry without another checkout.
- A tiny separate application embeds the checkout. Merchant and customer views, explorer links and settlement CSV work.
- At least one non-builder tries the workflow; report their actual feedback, without invented usage figures.

### Submission pack

Public repository with incremental progress, setup, architecture, limitations, license and clear AI/tool attribution. Include the planning/specification artifact as part of the disclosed workflow.

Arkiv: writer addresses, runnable query, `/arkiv/schema.md`, `friction.md`, `reach.md`, `why-arkiv.md` and `how-you-use-arkiv.md`, answering the actual judging questions. Whitechain: verified deployment, official-token settlement link, rationale, `WHITECHAIN_FEEDBACK.md` and both-party demo. 0G: actual main-flow request IDs, a working app, repeat-use rationale, team contacts and relevant addresses. Recheck all linked [partner requirements](https://ethglobal.com/events/mumbai/prizes) at submission.

Aim for a **2:40 video**: problem and city → merchant publication/query → buyer purchase → actual translation/edit/export → reopen → evidence and one failure state. Keep it at least two minutes and below three minutes to fit both selected sponsors' duration rules. Capture real network operations; label any recorded failure demonstration.

## 11. What each teammate should be able to explain

- **Why Arkiv?** The provider owns a publicly queryable listing; our app database does not decide who may edit that record.
- **Why Whitechain?** The contract records the exact stablecoin purchase entitlement; the server verifies it before performing paid work.
- **Why 0G?** It performs the actual translation through our selected private route. The server still sees the input, and Router verification is not translation accuracy.
- **What happens after failure?** Payment remains recorded; the job is visibly unresolved and can be recovered or retried within limits. This prototype has no automatic refund promise.
- **Why a city?** It makes discovery, purchase, execution and recovery visible as one journey. Every state comes from the system rather than an animation timer.

**Final selection:** Tool City — one paid private text-translation workshop, built around Arkiv + Whitechain Operate + 0G Private Computer, with a real city interface and durable buyer-bound results.
