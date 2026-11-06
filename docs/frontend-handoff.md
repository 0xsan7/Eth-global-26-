# Tool City — Frontend handoff (Agent B)

Commit / common contract version:
- Branch: `codex/city-frontend` on the `mevarx/Eth-global-26-` fork, based on
  `feat/tool-city-workshop-ui`.
- Contract: common project structure v1.0 (6 Nov 2026, §§9–10) + frontend/Arkiv
  assignment (§9). `config/deployment.json` is `schemaVersion: 1`,
  `configured: false`.

Files changed:
- Added the complete B-owned browser track: `src/app/{page.tsx,jobs/*,merchant}`,
  `src/components/{app,checkout,city,jobs,merchant,wallet,workshop}/*`,
  `src/lib/{arkiv,client}/*`, `examples/checkout-demo/*`, `tests/ui/*`,
  `scripts/run-ui-smoke.cjs`, `arkiv/*.md`, `public/city/README.md`.
- Merged shared contracts with Agent A's backend implementation:
  `src/lib/shared/{api,domain,deployment,fixtures,validation}.ts`.
- Removed dead code: the entire unused `apps/web` reference app (a copied
  Claude-clan game UI, ~41k lines), its `reference:*` scripts, the unused
  `src/lib/client/exports.ts` barrel, unused envelope helpers, unused
  `useCreateJob`/`useRunJob` hooks, unused `usePublicConfig` context, unused
  `WHITECHAIN_TOKEN`/`AppWagmiConfig` exports, and the unused local
  `getPublicConfig(serviceTermsText)` stub.
- Updated `README.md`, `package.json`, `examples/checkout-demo/package.json`,
  `vite.config.ts`, and `package-lock.json` for the integrated workspace.

Commands run and actual results (Node v24.14.1, npm 11.x):
- `npm install` → 513 packages added; lockfile updated.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → exit 0.
- `npm run test:server` → 2 files, 21 tests, 21 pass.
- `npm run test:ui` → 13 tests, 13 pass.
- `npm run test:contracts` → 5 tests, 5 pass (solc 0.8.30).
- `npm run lint` → exit 0.
- `npm run build` → Vite checkout demo + Next production build pass (14 app
  routes); standalone assets prepared.

Real Arkiv write/query/update/withdrawal evidence:
- NONE. `src/lib/arkiv/{schema,read,write}.ts` implement the SDK 1.0.1 adapter
  and wallet-signed create/update/withdraw paths, but no funded merchant wallet
  has broadcast a Rabdi transaction yet. No explorer link or tx hash is
  fabricated here. The adapter is compile-tested only.

ABI/deployment manifest commit consumed:
- `src/lib/shared/checkout-abi.ts` is Agent A's generated ABI from
  `contracts/ToolCityCheckout.sol`.
- `config/deployment.json` has `terms: null`, `configured: false`; no checkout/
  merchant/service addresses or Whitechain RPC/explorer values are deployed yet.
- Manifest values: Arkiv Rabdi `chainId 7794095`; Whitechain `chainId 1874`;
  official token `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`; Max 250 words /
  5,000 chars; 1 test USDT fixed price.

Live API paths vs development fixtures:
- Backend is implemented on this branch: auth challenge/verify/session/logout,
  jobs create/list/get, verify-payment, run, edits, merchant purchases + CSV.
  It still fails closed until checkout/review is configured and a real Arkiv
  reader is connected (`GET /api/config` reports `configured: false`).
- Fixtures in `src/lib/shared/fixtures.ts` are explicitly labelled
  (`supported: false`, `freshness: "stale"`, fixture-titled) and render only
  behind `NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true`. They are never live evidence.

Wallet/network/browser behavior verified:
- Not executed against a live wallet/network in this handoff. The code paths
  exist for Arkiv Rabdi merchant writes (chain 7794095) and Whitechain buyer
  checkout (chain 1874, official token): account/network checks, exact-amount
  allowance/approve, compiled-ABI `purchase`, 202 retry/backoff verification,
  account-switch cache clear, and deliberate-only `run`. These still need a
  funded-wallet browser run once deployment values are real.

Known failures / limitations:
1. No live Arkiv listing, deployed checkout, official-token purchase or private
   0G request has been exercised; `configured: false` is honest.
2. `tests/ui/smoke.test.ts` covers shared validation/segmentation/address rules,
   fixture labelling, `jobStateToScene`, and the documented export rule. It does
   not cover DOM, wallet flows, polling or API integration.
3. `scripts/run-ui-smoke.cjs` resolves runtime deps from the repo
   `node_modules` via `NODE_PATH`; run it after `npm install`/`npm ci`.
4. The generated `public/checkout-demo/` output is gitignored and not committed.

What Agent A must merge or do next:
1. Deploy the checkout contract, fill `config/deployment.json` with verified
   addresses/RPC/explorer/terms, and reconcile terms before enabling purchases.
2. Publish a real Arkiv workshop from the merchant wallet and record actual
   entity key, tx hashes, update and withdrawal evidence.
3. Configure 0G private inference and run a real paid translation end to end.
4. Replace every FIXTURE slot in `docs/demo-script.md` with live evidence and
   have both teammates sign the both-parties review note before submission.
