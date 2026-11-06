# San's Backend and Payments — Agent Execution Plan

**Updated:** 6 November 2026. **Role:** Agent A, backend/payments/integration.\
**Scope:** one fixed-price English → Hindi translation workshop; Arkiv discovery, Whitechain purchase entitlement, 0G private inference, durable buyer-bound results.\
**Contract authority:** [Common structure v1.0](briefs/TOOL-CITY-COMMON-STRUCTURE.md). [Original assignment](briefs/san-backend-original.md) is retained. This staged plan controls sequencing and branch promotion; it does not expand product scope.

## Working agreement

Build on `codex/payment-backend` from the existing README commit. Keep work in reviewable commits; use additional `codex/` feature branches/worktrees when a task benefits from isolation. Subagents currently edit disjoint owned files under the orchestrator's integration branch; that is intentional coordination, not a claim of separate Git histories.

The user has authorized main promotion **only after all readiness checks pass**. A passing local unit test or scaffold build does not qualify as full project readiness. No direct main push, force push or merge while live dependencies, teammate integration or acceptance evidence are incomplete. Once gates pass, fetch the actual remote main/default branch, review its changes, create a reviewable merge/PR and merge normally if repository permissions allow. Do not create or overwrite main from an assumed empty history.

No live prerequisites are configured yet. Get test-wallet funding and 0G access through [the setup guide](SETUP-LIVE-INTEGRATIONS.md). Work that can be implemented and honestly tested locally can proceed meanwhile. Do not fake live integrations or silently downgrade privacy.

## Models and reasoning

| Role | Model | Reasoning | Allowed work |
|---|---|---|---|
| Technical orchestrator | **GPT-6.1 Sol** (`gpt-6.1-sol`) | **high** by default | Architecture, shared interfaces, server integration, ownership, acceptance evidence and review decisions |
| Contract/complex implementation worker | **GPT-6.1 Terra** (`gpt-6.1-terra`) | **high**; xhigh for unresolved security/concurrency design | Bounded contract implementation/tests, difficult backend changes, independent security review |
| Bounded support worker | **GPT-6 Luna** (`gpt-6-luna`) | **medium**; low for mechanical formatting | Handoff documents, setup/checklist maintenance and narrow predictable chores |
| Final reviewer | GPT-6.1 Sol or Terra | **high**, xhigh for a specific unresolved issue | Adversarial entitlement/replay/recovery review; never delegated solely to Luna |

These are workload recommendations, not a measured guarantee of model superiority. Do not spend xhigh/max reasoning on routine edits. Use at most two workers concurrently under the technical coordinator; each gets a narrow task, exact file ownership, shared contract and acceptance checks. The parent reviews all changes before integration. Do not have multiple agents edit package/lockfile or the same module simultaneously.

The primary chat's model remains a UI selection; a subagent configuration cannot silently change it. A dedicated GPT-6.1 coordinator can be selected explicitly. Model/reasoning selection behavior: [official model controls](https://learn.chatgpt.com/docs/models), [official subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Part 0 — Shared base and dependency gate

**Lead:** GPT-6.1 Sol, high. **Support:** Luna, medium, documentation only.\
**Files:** root toolchain, `config/`, `src/lib/shared/`, minimal Next layout and agreed frontend placeholders. Root integrator alone installs dependencies and owns the lockfile.

Tasks: pin validated packages; implement canonical DTOs and validation; establish scripts; provide one development-only fixture; commit honestly unconfigured public settings. Preserve the initial README history. Publish the exact bootstrap commit for the teammate to branch from.

**Acceptance:** root install, lint, typecheck and production build work; no credentials or fake deployed addresses committed. Frontend placeholders clearly say integration is pending.

## Part 1 — Checkout contract and ABI

**Worker:** Terra, high. **Review:** Sol, high.\
**Files:** `contracts/`, contract tests, deployment/verification scripts. Toolchain config/ABI export coordinated with integrator.

Implement fixed token/merchant/service/amount/terms; common `purchase` and `getPurchase`; buyer+job uniqueness; safe transfer and record atomicity. Test bad terms/service/amount, duplicate purchase, failed transfer, separate buyers using the same job ID and malicious token reentrancy. Generate the shared ABI from the actual compiled artifact.

Use current supported Hardhat 3/viem tooling. Whitechain's official guide explicitly documents Solidity 0.8.30 and `prague`; do not guess a different target without evidence. [Official deployment guide](https://docs.whitechain.io/build/deploy/deploy-with-hardhat)

**Acceptance:** actual compilation and meaningful local tests pass. Test-only mock tokens do not count as official-token settlement. Deployment/verification/official-token evidence remain separate live gates.

## Part 2 — Authentication and durable jobs

**Lead:** Sol, high. **Review:** Terra, high, after Part 1.\
**Files:** `src/lib/server/{auth,db,jobs}.ts`, migrations, auth/job API handlers and targeted server tests.

