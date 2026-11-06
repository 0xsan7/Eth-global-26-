# Integration checklist note (Agent B drop → common §10 M0–M4)

This is a supplement to `docs/integration-checklist.md`. It records what the
`codex/city-frontend` branch now contains and what still needs live evidence.

| Milestone | Current branch | Still required |
|---|---|---|
| M0 shared base | One root workspace, one lockfile, frozen shared DTOs/validation/ABI; `npm ci`/install, typecheck, lint and build pass | Keep shared contracts frozen; bump handoff version on changes |
| M1 adapters + deployment | `src/lib/arkiv/{schema,read,write}.ts` implemented against SDK 1.0.1; compiled checkout ABI consumed; manifest still `configured: false` | A: deploy checkout, fill verified deployment values, publish a real Rabdi listing |
| M2 paid slice | Auth, job create/list/get, checkout component, verify-payment, run, edits and merchant CSV implemented and unit/contract tested | Live listing → auth → official-token purchase → verify → private 0G run |
| M3 full experience | City, source-aligned review/export, merchant view, checkout example and UI smoke tests integrated | Browser pass on desktop/narrow layouts, keyboard, reduced motion, wallet rejection/account switch |
| M4 release | 21 server tests, 13 UI tests, 5 contract tests, lint, typecheck and production build pass | Real end-to-end/failure matrix and both-parties sign-off |

No live sponsor transaction, deployment address or private inference result is
claimed by this branch. `public/checkout-demo/` is generated and gitignored.
