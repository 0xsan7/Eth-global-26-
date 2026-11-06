# Tool City — demo script (~2:40, merchant + buyer)

Total ≈ 160 s. Two roles, one fixed-price en→hi translation. Right column is
the EVIDENCE the audience sees; every slot is tagged LIVE (chain/server truth)
or FIXTURE (labelled dev data, never presented as sponsor evidence). Status at
script time: backend stubs return 503, `src/lib/arkiv/` is empty, manifest
`configured: false` — so this cut runs FIXTURE-backed unless a slot is
replaced per the "go-live swap" notes. Do not claim a fixture screen as an
Arkiv/Whitechain/0G integration.

## 0:00–0:15 — Setup slate (15 s)

- Say: one merchant, one 100–250 word English→Hindi service, fixed 1 test USDT
  on Whitechain (chain 1874), discovery on Arkiv Rabdi (chain 7794095), compute
  on 0G. Show `GET /api/config` response with `configured: false`.
- Evidence: config JSON on screen [LIVE — but proving NOT-configured].

## 0:15–0:55 — Merchant: publish → update → withdraw on Rabdi (40 s)

- 0:15 connect merchant wallet on Rabdi 7794095 [evidence: address + chain id].
- 0:25 publish workshop entity: `app = tool-city.workshop.v1`, title,
  description, `active = true` [evidence: wallet signature + entity key +
  Rabdi explorer link — FIXTURE slot until adapter lands].
- 0:40 edit description only (no financial fields editable) [evidence: refreshed
  listing, `fetchedAt`, fresh/stale flag].
- 0:50 owner-signed `active = false` withdrawal; state aloud: existing paid jobs
  stay recoverable, only new discovery stops [evidence: `active: false` record].
- Go-live swap: replace each FIXTURE slot with the real tx hash + explorer URL;
  wrong-wallet update attempt must FAIL pre-broadcast with no link invented.

## 0:55–2:00 — Buyer: discover → draft → purchase → run (65 s)

- 0:55 Registry Hall: real Arkiv query result, owner/entity key, freshness,
  supported-vs-unsupported reconciliation [FIXTURE listing until live].
- 1:05 Creator's Home: paste ~150-word draft; show word/char counters, blank-
  paragraph segments (`seg_001…`), 250-word / 5000-char / 20-segment rejects
  [evidence: validation messages — REAL shared logic, covered by smoke tests].
- 1:20 create job: server-issued 32-byte job id, IMMUTABLE source + terms
  [evidence: `JobView` status `awaiting_payment` — FIXTURE slot].
- 1:30 Treasury: switch to Whitechain 1874, check allowance, approve exactly
  the official-token amount, call `purchase(jobId, expectedServiceId,
  expectedAmount, expectedTermsHash)` [evidence: approval + purchase hashes —
  FIXTURE slot].
- 1:45 submit hash to verify-payment: show 202 pending → 200 verified polling
  [evidence: `PaymentView { txHash, blockNumber, verifiedAt }` — FIXTURE slot].
- 1:55 deliberate Start translation → `running` → `ready`; Translation Studio
  worker moves, then parcel waits at Home [evidence: status transitions + 0G
  evidence panel `requestId/modelId/TEE-reported` — FIXTURE slot; the city
  NEVER self-marks ready on a timer].

## 2:00–2:30 — Review, edit, export, reopen (30 s)

- 2:00 source-aligned segments by stable id; edit one segment → unsaved badge →
  Save sends the COMPLETE id set [evidence: saved `editedSegments`].
- 2:10 export TXT (clean translation) + JSON (source/result/receipt/evidence,
  `edited: true` honest label) [evidence: downloaded files].
- 2:20 My Jobs → reopen the ready job: loads saved result, no repurchase, no
  rerun [evidence: same job id, `attemptsUsed`, `retryEligible`].
- 2:28 note the failure paths (not all demoed live): interrupted/failed paid
  job shows unresolved + one manual retry; 404 hides other buyers' jobs.

## 2:30–2:40 — Close + sponsor map (10 s)

- Map each leg to its sponsor: Arkiv = provider-owned discovery; Whitechain =
  official-token checkout + entitlement; 0G = private translation (server pays
  compute; draft visible to backend for routing, never in public entities).
- State the current honesty slate: which slots were LIVE vs FIXTURE in this
  recording, and the single next step (live manifest + broadcasts).

## Both-parties review note (sign before submission)

- [ ] Merchant flow reviewed against a REAL Rabdi broadcast (Agent B).
- [ ] Purchase verified against the REAL deployed checkout + manifest (Agent A).
- [ ] Translation output reviewed by a Hindi reader for usefulness (both).
- [ ] Every FIXTURE slot above replaced or explicitly carried as known-gap.
- [ ] No explorer link, receipt, or "ready" state in the recording is invented.

  Reviewer A (backend/payments): ______________ date: __________
  Reviewer B (frontend/Arkiv):   ______________ date: __________