Implement signed one-use challenges with origin/domain/address/expiry binding; secure sessions; buyer authorization; private durable SQLite records; immutable source/accepted terms; stable segment IDs; separate original/edited result versions. Merchant role is the configured merchant, not arbitrary Arkiv publishers. A wrong buyer and missing job both return 404.

**Acceptance:** expired/reused challenges fail; unauthenticated and wrong-buyer access fail; state survives reopening/restart; no drafts/results exposed to merchant responses/logs.

## Part 3 — Trusted purchase verification

**Lead:** Sol, high. **Review:** Terra, high.\
**Files:** `payment.ts`, verification endpoint and targeted receipt/state tests.

Verify network, official token, checkout, receipt success, confirmation policy, buyer/job/service/payee/amount/terms, settlement and contract state. Pending is not success; repeated verification is idempotent. Browser flags and transaction hashes alone cannot authorize execution.

**Acceptance:** mocked adversarial cases pass locally; actual Whitechain contract, official token payment and explorer evidence are required for the live gate.

## Part 4 — Private inference, lease and recovery

**Lead:** Sol, high. **Review:** Terra, xhigh only if lease/replay correctness remains unresolved.\
**Files:** `inference.ts`, `recovery.ts`, run route and meaningful lifecycle tests.

Implement supported explicit private routing and verification metadata; bounded timeout; structural segment validation; atomically claimed durable lease; at most initial + one eligible manual retry; result saved before ready. Expired lease becomes interrupted without stealing active work. Preserve entitlement after failure. Do not promise exactly-once external model execution or automatic refunds.

**Acceptance:** two concurrent requests dispatch once, invalid responses never become ready, failure/retry budget and recovery work. Actual funded private requests, useful Hindi quality and observed evidence remain mandatory live gates.

## Part 5 — Merchant/export/frontend integration

**Lead:** Sol, high, pairs with teammate/OpenCode. **Support:** Luna, medium, handoff/docs.\
**Files:** settlement APIs, CSV, edits persistence and integration notes. Teammate owns city, Arkiv implementation and browser screens.

Merge the teammate's neutral Arkiv read adapter and browser journey; verify listings independently when creating new jobs. Do not author a competing Arkiv implementation. Complete actual listing → purchase → inference → review/export → reopen. Merchant settlements contain no buyer text. A tiny separate example consumes the same checkout component.

**Acceptance:** no development fixture in production; owner update/withdrawal visible; saved edits/export correct; account switching clears private UI; restart/reopen does not repurchase.

## Part 6 — Readiness and main promotion

**Lead/reviewer:** Sol + Terra, high. **User authorization:** granted only after all checks below pass.

- [ ] Clean root install from committed lockfile; lint, typecheck and production build pass.
- [ ] Contract and server checks pass; no unresolved entitlement/replay/privacy/concurrency defect.
- [ ] Real merchant-owned Arkiv listing/query/update/withdrawal works through teammate integration.
- [ ] Actual verified Whitechain deployment and official test-USDT purchase in the main flow.
- [ ] Actual private 0G translation is useful to a Hindi reviewer; real request evidence recorded.
- [ ] Wrong buyer/unpaid run/incorrect payment denied; concurrent requests cannot bypass attempt limits.
- [ ] Paid interruption/retry and persistent-host restart/reopen demonstrated without second checkout.
- [ ] Review, saved edits, TXT/JSON export, merchant CSV and separate checkout example work.
- [ ] Public configuration matches actual chain state; no credentials/private drafts committed; fixtures disabled.
- [ ] Teammate's code integrated; actual remote main/default history fetched and reviewed.
- [ ] Handoff, setup/limitations/AI attribution and sponsor evidence updated with real outcomes.

If any box is incomplete, keep the branch and report exactly what remains. Do not mark an unknown gate passed, bypass branch protection, or manufacture a commit timeline. Push reviewable feature commits when GitHub authentication permits. Local commits are not claimed as remote pushes.

## First session deliverable

Complete the staged plan before implementation, then build the shared base, checkout contract and credential-independent backend foundation on the feature branch. Keep live integrations fail-closed until the user configures prerequisites and the teammate provides Arkiv. Record achieved milestones and exact pending gates in `docs/backend-handoff.md`.

This plan remains the live instruction set. The original ownership restrictions still apply; root coordination does not authorize editing the teammate's implementation after the common bootstrap.

## First-session progress

Implemented the shared Next/TypeScript base and client-safe contracts; compiled fixed-service Solidity and generated its ABI; added the backend auth/job/payment/inference/recovery/edit/settlement paths. The browser and example remain explicit disabled placeholders for the teammate to implement.

Local evidence: 21 server tests, 5 contract tests, lint, typecheck, production build and standalone HTTP smoke passed. No actual wallet funding, Arkiv publication, checkout deployment, official-token settlement or 0G inference was performed. Live setup and the teammate's integration remain required. See the handoff for exact checks, current limitations and remote publishing status.
