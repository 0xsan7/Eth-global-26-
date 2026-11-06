# Tool City

A small city of AI workshops where creators can purchase a private translation, review it beside the source, and reopen the saved result later.

Built for **ETHGlobal Mumbai 2026** by a two-person team.

## Status

Frontend and backend foundations are integrated on `codex/city-frontend`. Local contract/server/UI checks pass. Live sponsor integrations, deployed checkout values and a real Arkiv listing are still pending; this is not a working paid translation demo yet.

The backend fails closed until a real deployment and Arkiv reader are integrated. The city and job screens render real API state and show labelled fixtures only behind `NEXT_PUBLIC_ENABLE_DEV_FIXTURES`.

## The idea

Creators who occasionally translate short unpublished announcements should be able to buy one task, correct its output, and recover the result without a subscription or a second purchase.

Our first workshop will translate short English drafts into Hindi. An isometric city will make discovery, payment, processing, and recovery visible through clickable buildings and a document-carrying worker.

## Planned workflow

1. Discover a merchant-owned workshop on Arkiv.
2. Connect a wallet and submit a short draft.
3. Purchase the job with official test USDT on Whitechain.
4. Verify the purchase on the server before private inference through 0G.
5. Review and edit corresponding source/translation segments, then export TXT or JSON.
6. Reopen the existing paid job without buying it again.

## Stack

- **Interface:** Next.js, React, SVG and CSS animations.
- **Discovery:** wallet-owned workshop records on Arkiv.
- **Payments:** a fixed-price checkout contract on Whitechain Sepolia.
- **AI:** private inference through 0G Private Computer.
- **Recovery:** authenticated job access and a private SQLite store on persistent hosting.

Private inference does not hide the draft from our application backend. Model quality, availability and end-to-end recovery still need to be tested.

## Team workflow

One builder owns contracts, backend, payment verification and 0G. The other owns the city, frontend and Arkiv. Both work from a shared structure and API contract.

## Development

Requires **Node.js 24** and npm. From the repository root:

```bash
npm ci
cp .env.example .env.local
```

Configure a local `SESSION_SECRET` before using authenticated APIs; follow [live setup from zero](docs/SETUP-LIVE-INTEGRATIONS.md) for wallet funding and 0G access. Do not commit credentials. Then:

```bash
npm run dev
```

Validation commands:

```bash
npm run contracts:compile
npm run test:contracts
npm run test:server
npm run test:ui
npm run lint
npm run typecheck
npm run build
npm run smoke:local
```

`npm run contracts:compile` exports the ABI from the actual compiled contract. First compilation may download the official Solidity compiler. `npm run build` packages the independent checkout example and prepares Next standalone public/static assets; `npm start` runs that build. Production requires HTTPS configuration and a persistent `DATABASE_PATH` on one Node instance.

## Implemented backend foundation

- Nonce-bound wallet authentication, sessions and origin checks.
- Durable SQLite jobs, immutable source/accepted terms, separate saved edits and buyer-only recovery.
- Fixed-service checkout contract, generated ABI and adversarial local tests.
- Server receipt, token-settlement and purchase-state verification.
- Private 0G request adapter, bounded responses, durable execution leases and two-attempt limit.
- Merchant-only settlement JSON/CSV without buyer text.

Local tests use explicit doubles and test tokens; they do not establish official-token settlement, model availability, translation quality or sponsor eligibility. The confirmed-purchase cache does not implement later chain-reorg rollback; wallet authentication currently covers EOA signatures. The backend sees the draft. These limitations and remaining gates are recorded in the handoff.

## UI, city and Arkiv

UI routes: `/` (city + workshop discovery), `/jobs` (buyer summaries),
`/jobs/[jobId]` (status, source-aligned review, edit/save/export, evidence),
`/merchant` (listing publication + verified settlements + CSV).

Wallet networks: merchant writes listings on Arkiv Rabdi (chain id 7794095);
buyers pay on Whitechain (chain id 1874) with the official test USDT
`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`. Network config comes from
`GET /api/config` (public manifest); no private keys or API keys in the UI.

Demo + fixture flag: `NEXT_PUBLIC_ENABLE_DEV_FIXTURES` gates dev-only
rendering and must be `false`/absent in production; the server never reads it
for authorization. Fixtures in `src/lib/shared/fixtures.ts` are labelled
(`supported: false`, fixture-titled) and are never live evidence - see
`docs/demo-script.md` for the LIVE-vs-FIXTURE evidence slots.

Arkiv criterion docs map: `arkiv/schema.md`, `arkiv/friction.md`,
`arkiv/reach.md`, `arkiv/why-arkiv.md`, `arkiv/how-you-use-arkiv.md`
(full B track) + `src/lib/arkiv/{schema,read,write}.ts`. City art is original
SVG/CSS - see `public/city/README.md`.

UI smoke tests (`tests/ui/smoke.test.ts`, `node:test` + `assert`, no new deps)
compile the tested sources to a temp directory and run `npm run test:ui`.
Status and next steps live in `docs/frontend-handoff.md`; release checklist
notes are in `docs/integration-checklist-note.md`.

## Agent plan and handoff

- [Staged backend plan and model/reasoning assignments](docs/san-backend-payments.md)
- [Common structure/API contract](docs/briefs/TOOL-CITY-COMMON-STRUCTURE.md)
- [Teammate's frontend/Arkiv assignment](docs/briefs/TOOL-CITY-TEAMMATE-FRONTEND-STRUCTURE.md)
- [Actual checks and pending live gates](docs/backend-handoff.md)
- [Integration checklist](docs/integration-checklist.md)

No main promotion until the full readiness checklist passes, including real Arkiv publication, verified Whitechain deployment/official-token purchase, useful private 0G output and complete UI/recovery integration. Deployment addresses and evidence will be added only after actual operations.

This branch combines the backend foundation with the teammate's city, review, merchant and Arkiv UI work. The city is rendered from real normalized listing/job state; no live listing, deployed checkout or private 0G request is claimed until the handoff evidence is filled.
